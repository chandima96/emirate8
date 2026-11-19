import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import configPromise from '@payload-config';
import { getPayload } from 'payload';
import { loadPublicData } from '@/lib/server/publicData';
import { publicBrokers } from '@/lib/server/landing';
import { areaFacts, seoTargets, type SeoTarget } from '@/lib/seoAgent/facts';
import { runSeoAgentFor } from './agent';

/** A page whose run failed is retried after this long (or as soon as its facts change). */
const FAILED_RETRY_MS = 7 * 24 * 3600 * 1000;

/** With SEO_AGENT_AUTO_APPROVE=true, validated content goes live without review. Off by default. */
export const seoAutoApprove = () => process.env.SEO_AGENT_AUTO_APPROVE === 'true';

type Row = { id: number | string; path: string; sourceHash?: string; status?: string; updatedAt?: string };

/** Pages with no content yet, content written from older facts, or a failed run due for retry. */
function pending(targets: SeoTarget[], rows: Map<string, Row>, now = Date.now()) {
  return targets.filter((t) => {
    const row = rows.get(t.path);
    if (!row || row.sourceHash !== t.hash) return true;
    if (row.status === 'failed') return now - new Date(row.updatedAt || 0).getTime() > FAILED_RETRY_MS;
    // Same facts: a draft waits for review, approved stays live, rejected is not rewritten.
    return false;
  });
}

export type SeoRunReport = {
  pages: number;
  pending: number;
  processed: { path: string; status: string; turns: number; error?: string }[];
  stoppedEarly?: string;
};

/**
 * One pass of the SEO content agent: up to `limit` pending pages within `timeBudgetMs` (so a cron call
 * finishes inside the route's time limit). Properties go first, newest listings first in data order.
 */
export async function runSeoAgent({
  limit = 10,
  timeBudgetMs = 240_000,
  paths,
}: { limit?: number; timeBudgetMs?: number; paths?: string[] } = {}): Promise<SeoRunReport> {
  const started = Date.now();
  const payload = await getPayload({ config: await configPromise });
  const data = await loadPublicData();
  const targets = seoTargets(data, publicBrokers(data)).filter((t) => !paths || paths.includes(t.path));
  const { docs } = await payload.find({
    collection: 'seo-content',
    pagination: false,
    depth: 0,
    overrideAccess: true,
    select: { path: true, sourceHash: true, status: true, updatedAt: true },
  });
  const rows = new Map((docs as any[]).map((d) => [d.path, d as Row]));
  const queue = pending(targets, rows);
  const report: SeoRunReport = { pages: targets.length, pending: queue.length, processed: [] };
  const client = new Anthropic();

  for (const target of queue.slice(0, limit)) {
    if (Date.now() - started > timeBudgetMs) {
      report.stoppedEarly = 'time budget reached';
      break;
    }
    let result;
    try {
      result = await runSeoAgentFor(target, target.kind === 'property' ? areaFacts(data.listings || [], target.area) : null, client);
    } catch (error) {
      // Rate limits and outages affect every page: stop and let the next run continue.
      if (error instanceof Anthropic.RateLimitError || error instanceof Anthropic.APIConnectionError || (error instanceof Anthropic.APIError && Number(error.status) >= 500)) {
        report.stoppedEarly = `Claude API unavailable (${error instanceof Anthropic.APIError ? error.status : 'connection'})`;
        break;
      }
      result = { ok: false as const, error: error instanceof Error ? error.message : String(error), model: '', turns: 0 };
    }
    const status = result.ok ? (seoAutoApprove() ? 'approved' : 'draft') : 'failed';
    const fields: Record<string, unknown> = {
      path: target.path,
      kind: target.kind,
      status,
      sourceHash: target.hash,
      model: result.model,
      generatedAt: new Date().toISOString(),
      ...(result.ok
        ? { title: result.draft.title, metaDescription: result.draft.metaDescription, faq: result.draft.faq, issues: result.draft.issues, error: '' }
        : { error: result.error.slice(0, 2000) }),
    };
    const row = rows.get(target.path);
    if (row) await payload.update({ collection: 'seo-content', id: row.id, data: fields as any, overrideAccess: true });
    else await payload.create({ collection: 'seo-content', data: fields as any, overrideAccess: true });
    report.processed.push({ path: target.path, status, turns: result.turns, ...(result.ok ? {} : { error: result.error }) });
  }
  return report;
}
