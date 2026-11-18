# AI Credits

## 1. Context

Every AI feature in Emirate08 calls Claude **Haiku 4.5** (`claude-haiku-4-5-20251001`, which `ANTHROPIC_MODEL` can override) with raw `fetch`. Nothing records how many tokens are used, either per user or per feature. The only usage figures today are the totals in the Anthropic Console, per API key. That page is the quickest way to see what is being spent right now, but it can't be broken down by user.

Goal: give each subscription plan a monthly AI-credit allowance, charge every AI call against it, and show users their balance.

**Decisions made**
- **Unit:** weighted tokens. **1 credit = 1,000 input-token equivalents ≈ US$0.001.**
- **Pool:** one shared balance per account. Agency and developer seats draw from the account's pool, and usage is still recorded per seat.
- **At zero:** AI actions are blocked with an upgrade prompt. Manual entry keeps working.

## 2. Credit formula

Haiku 4.5 prices: input $1/MTok, output $5/MTok, cache write 1.25×, cache read 0.1×.

```
weighted = input_tokens
         + 5    × output_tokens
         + 1.25 × cache_creation_input_tokens
         + 0.1  × cache_read_input_tokens
credits  = ceil(weighted / 1000)
```

- Every field comes from `payload.usage` in each Messages API response.
- Content fetched by `web_fetch` and PDF or image pages is billed as ordinary **input tokens**, so the formula covers it. A PDF costs roughly 1.5k–3k tokens per page.
- Keep the weights in one config object (`AI_CREDIT_WEIGHTS`) so they can be changed if the model changes. Haiku 5.5, for example, costs about a tenth as much.

## 3. Where tokens are spent today (measured 2026-11-18)

Each operation was run once against the live API on `claude-haiku-4-5-20251001`, using the app's own prompts and request settings (`extractionPrompt`, `readListingWebsite`, and the translate and profile request bodies). Token counts come from the `usage` object Claude returned. Credits follow the formula in section 2.

| Operation | Claude calls | Input tokens | Output tokens | **Credits** | US$ |
|---|---|---|---|---|---|
| Listing autofill: pasted text (~600-token listing) | 1 | 6,362 | 700 | **10** | 0.010 |
| Listing autofill: Bayut listing URL | 2 (fetch 6,722 / 397 + extract 9,796 / 658) | 16,518 | 1,055 | **23** | 0.022 |
| Listing autofill: Property Finder new-project URL | 2 (fetch 14,954 / 526 + extract 17,983 / 1,328) | 32,937 | 1,854 | **43** | 0.042 |
| Listing translation to Arabic (title + ~180-word description) | 1 | 329 | 517 | **3** | 0.003 |
| Profile autofill: 1-page PDF | 1 | 2,806 | 271 | **5** | 0.004 |
| Profile autofill: Claude web_fetch fallback (fetch step only; always used for Bayut) | 1 | 4,866 | 503 | **8** | 0.007 |

**What the numbers show**
- **The listing extraction system prompt is ~5,800 tokens on its own.** It accounts for about 90% of a pasted-text autofill, so every listing autofill costs at least ~6 credits. Prompt caching on that prompt (cache reads cost 0.1×) would cut that floor to about 1 credit when users run autofill close together.
- **Website autofill sends the page twice** (fetch call, then extraction call), so a website listing costs 2–4× a pasted one. Heavy portal pages such as Property Finder project pages are the most expensive, at ~43 credits.
- **The fetch step wastes output:** the model writes 400–530 tokens of text that the code throws away, and output costs 5×. Lowering `max_tokens` from 512 to about 64 on the fetch calls would save ~2 credits per website.
- **Translation is cheap** (3 credits). A long 5,000-character description would be about 10.

**Not measured yet** (estimates): listing autofill from a multi-page PDF is ~6k + 1.5–3k per page (≈ 15–35 credits for 5 pages); profile autofill from several sources is the sum of the sources plus up to 16k output (≈ 30–100 credits). Phase 1 logging will fill these in from real traffic.

**Rough monthly cost per user:** a broker who does 30 website autofills and 30 translations uses ≈ 30 × 30 + 30 × 3 ≈ **1,000 credits ≈ US$1**.

## 4. Rollout in phases

### Phase 1: measure only (1–2 weeks, nothing blocked)
1. **Shared Claude caller** in the new file `src/lib/server/anthropic.ts`, with `callClaude({ body, beta?, signal, feature, memberId })`. It:
   - runs the existing `fetch('https://api.anthropic.com/v1/messages')` (same headers, same timeouts);
   - reads `payload.usage` and `usage.server_tool_use.web_fetch_requests`;
   - calls `recordAiUsage(...)` on success, and on failure too whenever a `usage` object came back;
   - returns `{ response, payload }`, so each route keeps its own error handling.
