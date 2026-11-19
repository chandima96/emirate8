# SEO, AI Crawlability and AI Agents Plan

Goal: property pages and agent (broker) pages are indexed by search engines and can be found and cited by AI assistants (ChatGPT, Claude, Perplexity, Gemini, Copilot). Two AI agents support this: one for listing autofill, one for SEO content.

Nobody can guarantee placement in AI answers. This plan makes every page eligible and easy to cite.

## Current state

| Area | Status |
| --- | --- |
| Property detail `/property/[slug]` | Server-rendered, has JSON-LD. Metadata has no `canonical`, `openGraph` or image. |
| Broker detail `/brokers/[slug]` | Server-rendered, has canonical, Open Graph and JSON-LD. |
| Index pages `/properties`, `/agents` | Results load in the browser (`PropertySearch` and `Directory` use `useSearchParams` inside `Suspense`). Crawlers that don't run JavaScript see only loading skeletons. |
| Sitemap [src/app/sitemap.ts](src/app/sitemap.ts) | Stops at 500 properties. `/agents` is missing. |
| Robots [src/app/robots.ts](src/app/robots.ts) | Allows every crawler (`*`). AI bots aren't listed by name. |
| Page copy | Metadata on `/properties` and `/agents` says "sample", which reads as a demo site. |

---

## Part 1: Crawlability (plain code, no AI)

Most of the gain is here. Do this first.

### 1.1 Server-render the index pages

- [x] Render the first page of results for `/properties` and `/agents` on the server.
- [x] Use real `<a href>` pagination links (`?page=2`) so crawlers can follow them.
- [x] Keep the interactive filters on the client, hydrating on top of the server-rendered list.
- [x] Add landing pages for common searches, for example:
  - `/properties/[area]/[type]-for-[purpose]` → `/properties/dubai-marina/apartments-for-sale`
  - `/agents/[area]` → `/agents/downtown-dubai`
- [x] Each landing page gets a unique title, an H1, a short intro and the matching listings.

### 1.2 Complete the property page metadata

File: [src/app/(portal)/property/[slug]/page.tsx](src/app/(portal)/property/[slug]/page.tsx)

- [x] `alternates.canonical`
- [x] `openGraph` (title, description, URL, main image) and `twitter` card
- [x] A clean description: trimmed to about 155 characters, with no HTML
- [x] `robots: { index: false }` once a listing is sold, rented or expired (or return 410)
  - Crawlers get a real 404: their requests for `/property/<slug>` are rewritten to `/property-html/<slug>` (same page without `loading.tsx`), so `notFound()` runs before anything streams. Browsers keep the loading skeleton and get the not-found page with `noindex`.
- [x] Use the broker page's `generateMetadata` as the pattern

### 1.3 Structured data (JSON-LD)

- [x] Property: `RealEstateListing` with an `Offer` (price, currency AED, availability), a `Place` with geo and address, `floorSize`, `numberOfRooms`, images and `datePosted` (already in place)
- [x] Property: a `BreadcrumbList` (Home → Properties → Area → Listing)
- [x] Broker: `ProfilePage` + `Person` with languages, areas served and verified BRN credential (already in place); listings now link the broker profile from `provider`
- [x] Site-wide: an `Organization` and a `WebSite` with `SearchAction`
- [ ] Check with Google's Rich Results Test and the Schema.org validator

### 1.4 Sitemap

- [x] Split the sitemap with `generateSitemaps` so it covers every listing, not just the first 500
- [x] Use each record's real `updatedAt` for `lastModified`
- [x] Add `/agents` and the new landing pages
- [x] Leave out private, sold or noindex listings

### 1.5 Robots and AI crawlers

- [x] List the AI search and assistant bots by name in [src/app/robots.ts](src/app/robots.ts) and allow them: `OAI-SearchBot`, `ChatGPT-User`, `Claude-SearchBot`, `Claude-User`, `PerplexityBot`, `Applebot`, `Bingbot`, `Googlebot`
- [ ] **Decision needed:** whether to allow the bots that collect training data (`GPTBot`, `ClaudeBot`, `Google-Extended`, `Applebot-Extended`, `CCBot`)
- [x] Keep the current disallow list (dashboards, account, API, login)

### 1.6 Indexing and discovery

