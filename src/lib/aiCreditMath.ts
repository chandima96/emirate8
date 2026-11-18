/* Pure AI-credit arithmetic (no server imports), shared by src/lib/server/aiCredits.ts and the tests. */

export const AI_CREDIT_WEIGHTS = { input: 1, output: 5, cacheWrite: 1.25, cacheRead: 0.1 };

export type ClaudeUsage = {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
  server_tool_use?: { web_fetch_requests?: number };
};

export function creditsFromUsage(usage: ClaudeUsage | null | undefined) {
  if (!usage) return 0;
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0);
  const weighted =
    n(usage.input_tokens) * AI_CREDIT_WEIGHTS.input +
    n(usage.output_tokens) * AI_CREDIT_WEIGHTS.output +
    n(usage.cache_creation_input_tokens) * AI_CREDIT_WEIGHTS.cacheWrite +
    n(usage.cache_read_input_tokens) * AI_CREDIT_WEIGHTS.cacheRead;
  return Math.ceil(weighted / 1000);
}

/** Credits reset on the 1st of each month, Dubai time (UTC+4, no daylight saving). */
const DUBAI_OFFSET_MS = 4 * 60 * 60 * 1000;
export function creditPeriod(now = new Date()) {
  const local = new Date(now.getTime() + DUBAI_OFFSET_MS);
  const start = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1) - DUBAI_OFFSET_MS);
  const resetsAt = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth() + 1, 1) - DUBAI_OFFSET_MS);
  return { start, resetsAt };
}

