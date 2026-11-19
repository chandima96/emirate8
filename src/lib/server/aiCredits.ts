import 'server-only';
import { NextResponse } from 'next/server';
import configPromise from '@payload-config';
import { getPayload } from 'payload';
import { PLAN_CATALOG, planIdForAudience } from '@/config/plans';
import type { AiFeature } from '@/collections/AiUsage';

/* AI credits: 1 credit = 1,000 input-token equivalents (≈ US$0.001 on Claude Haiku 4.5).
 * Balances are never stored: each account's monthly allowance minus the credits in its `ai-usage`
 * rows for the current month. Agency seats draw from the agency owner's pool. See AI-credits.md. */

export { AI_CREDIT_WEIGHTS, creditsFromUsage, creditPeriod, type ClaudeUsage } from '@/lib/aiCreditMath';
import { creditsFromUsage, creditPeriod, type ClaudeUsage } from '@/lib/aiCreditMath';

export const aiCreditsEnforced = () => process.env.AI_CREDITS_ENFORCE !== 'false';

async function payloadClient() {
  return getPayload({ config: await configPromise });
}

const AUDIENCES = ['broker', 'agency', 'developer'] as const;
type Audience = (typeof AUDIENCES)[number];
const audienceOf = (accountType: string): Audience => (accountType === 'owner' ? 'developer' : (AUDIENCES as readonly string[]).includes(accountType) ? (accountType as Audience) : 'broker');

/** The account whose credits a member spends: agency seats use the agency owner's pool, everyone else their own. */
async function resolvePool(payload: Awaited<ReturnType<typeof payloadClient>>, memberId: number | string) {
  const member: any = await payload.findByID({ collection: 'members', id: memberId, depth: 0, overrideAccess: true });
  let pool: any = member;
  const agencyId = member.profile?.agency?.agencyId || member.profile?.agencyId;
  if (agencyId && member.profile?.agency?.agencyRole !== 'agency_admin') {
    const owner = await payload.find({
      collection: 'members',
      where: { and: [{ 'profile.agency.agencyId': { equals: agencyId } }, { 'profile.agency.agencyRole': { equals: 'agency_admin' } }] },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    });
    if (owner.docs[0]) pool = owner.docs[0];
  }
  const planId = planIdForAudience(pool.plan, audienceOf(pool.accountType));
  const found = await payload.find({ collection: 'plans', where: { slug: { equals: planId } }, limit: 1, depth: 0, overrideAccess: true });
  const stored = (found.docs[0] as any)?.aiCredits;
  const allowance = typeof stored === 'number' ? stored : PLAN_CATALOG[planId]?.aiCredits ?? 0;
  return { poolId: pool.id as number | string, planId, allowance, shared: String(pool.id) !== String(member.id) };
}

export type CreditStatus = {
  allowance: number;
  used: number;
  remaining: number;
  resetsAt: string;
  shared: boolean;
  enforced: boolean;
  byFeature: Partial<Record<AiFeature, number>>;
};

export type AiContext = { memberId: number | string; poolId: number | string };

export async function getCreditStatus(memberId: number | string): Promise<CreditStatus & AiContext> {
  const payload = await payloadClient();
  const { poolId, allowance, shared } = await resolvePool(payload, memberId);
  const { start, resetsAt } = creditPeriod();
  const rows = await payload.find({
    collection: 'ai-usage',
    where: { and: [{ pool: { equals: poolId } }, { createdAt: { greater_than_equal: start.toISOString() } }] },
    pagination: false,
    depth: 0,
    select: { credits: true, feature: true },
    overrideAccess: true,
  });
  const byFeature: Partial<Record<AiFeature, number>> = {};
  let used = 0;
  for (const row of rows.docs as any[]) {
    const credits = Number(row.credits) || 0;
    used += credits;
    byFeature[row.feature as AiFeature] = (byFeature[row.feature as AiFeature] || 0) + credits;
  }
  return { memberId, poolId, allowance, used, remaining: Math.max(0, allowance - used), resetsAt: resetsAt.toISOString(), shared, enforced: aiCreditsEnforced(), byFeature };
}

/** The `credits` object AI routes return, so the UI can update the balance without another request. */
export const publicCredits = ({ allowance, used, remaining, resetsAt, shared, enforced }: CreditStatus) => ({ allowance, used, remaining, resetsAt, shared, enforced });

/**
 * Call before any AI work. Returns a 402 response when the account has no credits left this month,
 * otherwise the context used to charge each Claude call. The call in progress is charged at its real usage,
 * so a balance can dip a little below zero once; after that AI is blocked until the reset.
 */
export async function startAiRequest(memberId: number | string): Promise<{ blocked: NextResponse; ctx?: never } | { blocked?: never; ctx: AiContext }> {
  try {
    const status = await getCreditStatus(memberId);
    if (status.enforced && status.allowance - status.used <= 0) {
      const reset = new Date(status.resetsAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', timeZone: 'Asia/Dubai' });
      return {
        blocked: NextResponse.json(
          {
            error: `You have used all ${status.allowance.toLocaleString('en-US')} AI credits for this month${status.shared ? ' on your agency plan' : ''}. Credits reset on ${reset}. Upgrade your plan for more, or continue entering details manually.`,
            code: 'ai_credits_exhausted',
            credits: publicCredits(status),
          },
          { status: 402 },
        ),
      };
    }
    return { ctx: { memberId, poolId: status.poolId } };
  } catch (error) {
    // A ledger problem must not take the AI features down; charge the member's own pool.
    console.error('[ai-credits] balance check failed:', error instanceof Error ? error.message : error);
    return { ctx: { memberId, poolId: memberId } };
  }
}

export async function creditsAfter(ctx: AiContext) {
  try {
    return publicCredits(await getCreditStatus(ctx.memberId));
  } catch {
    return null;
  }
}

/** `ctx` is null for platform work (e.g. the SEO content agent): the row is logged without charging any pool. */
export async function recordAiUsage(ctx: AiContext | null, entry: { feature: AiFeature; model?: string; usage: ClaudeUsage | null; status: 'ok' | 'error'; requestId?: string }) {
  const usage = entry.usage || {};
  try {
    const payload = await payloadClient();
    await payload.create({
      collection: 'ai-usage',
      data: {
        member: ctx?.memberId ?? null,
        pool: ctx?.poolId ?? null,
        feature: entry.feature,
        model: entry.model || '',
        inputTokens: usage.input_tokens || 0,
        outputTokens: usage.output_tokens || 0,
        cacheCreationTokens: usage.cache_creation_input_tokens || 0,
        cacheReadTokens: usage.cache_read_input_tokens || 0,
        webFetchRequests: usage.server_tool_use?.web_fetch_requests || 0,
        credits: creditsFromUsage(usage),
        status: entry.status,
        requestId: entry.requestId || '',
      } as any,
      overrideAccess: true,
    });
  } catch (error) {
    console.error('[ai-credits] could not record usage:', entry.feature, error instanceof Error ? error.message : error);
  }
}
