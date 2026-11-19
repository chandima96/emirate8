import { NextResponse } from 'next/server';
import { getSession } from '@/lib/server/session';
import { creditsAfter, startAiRequest } from '@/lib/server/aiCredits';
import { claudeCaller } from '@/lib/server/anthropic';
import { ListingAgentError, runListingAgent } from '@/lib/server/listingAutofillAgent';
import type { AgentInput } from '@/lib/listingAgent';
import { alignPriceKey, cleanListingSuggestions, rowsToSuggestions } from '@/lib/listingAutofill';
import { pageClassification, explicitlyReadyForOccupancy, extractionPrompt, readListingWebsite, portalFacts, dropUnsupported, LISTING_PAGE_MAX_TOKENS } from '@/lib/listingAutofillServer';
import { extractPagePhotos, fetchPublicPage, htmlToText, largestSizes, MAX_OTHER_IMAGES, MAX_PAGE_IMAGES, MAX_PAGE_SCAN } from '@/lib/listingImagesServer';

export const runtime = 'nodejs';
export const maxDuration = 300;

/* Limits. Usage is charged to AI credits, so these follow what the API accepts, not cost: one Messages
 * request is at most 32 MB (base64 makes files ~4/3 larger, so 22 MB of files), PDFs up to 100 pages on
 * 200K-context models, and the whole request must fit the model's context. */
const MAX_DOCUMENTS = 12;
const MAX_WEBSITES = 5;
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_TOTAL_FILE_BYTES = 22 * 1024 * 1024;
const MAX_TEXT_CHARS = 60_000;
const MAX_OUTPUT_TOKENS = 32_000;
// The whole agent loop (extra turns and up to 2 linked pages at ≤45 s each). With the initial page
// fetches (≤45 s, in parallel) it stays inside maxDuration.
const EXTRACT_TIMEOUT_MS = 220_000;

function websiteError(message: string) {
  return /^(Enter a valid public property|Use a public http|The website could not be read|Website assistance is busy|There was not enough readable property)/.test(message);
}

/* The portal's own record (completion status, delivery date, transaction tag) is read from the page by
 * code and also given to the model as "Portal facts". The model is asked to agree with it; this makes
 * sure it does, and keeps the fields that depend on the classification consistent. */
function applyPortalFacts(suggestions: Record<string, any>, text: string, today: string) {
  const facts = pageClassification(text, today);
  if (facts.devStatus) {
    suggestions.devStatus = facts.devStatus;
    // A completed building has no construction stage or handover quarter to offer.
    if (facts.devStatus === 'ready') for (const k of ['stage', 'handoverQ', 'handoverY']) delete suggestions[k];
  }
  // A developer's project page (starting or launch price, payment plan, developer, no resale) is an initial
  // sale. Project sites such as offplan-dubai.com carry no portal record, so the model's status counts too.
  const projectText = text.split(/Similar Projects/i, 1)[0];
  if (
    (facts.devStatus || suggestions.devStatus) === 'offplan' &&
    suggestions.purpose !== 'rent' &&
    /(?:starting|launch) price/i.test(projectText) &&
    /payment plan/i.test(projectText) &&
    /developer/i.test(projectText) &&
    !/(?:resale|re-sale|secondary market)/i.test(projectText)
  ) suggestions.txn = 'initial';
  if (facts.txn && suggestions.purpose !== 'rent') suggestions.txn = facts.txn;
  if (!suggestions.devStatus && explicitlyReadyForOccupancy(text)) suggestions.devStatus = 'ready';
  // The classification may have changed above: keep the price in the field it now uses.
  alignPriceKey(suggestions);
}

