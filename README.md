# Emirate08 — Dubai real estate portal & broker workspace (Next.js)

Emirate08 is a Dubai-focused real estate platform built first for **independent brokers** (and brokers affiliated with an agency). It has two connected experiences:

1. **Public portal** — buyers, tenants and investors search properties, open full property pages, browse broker portfolios and contact brokers.
2. **Broker workspace** — brokers manage listings (ready and off-plan), their public portfolio, enquiries and their private account.

> **Supabase-backed application.** Payload CMS uses Supabase PostgreSQL as its database and Supabase-compatible S3 storage for uploaded media. Accounts, profiles, listings, saved and recent items, workspace state, enquiries and waitlist signups are stored server-side. Static reference values and UI copy remain in source. Payment collection and outbound email/SMS/WhatsApp delivery are not configured.

## Stack

|              |                                                                                                                                                            |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework    | **Next.js 16** (App Router, Turbopack), **React 19**, **TypeScript** (TS/TSX)                                                                       |
| Styling      | **Tailwind CSS v4**, CSS-first config (`@theme` in `src/app/globals.css`, `@tailwindcss/postcss`)                                                          |
| Icons        | Bootstrap Icons 1.13 web font (npm package `bootstrap-icons`)                                                                                              |
| Fonts        | Instrument Sans, Inter Tight and Fraunces Italic, self-hosted through `next/font/local`                                                                    |
| Motion       | GSAP + ScrollTrigger, used on the platform page only                                                                                                       |
| Code quality | **Prettier 3** + `prettier-plugin-tailwindcss` (sorts classes), **ESLint 9** flat config (`eslint-config-next` core-web-vitals + `eslint-config-prettier`) |

## Getting started

Requires Node.js 20.9 or later.

```bash
npm install
npm run seed         # initial admin, plans and public sample inventory
npm run dev          # http://localhost:3000
```

Set `DATABASE_URI` and `PAYLOAD_SECRET` in `.env` before starting. Configure `S3_BUCKET`, `S3_ENDPOINT`, and S3 credentials for Payload media uploads. The listing editor currently saves resized images with listing data in Supabase Postgres. Review generated migrations before applying them to a database with existing data.

Forms use Next.js Server Actions in `src/app/actions.ts` for authentication, account changes, enquiries, and waitlist signups. Server Actions and the existing API routes share server-only services in `src/lib/server`, including validation, member authorization, and Payload authentication cookies. Data reads, media uploads, cache revalidation, and background workspace autosave retain HTTP endpoints. The API routes remain available for existing consumers.

Run `npm run storage:check` to verify S3 access. Run `npm run media:sync` to upload missing bundled photographs, verify their public URLs, and link existing properties and saved workspace listings to the uploaded Media records. The import preserves existing media IDs and does not push database schema changes.

| Script                 | What it does                               |
| ---------------------- | ------------------------------------------ |
| `npm run dev`          | Development server with hot reload         |

| `npm run seed`         | Seed admin, membership plans, and sample portal inventory |
| `npm run migrate:create` | Generate a Payload database migration |
| `npm run migrate`      | Apply pending Payload migrations |
| `npm run build`        | Production build                           |
| `npm start`            | Serve the production build                 |
| `npm run lint`         | ESLint (Next.js core-web-vitals rules)     |
| `npm run format`       | Prettier, including Tailwind class sorting |
| `npm run format:check` | Prettier check, for CI                     |

App users register through `/register`; Payload Admin users sign in at `/admin`. The seed script creates the initial admin using `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` from the environment (set both in `.env`; the password must be at least 12 characters).

## Project structure

