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
- [ ] `robots: { index: false }` once a listing is sold, rented or expired (or return 410)
  - Removed listings already render the not-found page with `noindex`, but with HTTP 200, because the route's `loading.tsx` streams first. A true 404 needs that skeleton removed or a slug check in Proxy.
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

This agent writes and maintains the content on the pages. Crawlability is handled by Part 1.

### Triggers

- When a listing or broker profile is saved: a Payload `afterChange` hook queues a job (it never runs inside the request)
- Nightly: works through anything missing, stale or flagged

### Tools

| Tool | Purpose |
| --- | --- |
| `get_listing` / `get_broker` | Read the CMS record |
| `get_area_facts` | Community and area facts, from our own data only |
| `check_page` | Fetch the page as served; check title, description, canonical and JSON-LD |
| `save_seo_fields` | Write the generated fields back to the record |

### Output per page

- SEO title and meta description
- FAQ block (3–5 questions), also output as `FAQPage` JSON-LD
- Short neighbourhood summary
- Alt text for images
- A list of problems it found (missing price, thin description, broken image, and so on)

### Rules

- It may only state facts that are in the listing or broker record. No invented prices, permits, handover dates or yields.
- A human or a validation step reviews its output before it goes live, at least at first.
- Usage is charged through `callClaude` in [src/lib/server/anthropic.ts](src/lib/server/anthropic.ts).

### How to run it

- Nightly bulk runs: the Message Batches API (half the cost; results arrive within hours)
- Alternative: a Managed Agents scheduled deployment. Anthropic hosts it and runs it on a cron schedule; it's in beta and bills session time on top of tokens.

---

## Part 3: Listing autofill agent

Today [src/app/api/listing-autofill/route.ts](src/app/api/listing-autofill/route.ts) is a fixed pipeline: fetch sources → extract → `applyPortalFacts` → `dropUnsupported`. An agent helps where the next step depends on what it finds.

### What the agent adds

- Follows useful links (developer project page, floor plan, brochure)
- Compares sources that disagree and picks the best-supported value
- Matches the listing to an existing project, community or developer in the CMS
- Asks the user for a missing required field instead of guessing

### Tools

| Tool | Purpose |
| --- | --- |
| `read_website` | Existing `readListingWebsite` |
| `read_document` | Uploaded PDFs, images and text |
| `portal_facts` | Existing `portalFacts` / `pageClassification` |
| `find_project_in_cms` | Match against projects, communities and developers |
| `suggest_photos` | Existing photo suggestions (`AiPhotoSuggestions`) |
| `submit_listing` | Final answer, using a strict schema (`listingAiOutputSchema`) |

### Rules

- The tool loop runs in our own route and calls through `callClaude`, so AI credits are still charged.
- Cap the turns and the time (the route's `maxDuration` is 300 s); stream progress to the editor.
- **Keep the existing checks.** `applyPortalFacts` and `dropUnsupported` still run on the final output in code. They are what keep it accurate.
- Every value keeps its source label so the editor can show where it came from.
- Private identifiers are still only read from user uploads, never from public pages.

### Model

- The current default is `claude-haiku-4-5` (2025). If we upgrade to a current model, test it on real listings first.
- Newer models reject a forced `tool_choice` (`any`/`tool`). Use `auto` with a strict tool schema, or structured outputs.

---

## Order of work

1. **Part 1**: index pages, metadata, JSON-LD, sitemap, robots, indexing
2. **Part 2**: SEO content agent
3. **Part 3**: autofill agent

Before implementing, check the Next 16 docs in `node_modules/next/dist/docs/` for the current metadata, sitemap and robots APIs (see `AGENTS.md`).
