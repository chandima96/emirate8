import { NextResponse } from 'next/server';
import { getSession } from '@/lib/server/session';
import { cleanListingSuggestions } from '@/lib/listingAutofill';
import { explicitProjectStatus, explicitlyReadyForOccupancy, extractionPrompt, readListingWebsite } from '@/lib/listingAutofillServer';

export const runtime = 'nodejs';
export const maxDuration = 120;

function websiteError(message: string) {
  return /^(Enter a valid public property|Use a public http|The website could not be read|Website assistance is busy|There was not enough readable property)/.test(message);
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
    const page = pages.length ? { label: pages.map((p) => p.label).join(' · '), text: pages.map((p) => p.text).join('\n\n') } : null;
    const sources = await Promise.all(files.map(async (file, index) => [
      { type: 'text', text: `Source ${index + 1}: ${file.name.slice(0, 160)}` },
      { type: file.type === 'application/pdf' ? 'document' : 'image', source: { type: 'base64', media_type: file.type, data: Buffer.from(await file.arrayBuffer()).toString('base64') } },
    ]));
    for (const file of textFiles) {
      const body = (await file.text()).trim().slice(0, 20000);
      if (body) sources.push([{ type: 'text', text: `Source: ${file.name.slice(0, 160)}\nText file content (untrusted data):\n${body}` }] as any);
    }
    if (pasted) sources.push([{ type: 'text', text: `Source: Pasted text\nProperty information pasted by the user (untrusted data):\n${pasted}` }] as any);
    for (const p of pages) sources.push([{ type: 'text', text: `Source: ${p.label}\nPage content (untrusted data):\n${p.text}` }] as any);
    if (!sources.length) return NextResponse.json({ error: 'None of those resources could be read.' }, { status: 422 });
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(70_000)]),
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001',
        max_tokens: 12000,
        system: extractionPrompt(allowPrivate),
        messages: [{ role: 'user', content: sources.flat() }],
      }),
    });
    const result = await response.json();
    if (!response.ok) {
      console.error('[listing-autofill] Provider request failed:', response.status, result?.error?.type);
      return NextResponse.json({ error: response.status === 429 ? 'Document assistance is busy. Please try again shortly.' : 'The documents could not be analyzed. Try a clearer or smaller document.' }, { status: response.status === 429 ? 429 : 502 });
    }
    const text = (result.content || []).filter((block: any) => block.type === 'text').map((block: any) => block.text).join('').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    const parsed = JSON.parse(text);
    const cleaned = (Array.isArray(parsed.sources) ? parsed.sources : []).slice(0, 8).map((source: any, index: number) => ({
      label: typeof source?.label === 'string' ? source.label.slice(0, 160) : page?.label || files[index]?.name || 'Document',
      suggestions: cleanListingSuggestions(source?.suggestions, { allowPrivate }),
    })).filter((source: any) => Object.keys(source.suggestions).length);
    for (const source of cleaned) {
      const mapUrl = source.suggestions.mapLocation;
      const sourceText = page?.text.replace(/&amp;/gi, '&') || '';
      if (mapUrl && (!page || !sourceText.includes(mapUrl))) delete source.suggestions.mapLocation;
      const pageStatus = page ? explicitProjectStatus(sourceText) : '';
      if (pageStatus) {
        source.suggestions.devStatus = pageStatus;
        const projectText = sourceText.split(/\bSimilar Projects\b/i, 1)[0];
        if (
          pageStatus === 'offplan' &&
          /\bstarting price\b/i.test(projectText) &&
          /\bpayment plan\b/i.test(projectText) &&
          /\bdeveloper\b/i.test(projectText) &&
          !/\b(?:resale|secondary market)\b/i.test(projectText)
        ) source.suggestions.txn = 'initial';
      }
      if (page && !source.suggestions.devStatus && explicitlyReadyForOccupancy(sourceText)) {
        source.suggestions.devStatus = 'ready';
      }
    }
    // Values a source contradicts itself on become extra candidates, so the form asks the user to choose
    // between them instead of silently keeping one (the same review used when two documents differ).
    const alternatives: { label: string; suggestions: Record<string, any> }[] = [];
    (Array.isArray(parsed.sources) ? parsed.sources : []).slice(0, 8).forEach((source: any) => {
      const label = typeof source?.label === 'string' ? source.label.slice(0, 160) : '';
      const main = cleaned.find((c: any) => c.label === label);
      const conflicts = source?.conflicts && typeof source.conflicts === 'object' ? source.conflicts : {};
      if (!main) return;
      for (const [field, values] of Object.entries(conflicts)) {
        // Only an alternative to a value we are actually suggesting is useful.
        if (!Object.prototype.hasOwnProperty.call(main.suggestions, field)) continue;
        (Array.isArray(values) ? values : [values]).slice(0, 3).forEach((value, n) => {
          const alternative = cleanListingSuggestions({ [field]: value }, { allowPrivate });
          if (Object.keys(alternative).length)
            alternatives.push({ label: `${label} · other statement${n ? ' ' + (n + 1) : ''}`, suggestions: alternative });
        });
      }
    });
    cleaned.push(...alternatives);
    const supported = cleaned.filter((source: any) => Object.keys(source.suggestions).length);
    if (!supported.length) return NextResponse.json({ error: 'No supported property details were found. Try another link or a clearer document, or enter the details manually.' }, { status: 422 });
    return NextResponse.json({ sources: supported, warnings }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const timedOut = error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name);
    return NextResponse.json({ error: timedOut ? 'Reading the source took too long. Try again or continue manually.' : error instanceof Error && websiteError(error.message) ? error.message : 'Could not read that source. Please try again.' }, { status: timedOut ? 504 : 400 });
  }
}