```
src/
├─ app/                         App Router — route groups pick the page chrome
│  ├─ layout.js                 Root: fonts, Bootstrap Icons, globals.css, providers, role script
│  ├─ globals.css               Tailwind v4 @theme (brand colours, radius ≤ 6px, type scale) + component classes
│  ├─ icon.svg                  Favicon
│  ├─ not-found.js              404
│  ├─ (portal)/                 Market header + role rail + footer
│  │  ├─ page.js                Home
│  │  ├─ properties/            Search
│  │  ├─ property/[slug]/       Property detail page
│  │  ├─ agents/                Agent & agency directory
│  │  ├─ brokers/[slug]/        Broker portfolio (`me` = your own)
│  │  ├─ agencies/[id]/         Agency profile
│  │  └─ saved/ sell/ help/
│  ├─ (site)/                   Market header + footer, no rail: platform/ terms/ privacy/
│  ├─ (pro)/                    Professional header/footer: for-professionals/
│  ├─ (auth)/                   No chrome: login/ register/ forgot-password/ unauthorized/
│  ├─ (workspace)/              AppShell + access guard
│  │  ├─ dashboard/ enquiries/ profile/ account/
│  │  ├─ listings/ (list) · listings/new · listings/[id] · listings/[id]/edit
│  │  └─ network/ · network/[id] · selected/ · subscription/
│  └─ preview/listing/          Iframe target for the editor's Preview Listing modal
├─ components/
│  ├─ ui/                       Icon, Modal, Field/Switch, Dropdown, Lightbox
│  ├─ providers/                SessionProvider, FeedbackProvider (toast/confirm), EnquiryProvider
│  ├─ layout/                   MarketHeader (mega menu), QuickRail, MarketFooter, ProChrome, Wordmark
│  ├─ property/                 PropertyCard, PropertyHCard, FavButton, PropertyDetail + detail/ sections & calculators
│  ├─ broker/                   Avatar, VerifiedBadge, ContactButtons, AgentCard/AgencyCard
│  ├─ portal/                   Home, search, directory, portfolio, agency, saved, help, legal
│  ├─ platform/                 Platform page, GSAP motion hook, Dubai map
│  ├─ auth/                     Login, 4-step registration wizard, password reset, unauthorized
│  ├─ listings/                 My Listings, listing detail, actions; editor/ (8 steps, payment plan, media, preview)
│  └─ workspace/                AppShell, overview, enquiries, portfolio (Profile), account, subscription, network/
├─ data/                        Sample brokers & listings, communities, reference lists, navigation, map, credits
├─ hooks/                       useStoreVersion / useHydrated (useSyncExternalStore), useDocumentTitle
├─ lib/
│  ├─ storage.ts                Reactive in-memory cache; persistence goes through API routes
│  ├─ store.ts                  Client data layer backed by Payload route handlers / Supabase
│  ├─ routes.js                 URL helpers
│  ├─ share.js                  Copy and share helpers
│  └─ utils.js                  slugify, cx, validation regexes, image → data URL, …
└─ fonts/                       woff2 files for next/font/local
public/images/                  Licensed photography (see Images & credits)
```

### How data flows

- `src/lib/store.ts` hydrates public inventory and the signed-in member through server routes; writes are persisted to Payload collections backed by Supabase Postgres.
- `src/lib/storage.ts` is a temporary in-memory cache for reactive rendering. It does not store durable records in the browser.
- `SessionProvider` loads public data and the current account session before exposing `{ ready, user, role }`.
- A small inline script in the root layout sets `html[data-role]` before first paint, so the role rail never makes the layout jump. It also sets `html.is-embed` when the URL has `?embed=1`.

## Navigation by role

|                     | Guest                              | Buyer                                  | Broker / agency                                         |
| ------------------- | ---------------------------------- | -------------------------------------- | ------------------------------------------------------- |
| Header              | Mega menu + **Sign In**            | Mega menu + account menu               | Mega menu + account menu                                |
| Left rail (≥1024px) | **none** (full-width layout)       | Search · Saved · Recent · Enquiries    | Dashboard · My Listings · Enquiries · Profile · Account |
| Workspace routes    | redirect to `/unauthorized?next=…` | redirect to `/saved?workspace=brokers` | full access                                             |

The mega menu opens on hover, click or keyboard (arrow keys, Esc). On mobile it becomes an accordion.

## Routes

| Route                                                                          | Purpose                                                                                                                                                                       |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                                                                            | Home: hero search, recently listed carousel, budget explorer, buy/rent/sell, communities                                                                                      |
| `/properties`                                                                  | Search by purpose, text, type, beds, completion, max price and sort. The filters are kept in the URL                                                                          |
| `/property/[slug]`                                                             | **Centris-style property page**, described below                                                                                                                              |
| `/brokers/[slug]`                                                              | **Bayut-style broker portfolio**. `me` = your own; `?preview=draft` shows unpublished edits; `?embed=1` hides chrome                                                          |
| `/agents` · `/agencies/[id]`                                                   | Agent & agency directory (`?view=agencies`), agency profiles                                                                                                                  |
| `/saved`                                                                       | Saved properties, `#recent`, `#enquiries`                                                                                                                                     |
| `/sell` · `/help` · `/for-professionals` · `/platform` · `/terms` · `/privacy` | Content pages. The image credits table is on `/terms`                                                                                                                         |
| `/login` · `/register` · `/forgot-password` · `/unauthorized`                  | Auth. Registration is a 4-step wizard: account type (broker / agency / buyer / owner waitlist), details, credentials, OTP + plan                                              |
| `/dashboard`                                                                   | Overview: credentials, plan, portfolio status, KPIs, activity                                                                                                                 |
| `/listings`                                                                    | Tabs (all / sale / rent / off-plan) and status filters. Actions: edit, preview, publish, unpublish, feature, mark sold/rented, duplicate, archive, delete                     |
| `/listings/new` · `/listings/[id]/edit?step=N`                                 | 8-step listing editor, described below                                                                                                                                        |
| `/listings/[id]`                                                               | Card previews, checklist, status actions                                                                                                                                      |
| `/enquiries`                                                                   | Inbox of enquiries and viewing requests for the signed-in broker                                                                                                              |
| `/profile`                                                                     | **Public portfolio management**: draft → preview (desktop/mobile) → publish changes                                                                                           |
| `/account`                                                                     | **Private settings**: personal info, credentials, security (change email/password, sign out, delete account, reset demo), privacy toggles, preferences (USD equivalent), plan |
| `/network` · `/network/[id]` · `/selected` · `/subscription`                   | Broker network with plan quotas, your private collection with notes, plans                                                                                                    |