- [ ] Google Search Console: verify the site and submit the sitemap (set `GOOGLE_SITE_VERIFICATION`; the meta tag is wired up)
- [ ] Bing Webmaster Tools: verify and submit the sitemap (set `BING_SITE_VERIFICATION`). ChatGPT search leans heavily on Bing.
- [x] IndexNow: ping when a listing is published, updated or removed (Payload `afterChange` hook; set `INDEXNOW_KEY` to turn it on)

### 1.7 Content and performance

- [x] Remove "sample" wording from public metadata and copy
- [ ] Use ISR/`revalidate` on detail pages so they stay fast and fresh (not done: `getProperty` is deliberately uncached so publish and visibility changes show at once)
- [x] Give every listing image descriptive `alt` text
- [x] Optional: an `/llms.txt` file and a Markdown version of each listing (few crawlers use these yet, but they're cheap)

### 1.8 Check it works

- [x] `curl -A "OAI-SearchBot" https://<site>/properties` returns real listings in the HTML, not skeletons
- [x] The same check passes for `/agents`, one property page and one broker page

---

## Part 2: SEO content agent

Status: built. Needs the `seo_content` migration and `CRON_SECRET` before it runs (see "Setup").

The agent writes a title, meta description and FAQ for every public property and broker page. It writes only from the record's public facts, and its content goes live only after review.

### How it works

1. **Fact sheet** ([src/lib/seoAgent/facts.ts](src/lib/seoAgent/facts.ts)): built from the same public data the pages show. Volatile fields (dates, listing counts) are left out, and the sheet is hashed.
2. **Agent loop** ([src/lib/server/seoAgent/agent.ts](src/lib/server/seoAgent/agent.ts)): Claude reads the fact sheet and can call tools. It has at most 6 turns.
3. **Validator** ([src/lib/seoAgent/validate.ts](src/lib/seoAgent/validate.ts)): every save is checked. Errors go back to Claude so it can fix the draft, which is why this is a loop and not a single call.
4. **Storage**: the `seo-content` collection in Payload admin (Platform group). A new draft waits for review.
5. **Pages**: show the content only when it is **approved** and its hash still matches the record's current facts. Editing a listing hides the old content until new content is approved.

### Tools

| Tool | Purpose |
| --- | --- |
| `get_area_facts` | Qualitative area context (common types, sale/rent, off-plan). No counts or prices, which change daily. |
| `check_page` | Fetches the live page and reports title, description, canonical, H1, structured data types, photo and word counts |
| `save_seo_content` | Validates and saves; returns the problems to fix if it fails |

### Output per page

- [x] SEO title and meta description (used in `generateMetadata` once approved)
- [x] FAQ block (3–5 questions), visible on the page and as `FAQPage` JSON-LD
- [x] Issues found (missing price, thin description, page problems), stored for admins only
- [ ] ~~Short neighbourhood summary~~: dropped. Area figures change daily, so per-listing text would go stale. The Part 1 landing pages already give exact, current area figures.
- [ ] ~~Alt text for images~~: dropped. The agent doesn't see the photos, so it would be guessing. Card alt text comes from the title and captions (Part 1). Writing alt text from the photos would need image input for every photo.

### Rules (enforced by the validator, not just the prompt)

- [x] Only numbers that appear in the facts, in any format (2,450,000 / 2.45M / two).
- [x] No yields, returns, appreciation, guarantees, mortgage or visa claims, superlatives or market comparisons, unless the record says so.
- [x] No links, emails or UAE phone numbers.
- [x] Length limits for title (20–60), description (70–160) and FAQ (3–5 entries).
- [x] Human review by default; `SEO_AGENT_AUTO_APPROVE=true` publishes validated content directly.
- [x] Usage logged in `ai-usage` as `seo_content` with no member, so no one's AI credits are charged.

### Model

`claude-opus-5-5` at medium effort, with server-side refusal fallback (`fallbacks: "default"`). Change it with `SEO_AGENT_MODEL`. It uses the official `@anthropic-ai/sdk` (pinned to 1.5.0) and `ANTHROPIC_API_KEY`.

### Triggers (no schedule)

1. **After autofill, in the listing editor.** Autofill fills the form, then the SEO agent runs on the draft (`POST /api/listing-seo`). It writes:
   - the listing's `seo` block (SEO title, meta description, FAQ), saved with the listing and editable in **Marketing → Title & description → Search & AI visibility**;
   - a rewritten listing **title** and **description**. An empty field is filled directly (undone with the autofill changes); text the broker already wrote waits as a suggestion in its field (**Use** / **Keep**).
   - Charged to the broker's AI credits (`listing_seo`).
2. **"Generate SEO" button in the listing editor** (same panel). It runs the same step on demand, for example after editing the details.
3. **"Generate SEO" button in Payload admin**, in the sidebar of Properties, Brokers and SEO content records. It runs the agent for that public page (`POST /api/seo-agent/run`, staff session) and stores the result in SEO content. Platform-paid (`seo_content`).
4. Scripts and backfills: `GET /api/seo-agent/run` with `Authorization: Bearer $CRON_SECRET`. The daily cron was removed.

### Which content a page shows

1. The listing's own `seo` (editor), while it still passes the validator against the listing's current facts. If the price or size changes, it hides until it's regenerated; the editor panel shows why.
2. Otherwise approved SEO content from Payload admin, while its fact hash matches.

### Setup

1. `npm run migrate` (creates the `seo_content` table).
2. Optionally set `SEO_AGENT_MODEL` and `SEO_AGENT_AUTO_APPROVE` (admin-generated content only). `CRON_SECRET` is only needed for scripted runs.
3. Run it once by hand, review the drafts in Payload admin → SEO content, and approve the good ones.

### Not done / next

- [ ] Message Batches for a large first backfill (half price, but results take up to 24 hours and batches can't run tool loops)
- [ ] An admin "regenerate" button (the `?path=` parameter covers this for now)

---

## Part 3: Listing autofill agent

Status: built. Not yet tested against the live API (see "Testing").

[src/app/api/listing-autofill/route.ts](src/app/api/listing-autofill/route.ts) used to make one extraction call. It now runs a short tool loop ([src/lib/server/listingAutofillAgent.ts](src/lib/server/listingAutofillAgent.ts), up to 5 turns). The response format and the editor UI are unchanged, and all the existing post-processing still runs on the result (`dropUnsupported`, `cleanListingSuggestions`, portal facts, conflicts → alternatives).

In the common case the model submits on its first turn, so a request costs about what the single call did. The sources are prompt-cached, so the extra turns re-read them at a tenth of the price.

### What the agent adds

- [x] Follows useful links (developer project page, floor plan, brochure), at most 2 per request
- [x] Matches the building or community to the Emirate08 catalogue, for spelling only
- [x] Fixes its own evidence: answers the evidence check would drop go back to the model once, so it can quote the source exactly instead of losing a correct value
- [x] Compares sources that disagree: unchanged, and still the strongest part (each source answered separately, conflicts reviewed by the user)
- [x] Asks the user for a missing field instead of guessing: already how it works. The rule "answer only what the source states" stays, and the editor marks missing required fields as **Needs Your Input**. No new UI needed.

### Tools

| Tool | Purpose |
| --- | --- |
| `read_linked_page` | Reads a link through the existing `readListingWebsite`. Only exact URLs written in a text source, so a prompt-injected page can't make it build an exfiltration URL. |
| `find_building` | `searchCatalogue` over the existing building catalogue ([src/lib/server/listingCatalogueData.ts](src/lib/server/listingCatalogueData.ts)). Never counts as evidence. |
| `submit_listing` | The existing schema (`listingAiOutputSchema`) as a strict tool. Runs the evidence check and label check before accepting. |
| ~~`read_document`~~, ~~`portal_facts`~~ | Not tools: documents and portal facts are already in the first message. |
| ~~`suggest_photos`~~ | Dropped: the photo-suggestion code is no longer in the repo. |

### Rules

- Linked pages are public pages: private fields (unit no., permit, agreement terms) are never taken from them, even when the user also uploaded private documents.
- Every call is charged to the member's AI credits (`listing_autofill_extract`; page reads as `listing_autofill_fetch`), as before.
- The model stays `ANTHROPIC_MODEL` (currently `claude-haiku-4-5-20251001`).
- The agent loop's timeout went from 180 s to 220 s, still inside the route's 300 s limit.

### Testing

- [x] Unit tests: link allow-list, evidence feedback and the label-free schema ([tests/listing-agent.test.ts](tests/listing-agent.test.ts))
- [ ] Live run with a demo broker account: pasted text, a portal link and a PDF

## Order of work

1. **Part 1**: index pages, metadata, JSON-LD, sitemap, robots, indexing
2. **Part 2**: SEO content agent
3. **Part 3**: autofill agent

Before implementing, check the Next 16 docs in `node_modules/next/dist/docs/` for the current metadata, sitemap and robots APIs (see `AGENTS.md`).