2. **Replace the 6 raw fetch sites** with `callClaude`:
   - `src/lib/listingAutofillServer.ts` `readListingWebsite` (needs a new `memberId` parameter)
   - `src/app/api/listing-autofill/route.ts` (extraction call)
   - `src/app/api/listing-translate/route.ts`
   - `src/app/api/profile-autofill/route.ts`: `claudeAnalyzeSingleSource`, `claudeAnalyzeSources`, `claudeFetchWebsiteText`
3. **New Payload collection** `src/collections/AiUsage.ts` (slug `ai-usage`, group `Platform`, admin read only, no public access). Fields:
   - `member` and `pool` (relationships to `members`)
   - `feature` (select: `listing_autofill_fetch`, `listing_autofill_extract`, `listing_translate`, `profile_fetch`, `profile_extract`)
   - `model`, `inputTokens`, `outputTokens`, `cacheCreationTokens`, `cacheReadTokens`, `webFetchRequests`
   - `credits`, `status` (`ok`/`error`), `requestId`

   Register it in `payload.config.ts`, then run `npm run migrate:create`.
4. **Usage report script** `scripts/ai-usage-report.ts`: credits per feature (p50/p90/max), per member per month, and total cost in US$.

### Phase 2: allowances and balance
1. **Plan field:** add `aiCredits` (number, monthly) to `src/collections/Plans.ts` and `AccountPlan` / `PLAN_CATALOG` in `src/config/plans.ts`, add a feature line such as "2,000 AI credits / month", then re-run `npm run seed:plans`.
2. **Starting allowances** (placeholders, to be set from the Phase 1 p90 data):

   | Plan | Broker | Agency (pool) | Developer (pool) |
   |---|---|---|---|
   | Bronze | 1,000 | 3,000 | 3,000 |
   | Silver | 3,000 | 8,000 | 8,000 |
   | Gold | 8,000 | 25,000 | 25,000 |

   1,000 credits ≈ $1 of Claude spend ≈ 25–45 website autofills, 100 pasted-text autofills or ~300 translations (measured, section 3).
3. **Balance helper** `src/lib/server/aiCredits.ts`:
   - `resolvePool(user)`: an agency or developer account is its own pool (`owner` maps to developer, as in `session.ts`). A broker who is a seat in an agency draws from the agency's pool; check the link in `Agencies` / `AgencyInvitations` before building this. Independent brokers are their own pool.
   - `getBalance(poolId)`: `plan.aiCredits + bonus − sum(ai-usage.credits in the current period)`. The balance is always derived from the ledger, with no stored counter that can drift. The period is the calendar month, in the same timezone as `monthlySummary` in `src/lib/membership.ts`.
   - Admins can grant extra credits through a `bonusCredits` entry kept in a small `ai-credit-grants` collection, so the full history is kept.

### Phase 3: enforcement and UI
1. **Pre-check in each AI route**, after the session and role checks: if `getBalance(pool) <= 0`, return **402** `{ error: 'You have used all AI credits for this month…', code: 'ai_credits_exhausted', balance, resetsAt }`. The call in progress is charged at its actual usage afterwards, so the balance can dip slightly below zero once; after that, AI is blocked. A flag `AI_CREDITS_ENFORCE` (default `false` in Phase 1) switches enforcement on.
2. **Responses** include `credits: { used, remaining }` so the UI can update without a second request.
3. **`GET /api/ai-credits`**: returns `{ allowance, used, remaining, resetsAt, byFeature }` for the signed-in user's pool.
4. **UI**
   - `src/components/workspace/Subscription.tsx`: credit meter (used/allowance, reset date) and a breakdown by feature; for agencies, also by seat.
   - `src/components/listings/editor/AutofillWidgets.tsx`, `src/components/profiles/AiAutofill.tsx` and the translate button show "≈ N credits · X left". At zero they are disabled and show an upgrade link. The route's error text still covers a 402.
   - Control Room `membership-management/MembershipManagement.tsx` shows usage for each subscriber and a "grant credits" action.
5. Update `terms/page.tsx` if AI usage limits need to appear in the terms.

## 5. Verification
- **Unit:** `creditsFromUsage` against known `usage` objects (output weighting, cache weights, rounding up).
- **Phase 1:** run each AI feature locally (`npm run dev`) and check that each produces an `ai-usage` row with non-zero tokens. Compare one day's total with the Anthropic Console usage page; it should match within a few percent.
- **Phase 2/3:** seed a member with `aiCredits: 50`, run a URL autofill until the balance is ≤ 0, and confirm the next call returns 402, the UI disables the AI buttons, and manual entry still saves. Confirm that an agency seat draws down the agency pool. Run `npm run typecheck` and `npm run lint`.

## 6. Open items for later
- Top-up packs (needs a payment flow).
- Cost cuts: send the website text once instead of twice, add prompt caching on the ~5k-token extraction system prompt (cache reads cost 0.1×), and consider Haiku 5.5.