Old static links (`/index.html`, `/agent.html`, `/property.html`) redirect to their new routes (see `next.config.mjs`).

### Property page

The page has:

- Header and price, with a USD equivalent when that preference is on.
- 1 large + 4 small gallery, with the featured photo first, opening a fullscreen lightbox (keyboard and swipe).
- Floor plans, video, virtual tour, master plan and brochure, when the listing has them.
- Characteristics, and a description with Read more.
- Sticky contact sidebar: call, email, WhatsApp, request a viewing, save, share.
- Payment plan, for off-plan listings.
- Features, and grouped property details.
- A **demonstration map** (zoom/pan) with nearby categories, plus community insights.
- "Listed by", linking to the broker portfolio.
- Calculators: mortgage, purchase costs, rental affordability, off-plan payment plan.
- Similar properties, and a mobile contact bar.

Enquiries and viewing requests are saved to the broker's workspace inbox.

### Listing editor

1. **Classification** — Ready / Off-plan, then Sale / Rent (off-plan is sale-only), category and type.
2. **Location / Development** — ready: community, building, unit no.; off-plan: project, developer, status, launch, handover, registration ref., availability, description.
3. **Property / unit details** — title, summary, description with counters, beds, baths, areas, parking, furnishing, condition, completion, floor, view, availability.
4. **Price & terms** — rent, ready sale or off-plan pricing. The **payment plan editor** lets you add, edit, reorder and remove milestones, start from templates, and requires a 100% total.
5. **Marketing** — up to 5 highlights (plus custom ones), searchable grouped amenities, selling points.
6. **Photos & media** — multi-upload, drag-and-drop and keyboard reordering, captions, replace, remove, **Set as Featured Photo**, floor plans, brochure, master plan, video and tour URLs.
7. **Permit & display** — advertising permit, contact preference, visibility, feature on portfolio, authorisation.
8. **Review & publish** — readiness checklist with Fix links. A listing publishes if the broker's credentials are verified; otherwise it goes to **Pending review**.

**Preview Listing** opens a two-tab modal (Property card / Full property page) with Desktop and Mobile viewports. It loads `/preview/listing` in an iframe, so CSS breakpoints match the chosen viewport, and sends the unsaved form state with `postMessage`. The preview is drawn by the same components buyers see.

Statuses: `draft · pending · published · unpublished · sold · rented · archived`.

## Design rules

- Brand colours, the type scale, the 1320px container and a maximum radius of 6px are Tailwind v4 theme tokens in `src/app/globals.css`. Reusable patterns such as `.btn`, `.input`, `.pcard`, `.hcard` and `.modal-panel` are defined in the same file under `@layer components`.
- Prettier sorts Tailwind classes using that stylesheet (`tailwindStylesheet` in `.prettierrc.json`). It also sorts classes inside `cx()` calls.

## Data & honesty rules

- Sample brokers, agencies, listings, developers and projects are fictional and labelled as samples. Verified badges appear only when the record says so; one sample broker is deliberately unverified, and agencies with sample ORNs are labelled "Sample agency".
- Broker "sales/rentals recorded" counts come from listings marked sold or rented on Emirate08. No transaction figures are invented.
- The map is a **demonstration map** showing the community's approximate position, never an exact property location. It shows no invented distances or demographics.
- Calculators are estimates with editable, labelled assumptions; they are not quotations. The USD equivalent uses the fixed AED peg (3.6725).

## Supabase data flow

Payload CMS connects to Supabase PostgreSQL through `DATABASE_URI`. App accounts use Payload authentication; member workspace state is scoped to the authenticated member. Public broker and property records, plans, enquiries, and waitlist signups are read or written through server routes. The browser retains a temporary in-memory cache for responsive rendering, not durable records. `npm run seed` imports bundled WebP assets into the Payload Media collection, which stores them in the configured S3-compatible Supabase Storage bucket. App image URLs resolve through Payload to those stored assets.

Credential review is an administrative workflow and does not automatically verify records against RERA. Payment processing and outbound email/SMS/WhatsApp delivery still require provider integrations. The map remains illustrative and should be connected to verified location data before presenting exact locations or distances.

## Images & credits

38 photographs from Wikimedia Commons (CC0 / CC BY / CC BY-SA), resized to WebP, are in `public/images/`. Attribution is in `src/data/credits.json` and is shown on `/terms#credits`. The photos are illustrative and do not depict the advertised units.

See `CHANGELOG.md` for release notes.
