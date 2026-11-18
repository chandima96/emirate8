import 'server-only';
import type { AiFeature } from '@/collections/AiUsage';
import { recordAiUsage, type AiContext } from './aiCredits';

export const DEFAULT_ANTHROPIC_MODEL = 'claude-haiku-4-5-20251001';
export const anthropicModel = () => process.env.ANTHROPIC_MODEL || DEFAULT_ANTHROPIC_MODEL;

/**
 * Every Claude call goes through here so its token usage is charged to the member's AI credits.
 * Returns the raw response and parsed body; callers keep their own error handling.
 */
export async function callClaude(options: {
  ctx: AiContext;
  feature: AiFeature;
  apiKey: string;
  body: Record<string, unknown>;
  beta?: string;
  signal?: AbortSignal;
}) {
  const model = typeof options.body.model === 'string' ? options.body.model : anthropicModel();
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': options.apiKey,
      'anthropic-version': '2023-06-01',
      ...(options.beta ? { 'anthropic-beta': options.beta } : {}),
    },
    signal: options.signal,
    body: JSON.stringify({ ...options.body, model }),
  });
  const payload: any = await response.json().catch(() => null);
  if (payload?.usage) {
    await recordAiUsage(options.ctx, {
      feature: options.feature,
      model: payload.model || model,
      usage: payload.usage,
      status: response.ok ? 'ok' : 'error',
      requestId: response.headers.get('request-id') || payload.id || '',
    });
  }
  return { response, payload };
}

/** Adapter for helpers that take an injected caller (keeps them free of Payload imports). */
export const claudeCaller = (ctx: AiContext, apiKey: string, feature: AiFeature) =>
  (body: Record<string, unknown>, beta?: string, signal?: AbortSignal) => callClaude({ ctx, feature, apiKey, body, beta, signal });