export async function POST(request: Request) {
  const session = await getSession(request.headers);
  const user = session.data.user;
  if (!user) return NextResponse.json({ error: 'Sign in to prepare a listing.' }, { status: 401 });
  if (!['broker', 'agency', 'developer', 'owner'].includes(user.type)) return NextResponse.json({ error: 'Your account cannot create listings.' }, { status: 403 });
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'Document assistance is currently unavailable. You can continue entering details manually.' }, { status: 503 });
  const gate = await startAiRequest(user.id);
  if (gate.blocked) return gate.blocked;
  const ctx = gate.ctx;

  try {
    const form = await request.formData();
    const allFiles = form.getAll('files').filter((file): file is File => file instanceof File && file.size > 0);
    // Plain-text files are read here; PDFs and images go to the model as documents.
    const isText = (file: File) => file.type === 'text/plain' || /\.txt$/i.test(file.name);
    const files = allFiles.filter((file) => !isText(file));
    const textFiles = allFiles.filter(isText);
    const websites = form.getAll('website').filter((value): value is string => typeof value === 'string' && Boolean(value.trim())).map((value) => value.trim());
    const pastedValue = form.get('text');
    const pasted = typeof pastedValue === 'string' ? pastedValue.trim().slice(0, MAX_TEXT_CHARS) : '';
    if (!pasted && !allFiles.length && !websites.length) return NextResponse.json({ error: 'Add documents, paste property details or add a link to analyze.' }, { status: 400 });
    if (allFiles.length > MAX_DOCUMENTS || websites.length > MAX_WEBSITES) return NextResponse.json({ error: `Add up to ${MAX_DOCUMENTS} documents and ${MAX_WEBSITES} links at a time.` }, { status: 400 });
    if (files.some((file) => !['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(file.type))) return NextResponse.json({ error: 'Upload PDF, TXT, JPG, PNG or WebP documents only.' }, { status: 400 });
    if (allFiles.some((file) => file.size > MAX_FILE_BYTES) || allFiles.reduce((total, file) => total + file.size, 0) > MAX_TOTAL_FILE_BYTES)
      return NextResponse.json({ error: 'Each file must be 20 MB or smaller, with a combined limit of 22 MB.' }, { status: 400 });

    // Private identifiers are only ever read from documents the user uploaded or pasted, not public pages.
    const allowPrivate = websites.length === 0;
    const warnings: string[] = [];
    const pages: { label: string; text: string }[] = [];
    // Links are read in parallel so several of them still fit the route's time limit. Each page is also
    // requested directly: its HTML gives the photos, and its text stands in when web_fetch comes back empty
    // (Property Finder). Photos are only offered to the user, who confirms they may use them.
    const [fetchedByAi, direct] = await Promise.all([
      Promise.allSettled(websites.map((website) => readListingWebsite(website, apiKey, request.signal, claudeCaller(ctx, apiKey, 'listing_autofill_fetch')))),
      Promise.all(websites.map((website) => fetchPublicPage(website, request.signal))),
    ]);
    const hostOf = (website: string) => { try { return new URL(website).hostname.replace(/^www\./, ''); } catch { return website; } };
    const fetched = fetchedByAi.map((result, n): PromiseSettledResult<{ label: string; text: string }> => {
      if (result.status === 'fulfilled') return result;
      const text = direct[n] ? htmlToText(direct[n].html).slice(0, LISTING_PAGE_MAX_TOKENS * 4) : '';
      return text.length >= 200 ? { status: 'fulfilled', value: { label: `Website - ${hostOf(websites[n])}`, text } } : result;
    });
    const images: { url: string; source: string; other?: boolean }[] = [];
    websites.forEach((website, n) => {
      // Portals such as Bayut refuse the direct request, but the page text read through web_fetch still
      // lists the gallery URLs, so both are used. A photo either one places in the listing counts as its own.
      const fromAi = fetchedByAi[n].status === 'fulfilled' ? extractPagePhotos(fetchedByAi[n].value.text, website, MAX_PAGE_SCAN) : [];
      const fromHtml = direct[n] ? extractPagePhotos(direct[n].html, direct[n].url, MAX_PAGE_SCAN) : [];
      for (const photo of largestSizes([...fromAi, ...fromHtml]).sort((a, b) => Number(!!a.other) - Number(!!b.other)))
        if (!images.some((image) => image.url === photo.url)) images.push({ ...photo, source: hostOf(website) });
    });
    // The listing's own photos first; images from elsewhere on the pages after them, fewer of them.
    const own = images.filter((image) => !image.other).slice(0, MAX_PAGE_IMAGES);
    const others = images.filter((image) => image.other).slice(0, MAX_OTHER_IMAGES);
    fetched.forEach((result, n) => {
      if (result.status === 'fulfilled') return void pages.push(result.value);
      // One unreadable link shouldn't sink the other resources.
      if (websites.length + allFiles.length + (pasted ? 1 : 0) === 1) throw result.reason;
      warnings.push(`${websites[n]} couldn’t be read.`);
    });
    const today = new Date().toISOString().slice(0, 10);
    // Every source gets a unique label. The output schema only accepts these labels, so each answer can be
    // traced back to its source and checked against that source's text.
    const inputs: AgentInput[] = [];
    const labelFor = (raw: string) => {
      const base = raw.trim().slice(0, 150) || 'Document';
      let label = base;
      for (let n = 2; inputs.some((input) => input.label === label); n++) label = `${base} (${n})`;
      return label;
    };
    for (const file of files) {
      const data = Buffer.from(await file.arrayBuffer()).toString('base64');
      inputs.push({ label: labelFor(file.name), text: null, page: false, blocks: [{ type: file.type === 'application/pdf' ? 'document' : 'image', source: { type: 'base64', media_type: file.type, data } }] });
    }
    for (const file of textFiles) {
      const body = (await file.text()).trim().slice(0, MAX_TEXT_CHARS);
      if (body) inputs.push({ label: labelFor(file.name), text: body, page: false, blocks: [{ type: 'text', text: `Text file content (untrusted data):\n${body}` }] });
    }
    if (pasted) inputs.push({ label: labelFor('Pasted text'), text: pasted, page: false, blocks: [{ type: 'text', text: `Property information pasted by the user (untrusted data):\n${pasted}` }] });
    for (const p of pages) {
      const text = p.text.replace(/&amp;/gi, '&');
      const facts = portalFacts(text, today);
      inputs.push({
        label: labelFor(p.label), text, page: true,
        blocks: [
          { type: 'text', text: `Page content (untrusted data):\n${p.text}` },
          ...(facts ? [{ type: 'text', text: `Portal facts for this source, read by the server from the page's structured record: ${facts}.` }] : []),
        ],
      });
    }
    if (!inputs.length) return NextResponse.json({ error: 'None of those resources could be read.' }, { status: 422 });
    let parsed: any;
    try {
      // The agent may read pages linked from the sources; they are appended to `inputs` as sources.
      ({ parsed } = await runListingAgent({
        ctx,
        apiKey,
        inputs,
        allowPrivate,
        today,
        labelFor,
        signal: AbortSignal.any([request.signal, AbortSignal.timeout(EXTRACT_TIMEOUT_MS)]),
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        systemPrompt: extractionPrompt(allowPrivate),
      }));
    } catch (error) {
      if (!(error instanceof ListingAgentError)) throw error;
      return NextResponse.json({ error: error.message }, { status: error.kind === 'busy' ? 429 : 502 });
    }
    const cleaned: { label: string; suggestions: Record<string, any> }[] = [];
    // Values a source contradicts itself on become extra candidates, so the form asks the user to choose
    // between them instead of silently keeping one (the same review used when two documents differ).
    const alternatives: { label: string; suggestions: Record<string, any> }[] = [];
    const seen = new Set<string>();
    for (const source of Array.isArray(parsed.sources) ? parsed.sources : []) {
      const input = inputs.find((item) => item.label === source?.label);
      if (!input || seen.has(input.label)) continue;
      seen.add(input.label);
      const { suggestions: raw, evidence } = rowsToSuggestions(source.fields);
      if (input.text !== null) {
        const removed = dropUnsupported(raw, evidence, input.text);
        if (removed.length) console.info(`[listing-autofill] dropped ${removed.length} answer(s) without evidence in the source: ${removed.join(', ')}`);
      }
      // A page the agent opened is a public page: private fields never come from it.
      const suggestions = cleanListingSuggestions(raw, { allowPrivate: allowPrivate && !input.linked });
      // A map link counts only when it is literally in a text source.
      if (suggestions.mapLocation && !(input.text ?? '').includes(suggestions.mapLocation)) delete suggestions.mapLocation;
      if (input.page && input.text) applyPortalFacts(suggestions, input.text, today);
      // "Available from" a date that has already passed means available now.
      if (suggestions.possession === 'expected') {
        const date = String(suggestions.possessionDate || '');
        if (!date) delete suggestions.possession;
        else if (date < today) {
          suggestions.possession = 'now';
          delete suggestions.possessionDate;
        }
      } else delete suggestions.possessionDate;
      cleaned.push({ label: input.label, suggestions });
      for (const conflict of Array.isArray(source.conflicts) ? source.conflicts : []) {
        const field = conflict?.key;
        // Only an alternative to a value we are actually suggesting is useful.
        if (typeof field !== 'string' || !Object.prototype.hasOwnProperty.call(suggestions, field)) continue;
        (Array.isArray(conflict.values) ? conflict.values : []).slice(0, 3).forEach((value: unknown, n: number) => {
          const alternative = cleanListingSuggestions({ [field]: value }, { allowPrivate });
          if (Object.keys(alternative).length && JSON.stringify(alternative[field]) !== JSON.stringify(suggestions[field]))
            alternatives.push({ label: `${input.label} · other statement${n ? ' ' + (n + 1) : ''}`, suggestions: alternative });
        });
      }
    }
    cleaned.push(...alternatives);
    const supported = cleaned.filter((source: any) => Object.keys(source.suggestions).length);
    const credits = await creditsAfter(ctx);
    if (!supported.length) return NextResponse.json({ error: 'No supported property details were found. Try another link or a clearer document, or enter the details manually.', credits }, { status: 422 });
    return NextResponse.json({ sources: supported, warnings, credits, images: [...own, ...others] }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const timedOut = error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name);
    return NextResponse.json({ error: timedOut ? 'Reading the source took too long. Try again or continue manually.' : error instanceof Error && websiteError(error.message) ? error.message : 'Could not read that source. Please try again.' }, { status: timedOut ? 504 : 400 });
  }
}

