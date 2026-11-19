import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { listingAiOutputSchema } from '@/lib/listingAutofill';
import { LISTING_PAGE_MAX_TOKENS, readListingWebsite, portalFacts } from '@/lib/listingAutofillServer';
import { fetchPublicPage, htmlToText } from '@/lib/listingImagesServer';
import { searchCatalogue } from '@/lib/listingCatalogue';
import { evidenceFeedback, evidenceProblems, linkAllowed, type AgentInput } from '@/lib/listingAgent';
import { anthropicModel, claudeCaller } from '@/lib/server/anthropic';
import { recordAiUsage, type AiContext } from '@/lib/server/aiCredits';
import { loadCatalogue } from '@/lib/server/listingCatalogueData';

/*
 * Listing autofill agent. Replaces the route's single extraction call with a short tool loop:
 *  - read_linked_page: open a link written in a source (the project's own page, brochure, floor plans)
 *    when the sources leave a field unclear. Only exact URLs from the sources, at most MAX_LINKED_PAGES.
 *  - find_building: look a building or community up in the Emirate08 catalogue for its exact spelling.
 *  - submit_listing: the final answer in the existing structured format. It runs the route's evidence
 *    check first and, once, returns the answers that would be dropped so the model can fix its quotes.
 * In the common case the model submits on its first turn, so a request costs what the single call did.
 * Every call is charged to the member's AI credits, as before.
 */

const MAX_TURNS = 5;
const MAX_LINKED_PAGES = 2;

const AGENT_PROMPT = `TOOLS
You can call tools before answering. Most requests need none: when the sources are clear, call submit_listing straight away.
- read_linked_page: when a source links to THIS property's or project's own page, brochure, floor plan or payment plan, and it would answer a field the buyer needs that the sources leave out or unclear (price, size, bedrooms, handover, payment plan, developer), read it. Use the exact URL as written in the source. At most ${MAX_LINKED_PAGES} pages. Never open other listings, search results, social media, maps or agent pages. The page becomes a source of its own: answer for it separately, labelled as the tool result says.
- find_building: search Emirate08's catalogue of buildings and communities. When an entry is clearly the same place as the source describes, use its spelling for communityId, subcommunity and buildingName. Catalogue entries are never evidence and never a reason to answer a field the sources don't state; the evidence quote still comes from the source.
- submit_listing: your final answer, in the format described above. If it returns evidence problems, fix each quote (copy it exactly from that source) or leave that answer out, and call submit_listing again with all sources.`;

export class ListingAgentError extends Error {
  constructor(
    message: string,
    public kind: 'busy' | 'failed' | 'incomplete',
  ) {
    super(message);
  }
}

type Options = {
  ctx: AiContext;
  apiKey: string;
  inputs: AgentInput[];
  allowPrivate: boolean;
  today: string;
  signal: AbortSignal;
  maxOutputTokens: number;
  /** The route's unique-label helper, so linked pages get labels like every other source. */
  labelFor: (raw: string) => string;
  systemPrompt: string;
};

