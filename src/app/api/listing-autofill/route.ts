import { NextResponse } from 'next/server';
import { getSession } from '@/lib/server/session';
import { alignPriceKey, cleanListingSuggestions, listingAiOutputSchema, rowsToSuggestions } from '@/lib/listingAutofill';
import { pageClassification, explicitlyReadyForOccupancy, extractionPrompt, readListingWebsite, portalFacts, dropUnsupported } from '@/lib/listingAutofillServer';

export const runtime = 'nodejs';
export const maxDuration = 120;

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
    const projectText = text.split(/Similar Projects/i, 1)[0];
    if (
      facts.devStatus === 'offplan' &&
      /starting price/i.test(projectText) &&
      /payment plan/i.test(projectText) &&
      /developer/i.test(projectText) &&
      !/(?:resale|secondary market)/i.test(projectText)
    ) suggestions.txn = 'initial';
    // A completed building has no construction stage or handover quarter to offer.
    if (facts.devStatus === 'ready') for (const k of ['stage', 'handoverQ', 'handoverY']) delete suggestions[k];
  }
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

  try {
    const form = await request.formData();
    const allFiles = form.getAll('files').filter((file): file is File => file instanceof File && file.size > 0);
    // Plain-text files are read here; PDFs and images go to the model as documents.
    const isText = (file: File) => file.type === 'text/plain' || /\.txt$/i.test(file.name);
    const files = allFiles.filter((file) => !isText(file));
    const textFiles = allFiles.filter(isText);
    const websites = form.getAll('website').filter((value): value is string => typeof value === 'string' && Boolean(value.trim())).map((value) => value.trim());
    const pastedValue = form.get('text');
    const pasted = typeof pastedValue === 'string' ? pastedValue.trim().slice(0, 20000) : '';
    if (!pasted && !allFiles.length && !websites.length) return NextResponse.json({ error: 'Add documents, paste property details or add a link to analyze.' }, { status: 400 });
    if (allFiles.length > 8 || websites.length > 3) return NextResponse.json({ error: 'Add up to eight documents and three links at a time.' }, { status: 400 });
    if (files.some((file) => !['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(file.type))) return NextResponse.json({ error: 'Upload PDF, TXT, JPG, PNG or WebP documents only.' }, { status: 400 });
    if (allFiles.some((file) => file.size > 20 * 1024 * 1024) || allFiles.reduce((total, file) => total + file.size, 0) > 50 * 1024 * 1024)
      return NextResponse.json({ error: 'Each file must be 20 MB or smaller, with a combined limit of 50 MB.' }, { status: 400 });

    // Private identifiers are only ever read from documents the user uploaded or pasted, not public pages.
    const allowPrivate = websites.length === 0;
    const warnings: string[] = [];
    const pages: { label: string; text: string }[] = [];
    for (const website of websites) {
      try {
        pages.push(await readListingWebsite(website, apiKey, request.signal));
      } catch (error) {
        // One unreadable link shouldn't sink the other resources.
        if (websites.length + allFiles.length + (pasted ? 1 : 0) === 1) throw error;
        warnings.push(`${website} couldn’t be read.`);
      }
    }
    const today = new Date().toISOString().slice(0, 10);
    // Every source gets a unique label. The output schema only accepts these labels, so each answer can be
    // traced back to its source and checked against that source's text.
    type Input = { label: string; blocks: any[]; text: string | null; page: boolean };
    const inputs: Input[] = [];
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
      const body = (await file.text()).trim().slice(0, 20000);
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
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(70_000)]),
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001',
        max_tokens: 16000,
        // The prompt is identical for every request of the same kind, so it is cached.
        system: [{ type: 'text', text: extractionPrompt(allowPrivate), cache_control: { type: 'ephemeral' } }],
        messages: [{
          role: 'user',
          content: [
            ...inputs.flatMap((input) => [{ type: 'text', text: `Source: ${input.label}` }, ...input.blocks]),
            { type: 'text', text: `Today is ${today}. Answer for each source: ${inputs.map((input) => JSON.stringify(input.label)).join(', ')}.` },
          ],
        }],
        // Structured outputs: the reply always matches this schema, so it always parses.
        output_config: { format: { type: 'json_schema', schema: listingAiOutputSchema(allowPrivate, inputs.map((input) => input.label)) } },
      }),
    });
    const result = await response.json();
    if (!response.ok) {
      console.error('[listing-autofill] Provider request failed:', response.status, result?.error?.type, result?.error?.message?.slice?.(0, 300));
      return NextResponse.json({ error: response.status === 429 ? 'Document assistance is busy. Please try again shortly.' : 'The documents could not be analyzed. Try a clearer or smaller document.' }, { status: response.status === 429 ? 429 : 502 });
    }
    // A cut-off or declined answer may not match the schema.
    if (result.stop_reason === 'max_tokens' || result.stop_reason === 'refusal') {
      console.error('[listing-autofill] Incomplete answer:', result.stop_reason);
      return NextResponse.json({ error: 'The documents could not be fully analyzed. Try fewer or smaller documents at a time.' }, { status: 502 });
    }
    const text = (result.content || []).filter((block: any) => block.type === 'text').map((block: any) => block.text).join('').trim();
    const parsed = JSON.parse(text);
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
      const suggestions = cleanListingSuggestions(raw, { allowPrivate });
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
    if (!supported.length) return NextResponse.json({ error: 'No supported property details were found. Try another link or a clearer document, or enter the details manually.' }, { status: 422 });
    return NextResponse.json({ sources: supported, warnings }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const timedOut = error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name);
    return NextResponse.json({ error: timedOut ? 'Reading the source took too long. Try again or continue manually.' : error instanceof Error && websiteError(error.message) ? error.message : 'Could not read that source. Please try again.' }, { status: timedOut ? 504 : 400 });
  }
}

