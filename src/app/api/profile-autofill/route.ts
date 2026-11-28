import { NextResponse } from 'next/server';
import { getSession } from '@/lib/server/session';
import { creditsAfter, startAiRequest } from '@/lib/server/aiCredits';
import { checkedUrl, isBayutHost, readWebsite } from '@/lib/server/profileAutofill/website';
import { claudeExtract, claudeFetchWebsiteText, logStage, type ProfileKind, type ProfileSource } from '@/lib/server/profileAutofill/extraction';

export const runtime = 'nodejs';
export const maxDuration = 300;

const MAX_FILE_SIZE = 20 * 1024 * 1024;
// One Messages request is at most 32 MB and base64 makes files ~4/3 larger, so 22 MB of files fit.
const MAX_TOTAL_FILE_SIZE = 22 * 1024 * 1024;
const MAX_DOCUMENTS = 12;
const MAX_WEBSITES = 5;
const MIME_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);
const DEFAULT_ANTHROPIC_MODEL = 'claude-haiku-4-5-20251001';

export async function POST(request: Request) {
  const session = await getSession(request.headers);
  if (!session.data.user) return NextResponse.json({ error: 'Sign in to use profile autofill.' }, { status: 401 });
  if (!['broker', 'agency', 'developer'].includes(session.data.user.type)) return NextResponse.json({ error: 'Profile autofill is for broker, agency and developer accounts.' }, { status: 403 });
  // toAppUser maps legacy "owner" accounts to "developer".
  const kind: ProfileKind = session.data.user.type === 'developer' ? 'developer' : 'professional';
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'Claude is not configured. Add ANTHROPIC_API_KEY to the server environment.' }, { status: 503 });
  const gate = await startAiRequest(session.data.user.id);
  if (gate.blocked) return gate.blocked;
  const ctx = gate.ctx;

  let currentStage = 'request parsing';
  const requestStartedAt = Date.now();
  try {
    const form = await request.formData();
    const allFiles = form.getAll('files').filter((value): value is File => value instanceof File && value.size > 0);
    const legacyFile = form.get('file');
    if (!allFiles.length && legacyFile instanceof File && legacyFile.size > 0) allFiles.push(legacyFile);
    // Plain-text files are read here; PDFs and images go to the model as documents.
    const isText = (file: File) => file.type === 'text/plain' || /\.txt$/i.test(file.name);
    const textFiles = allFiles.filter(isText);
    const uploadedFiles = allFiles.filter((file) => !isText(file));
    const websites = form.getAll('website').filter((value): value is string => typeof value === 'string' && Boolean(value.trim())).map((value) => value.trim());
    const pastedValue = form.get('text');
    const pasted = typeof pastedValue === 'string' ? pastedValue.trim().slice(0, 60000) : '';
    const existing = form.get('profile');
    if (allFiles.length > MAX_DOCUMENTS) return NextResponse.json({ error: `Choose up to ${MAX_DOCUMENTS} documents at a time.` }, { status: 400 });
    if (websites.length > MAX_WEBSITES) return NextResponse.json({ error: `Add up to ${MAX_WEBSITES} links at a time.` }, { status: 400 });
    if (uploadedFiles.some((file) => !MIME_TYPES.has(file.type))) return NextResponse.json({ error: 'Upload PDF, TXT, JPG, PNG or WebP documents only.' }, { status: 400 });
    if (allFiles.some((file) => file.size > MAX_FILE_SIZE)) return NextResponse.json({ error: 'Each document must be 20 MB or smaller.' }, { status: 400 });
    if (allFiles.reduce((total, file) => total + file.size, 0) > MAX_TOTAL_FILE_SIZE) {
      return NextResponse.json({ error: 'The combined document size must be 22 MB or smaller.' }, { status: 400 });
    }
    if (!pasted && !allFiles.length && !websites.length) return NextResponse.json({ error: 'Add documents, paste your details or add a link to analyze.' }, { status: 400 });
    let current: any = {};
    if (typeof existing === 'string') { try { current = JSON.parse(existing); } catch { /* ignore invalid optional context */ } }
    const list = (v: unknown) => (Array.isArray(v) ? v.filter((item: unknown) => typeof item === 'string').slice(0, 20) : []);
    const profileContext = kind === 'developer' ? {
      displayName: typeof current.displayName === 'string' ? current.displayName.slice(0, 120) : '',
      projectTypes: list(current.projectTypes),
      areas: list(current.areas),
      projects: Array.isArray(current.projects) ? current.projects.map((p: any) => String(p?.name || '').slice(0, 100)).filter(Boolean).slice(0, 20) : [],
    } : {
      displayName: typeof current.displayName === 'string' ? current.displayName.slice(0, 120) : '',
      title: typeof current.title === 'string' ? current.title.slice(0, 120) : '',
      agencyName: typeof current.agency?.name === 'string' ? current.agency.name.slice(0, 120) : '',
      areas: Array.isArray(current.areas) ? current.areas.filter((item: unknown) => typeof item === 'string').slice(0, 20) : [],
      specialties: Array.isArray(current.specialties) ? current.specialties.filter((item: unknown) => typeof item === 'string').slice(0, 20) : [],
    };
    const model = process.env.ANTHROPIC_MODEL || DEFAULT_ANTHROPIC_MODEL;
    const sources: ProfileSource[] = [];
    const warnings: string[] = [];
    // Labels must be unique: the output schema only accepts these labels, and each answer is checked
    // against its own source's text (null for PDFs and images, which are not checked).
    const addSource = (label: string, content: ProfileSource['content'], text: string | null) => {
      let unique = label;
      for (let n = 2; sources.some((source) => source.label === unique); n++) unique = `${label} (${n})`;
      sources.push({ label: unique, content, text });
    };

    if (pasted) addSource('Pasted text', [{ type: 'text', text: `Profile information pasted by the user (untrusted data):\n${pasted}` }], pasted);
    for (const file of textFiles) {
      const body = (await file.text()).trim().slice(0, 60000);
      if (body) addSource(`Document · ${file.name.slice(0, 100)}`, [{ type: 'text', text: `Text file ${file.name.slice(0, 160)}:\n${body}` }], body);
      else warnings.push(`${file.name} is empty.`);
    }
    for (const website of websites) {
      const websiteUrl = await checkedUrl(website);
      let websiteText = '';
      if (!isBayutHost(websiteUrl.hostname)) {
        currentStage = 'direct website read';
        const directFetchStartedAt = Date.now();
        logStage(currentStage, directFetchStartedAt, 'started');
        try {
          websiteText = await readWebsite(websiteUrl.toString());
          logStage(currentStage, directFetchStartedAt, 'completed');
        } catch (error) {
          const timedOut = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
          logStage(currentStage, directFetchStartedAt, timedOut ? 'timed out' : 'failed');
          // Some public sites block direct server requests. Fall back to the
          // provider fetch, restricted to this same host.
        }
      }
      try {
        currentStage = 'Claude website fetch';
        const pageText = websiteText || await claudeFetchWebsiteText(websiteUrl, apiKey, model, ctx);
        addSource(`Website · ${websiteUrl.hostname}`, [{ type: 'text', text: pageText }], pageText);
      } catch (error) {
        // One unreadable link shouldn't sink the other resources.
        if (websites.length + allFiles.length + (pasted ? 1 : 0) === 1) throw error;
        warnings.push(`${websiteUrl.hostname} couldn’t be read.`);
      }
    }
    for (const [index, file] of uploadedFiles.entries()) {
      const data = Buffer.from(await file.arrayBuffer()).toString('base64');
      const fileContent = file.type === 'application/pdf'
        ? { type: 'document', source: { type: 'base64', media_type: file.type, data } }
        : { type: 'image', source: { type: 'base64', media_type: file.type, data } };
      addSource(`Document ${index + 1} · ${file.name.slice(0, 100)}`, [{ type: 'text', text: `Uploaded document ${index + 1}: ${file.name.slice(0, 160)}` }, fileContent], null);
    }
    if (!sources.length) return NextResponse.json({ error: 'None of those resources could be read.' }, { status: 422 });

    currentStage = 'Claude profile extraction';
    const results = await claudeExtract(sources, apiKey, model, profileContext, ctx, kind);
    logStage('request_total', requestStartedAt, 'completed');
    return NextResponse.json({ sources: results, warnings, credits: await creditsAfter(ctx) });
  } catch (error) {
    if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      console.error(`[profile-autofill] stage=${currentStage} result=timed_out durationMs=${Date.now() - requestStartedAt}`, error.name, error.message);
      return NextResponse.json({ error: `Timed out during ${currentStage}. Please retry shortly.` }, { status: 504 });
    }
    const message = error instanceof Error ? error.message : '';
    // Tokens may have been spent before the failure, so return the updated balance too.
    return NextResponse.json({ error: message || 'Could not analyze those resources. Please try again.', credits: await creditsAfter(ctx) }, { status: 400 });
  }
}