/** Runs the agent. Returns the parsed structured answer; `inputs` gains any linked pages it read. */
export async function runListingAgent(opts: Options): Promise<{ parsed: any; turns: number; linked: number }> {
  const { ctx, apiKey, inputs, allowPrivate, today, signal } = opts;
  const client = new Anthropic({ apiKey });
  const model = anthropicModel();
  let linked = 0;
  let feedbackGiven = false;
  let nudged = false;

  const tools = (): Anthropic.Tool[] => [
    {
      name: 'read_linked_page',
      description: 'Reads a public web page linked from one of the sources (exact URL as written there). Returns the page as a new source.',
      strict: true,
      input_schema: {
        type: 'object',
        properties: { url: { type: 'string' }, reason: { type: 'string', description: 'Which missing or unclear fields it should answer.' } },
        required: ['url', 'reason'],
        additionalProperties: false,
      },
    },
    {
      name: 'find_building',
      description: "Searches Emirate08's building and community catalogue (from published listings). Returns up to 5 matches with their community, subcommunity, developer and listing count.",
      strict: true,
      input_schema: {
        type: 'object',
        properties: { query: { type: 'string', description: 'Building, project or community name as written in the source.' }, emirate: { type: 'string', description: 'Emirate name, or "" if unknown.' } },
        required: ['query', 'emirate'],
        additionalProperties: false,
      },
    },
    {
      name: 'submit_listing',
      description: 'Submits the answers for every source. Checks the evidence first; returns problems to fix, or "Saved."',
      strict: true,
      // No label enum: tools render before the system prompt, so per-request labels here would stop the
      // long extraction prompt being cached across requests. Labels are checked on submit instead.
      input_schema: listingAiOutputSchema(allowPrivate, []) as Anthropic.Tool.InputSchema,
    },
  ];

  const sourceBlocks = (list: AgentInput[]) => list.flatMap((input) => [{ type: 'text' as const, text: `Source: ${input.label}` }, ...input.blocks]);
  const first = [
    ...sourceBlocks(inputs),
    { type: 'text' as const, text: `Today is ${today}. Answer for each source: ${inputs.map((i) => JSON.stringify(i.label)).join(', ')}.` },
  ];
  // Cache the sources: later turns re-send them, and cached input is a tenth of the price (and credits).
  (first[first.length - 1] as any).cache_control = { type: 'ephemeral' };
  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: first as any }];

  for (let turn = 1; turn <= MAX_TURNS; turn++) {
    let message: Anthropic.Message;
    try {
      message = await client.messages
        .stream(
          {
            model,
            max_tokens: opts.maxOutputTokens,
            system: [
              { type: 'text', text: opts.systemPrompt },
              { type: 'text', text: AGENT_PROMPT, cache_control: { type: 'ephemeral' } },
            ],
            tools: tools(),
            messages,
          },
          { signal },
        )
        .finalMessage();
    } catch (error) {
      if (error instanceof Anthropic.RateLimitError || error instanceof Anthropic.InternalServerError)
        throw new ListingAgentError('Document assistance is busy. Please try again shortly.', 'busy');
      if (error instanceof Anthropic.APIError) {
        console.error('[listing-autofill] Provider request failed:', error.status, error.message.slice(0, 300));
        throw new ListingAgentError('The documents could not be analyzed. Try a clearer or smaller document.', 'failed');
      }
      throw error;
    }
    await recordAiUsage(ctx, {
      feature: 'listing_autofill_extract',
      model: message.model,
      usage: message.usage as any,
      status: message.stop_reason === 'refusal' ? 'error' : 'ok',
      requestId: message.id,
    });
    // A cut-off or declined answer can't be trusted to be complete.
    if (message.stop_reason === 'max_tokens' || message.stop_reason === 'refusal') {
      console.error('[listing-autofill] Incomplete answer:', message.stop_reason);
      throw new ListingAgentError('The documents could not be fully analyzed. Try fewer or smaller documents at a time.', 'incomplete');
    }
    messages.push({ role: 'assistant', content: message.content });

    const calls = message.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
    if (!calls.length) {
      if (nudged) break;
      nudged = true;
      messages.push({ role: 'user', content: 'Call submit_listing with your answers for every source.' });
      continue;
    }

    const results: Anthropic.ToolResultBlockParam[] = [];
    const newSources: AgentInput[] = [];
    let accepted: any = null;
    for (const call of calls) {
      const input = call.input as any;
      try {
        if (call.name === 'submit_listing') {
          const labels = new Set(inputs.map((i) => i.label));
          const unknown = (Array.isArray(input?.sources) ? input.sources : []).map((s: any) => s?.label).filter((l: any) => !labels.has(l));
          const problems = evidenceProblems(input, inputs);
          if ((problems.length || unknown.length) && !feedbackGiven) {
            feedbackGiven = true;
            const parts = [
              unknown.length ? `Unknown source labels ${unknown.map((l: any) => JSON.stringify(l)).join(', ')}. Use exactly: ${[...labels].map((l) => JSON.stringify(l)).join(', ')}.` : '',
              problems.length ? evidenceFeedback(problems) : 'Not saved yet. Fix the labels and call submit_listing again with all sources.',
            ];
            results.push({ type: 'tool_result', tool_use_id: call.id, is_error: true, content: parts.filter(Boolean).join('\n\n') });
          } else {
            // Second submission: whatever still fails is dropped by the route, as before.
            accepted = input;
            results.push({ type: 'tool_result', tool_use_id: call.id, content: 'Saved.' });
          }
        } else if (call.name === 'find_building') {
          const matches = searchCatalogue(await loadCatalogue(), String(input.query || '').slice(0, 80), String(input.emirate || ''), 5).map((b) => ({
            name: b.name,
            tower: b.tower || undefined,
            community: b.community,
            subcommunity: b.subcommunity || undefined,
            emirate: b.emirate,
            developer: b.developer || undefined,
            listings: b.listingCount,
          }));
          results.push({ type: 'tool_result', tool_use_id: call.id, content: JSON.stringify(matches.length ? matches : { matches: [], note: 'No catalogue entry. Use the spelling in the source.' }) });
        } else if (call.name === 'read_linked_page') {
          const url = String(input.url || '').trim();
          if (linked >= MAX_LINKED_PAGES) throw new Error(`Only ${MAX_LINKED_PAGES} linked pages can be read.`);
          if (!linkAllowed(url, inputs)) throw new Error('That URL is not written in any source. Only links that appear exactly in a source can be opened.');
          linked++;
          // Same reading as the route: web_fetch first, and the page's own HTML when web_fetch comes back
          // empty (Property Finder does this).
          const page = await readListingWebsite(url, apiKey, signal, claudeCaller(ctx, apiKey, 'listing_autofill_fetch')).catch(async (error) => {
            const direct = await fetchPublicPage(url, signal);
            const fallback = direct ? htmlToText(direct.html).slice(0, LISTING_PAGE_MAX_TOKENS * 4) : '';
            if (fallback.length < 200) throw error;
            return { label: url, text: fallback };
          });
          const text = page.text.replace(/&amp;/gi, '&');
          const facts = portalFacts(text, today);
          const source: AgentInput = {
            label: opts.labelFor(`Linked page - ${new URL(url).hostname.replace(/^www\./, '')}`),
            text,
            page: true,
            linked: true,
            blocks: [
              { type: 'text', text: `Page content (untrusted data):\n${page.text}` },
              ...(facts ? [{ type: 'text', text: `Portal facts for this source, read by the server from the page's structured record: ${facts}.` }] : []),
            ],
          };
          inputs.push(source);
          newSources.push(source);
          results.push({ type: 'tool_result', tool_use_id: call.id, content: `Read. It is now the source labelled ${JSON.stringify(source.label)}; its content follows.` });
        } else {
          throw new Error(`Unknown tool ${call.name}.`);
        }
      } catch (error) {
        results.push({ type: 'tool_result', tool_use_id: call.id, is_error: true, content: error instanceof Error ? error.message : String(error) });
      }
    }
    if (accepted) return { parsed: accepted, turns: turn, linked };
    // Tool results first (all in one message), then any newly read pages as further source blocks.
    messages.push({ role: 'user', content: [...results, ...(sourceBlocks(newSources) as any[])] });
  }
  throw new ListingAgentError('The documents could not be fully analyzed. Try fewer or smaller documents at a time.', 'incomplete');
}
