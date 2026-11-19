/*
 * Deterministic checks used by the listing autofill agent (src/lib/server/listingAutofillAgent.ts).
 * Kept free of server-only imports so they can be unit-tested.
 */
import { rowsToSuggestions } from './listingAutofill';
import { dropUnsupported } from './listingAutofillServer';

/** One thing the agent read: an uploaded file, pasted text or a web page. `text` is null for PDFs and images. */
export type AgentInput = { label: string; blocks: any[]; text: string | null; page: boolean; linked?: boolean };

const URL_RE = /https?:\/\/[^\s<>"'`)\]}]+/gi;

/** URLs written in the sources' text, with trailing punctuation removed. */
export function urlsIn(texts: (string | null)[]) {
  const urls = new Set<string>();
  for (const text of texts) {
    for (const match of String(text || '').matchAll(URL_RE)) urls.add(match[0].replace(/[.,;:!?]+$/, ''));
  }
  return urls;
}

/**
 * The agent may only open a link that is written, exactly, in a source it already read. It can't build
 * URLs, so a page that tells it to visit an address with the user's data in the query string gets nowhere.
 */
export function linkAllowed(url: string, inputs: AgentInput[]) {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) return false;
  return urlsIn(inputs.map((i) => i.text)).has(url);
}

export type EvidenceProblem = { label: string; key: string; quote: string };

/**
 * Answers the evidence check would drop: their quote is not in the text source they claim to come from.
 * PDFs and images (no text on the server) are not checked, as in the route.
 */
export function evidenceProblems(parsed: any, inputs: AgentInput[]): EvidenceProblem[] {
  const problems: EvidenceProblem[] = [];
  for (const source of Array.isArray(parsed?.sources) ? parsed.sources : []) {
    const input = inputs.find((i) => i.label === source?.label);
    if (!input || input.text === null) continue;
    const { suggestions, evidence } = rowsToSuggestions(source.fields);
    const removed = dropUnsupported(structuredClone(suggestions), evidence, input.text);
    for (const entry of removed) {
      // "key" or "key:value" (one item of a list).
      const colon = entry.indexOf(':');
      const key = colon > -1 ? entry.slice(0, colon) : entry;
      const item = colon > -1 ? entry.slice(colon + 1) : '';
      const quotes = evidence[key];
      let quote = Array.isArray(quotes) ? quotes.join(' | ') : quotes || '';
      if (item && Array.isArray(quotes) && Array.isArray(suggestions[key])) {
        const i = suggestions[key].findIndex((v: unknown) => String(v) === item);
        if (i > -1) quote = quotes[i] || '';
      }
      problems.push({ label: input.label, key: item ? `${key} (${item})` : key, quote });
    }
  }
  return problems;
}

export function evidenceFeedback(problems: EvidenceProblem[]) {
  return (
    'Not saved yet. These answers will be dropped because their evidence is not in the source text. For each, copy a short quote exactly as it appears in that source, or leave the answer out, then call submit_listing again with all sources:\n' +
    problems.map((p) => `- ${p.label} › ${p.key}: quote ${JSON.stringify(p.quote)} was not found`).join('\n')
  );
}
