# Changelog

## v6 — Next.js rewrite (October 2026)

The static HTML / Tailwind 3 / vanilla JavaScript site (v5) has been rebuilt as a **Next.js 16 App Router** project in **JavaScript** with **Tailwind CSS v4**, **Prettier** and **ESLint**. Every v5 feature carries over: portal, property page, broker portfolio, role-based navigation, registration, the workspace, the listing editor and its preview, network, selections and subscription.

### Architecture

- React components replace the HTML string renderers (`render.js`, `market.js`, `listing-editor.js`, …). The editor preview and the public site share the same components (`PropertyCard`, `PropertyHCard`, `PropertyDetail`).
- **Route groups** give each kind of page its chrome:
  - `(portal)`: market header, role rail and footer.
  - `(site)`: market header and footer, no rail.
  - `(pro)`: professional header and footer.
  - `(auth)`: no chrome.
  - `(workspace)`: sidebar shell with an access guard.
- **Clean URLs**:
  - `/property/[slug]` and `/brokers/[slug]` (`/brokers/me` for your own portfolio).
  - `/agencies/[id]`, `/listings/[id]` and `/listings/[id]/edit?step=N`.
  - `/network/[id]` and `/preview/listing`.
  - Legacy `.html` entry points redirect.
- The data layer is ported to ES modules (`src/lib/store.js`, `src/lib/storage.js`). Components subscribe to changes with `useSyncExternalStore`, which replaces the old DOM custom events (`e08:ready`, `e08:saved`, `e08:selection`).
- Shared providers handle toasts and confirm dialogs, the session, and the enquiry/viewing modal. There is one accessible `Modal` (focus trap, Esc, scroll lock) and one `Lightbox` (keyboard and swipe).
- Tailwind v4 is configured CSS-first (`@theme`). Brand tokens and component classes live in `globals.css`. Fonts are loaded with `next/font/local`, and Bootstrap Icons come from npm.
- Prettier is set up with Tailwind class sorting, and ESLint with the Next.js core-web-vitals rules. `npm run lint`, `npm run format` and `npm run format:check` are available.

### Fixes and small improvements found during the port

- Agency profiles show "ORN on record" only when the record has a real ORN. Sample agencies are labelled "Sample agency", and an unknown agency id now shows a not-found state instead of falling back to the first agency.
- Workspace sign-out reliably lands on `/login?signedout=1`.
- Enquiry status changes now also work on the sample enquiries.
- Activity-log icons that didn't exist in Bootstrap Icons are mapped to valid ones.
- Registration clears the correct session-storage draft key.
- The listing editor asks for confirmation before in-app navigation drops unsaved edits.
- Duplicating a published listing gives the copy its own slug.
- Notes on selected properties are saved even when you leave the page right after typing.

### Not carried over

- Lenis smooth scrolling. Native smooth scrolling is used for in-page anchors; GSAP scroll animations remain on the platform page.

## v5 — Portfolio, property page and listing workflow

- Bayut-style broker portfolio and Centris-style property page.
- Role-aware navigation, with buyer accounts.
- Profile/Account split.
- The 8-step listing editor with payment plans, the photo manager, and the two-tab preview.
- Listing statuses and actions.
- Bootstrap Icons.
