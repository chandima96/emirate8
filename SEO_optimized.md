# SEO and AI Search Implementation Plan

## Goal

Make public Emirate08 properties, brokers and agencies discoverable in Google Search and useful as sources for AI-powered search systems.

Important: SEO and AI search visibility cannot be guaranteed. The implementation should make real public pages crawlable, indexable, trustworthy and easy to understand.

## Phase 0 — Security and production readiness

### Status: repository changes applied; credential rotation remains manual

- Rotate all credentials that have been exposed during development, including database, storage and SMTP credentials.
- Confirm `.env` is ignored by Git and that no secrets exist in committed files.
- Add a local development `NEXT_PUBLIC_SITE_URL`, for example:

  ```env
  NEXT_PUBLIC_SITE_URL=http://localhost:3000
  ```

- Keep `http://localhost:3000` while developing. Search engines and AI crawlers cannot access or index a localhost site. Replace it with the real public HTTPS URL after deployment.

- Remove demo/sample wording from production pages, or keep those pages out of search until real data is available.
- Decide which content is allowed to be public:
  - Published properties only
  - Public broker profiles only
  - Public agency profiles only
  - No private contact information unless the broker has explicitly enabled it

Implemented in the repository:

- `.env` remains ignored by Git.
- `env.example` documents `NEXT_PUBLIC_SITE_URL=http://localhost:3000`.
- Public API output excludes private/unsearchable brokers and brokers without slugs.

Manual action still required before production: rotate any real credentials that were exposed in development and update the local `.env` with the replacement values.

## Phase 1 — Public URL and content rules

### Status: implemented for public CMS/API data paths

Establish one canonical URL for each public record.

```text
/property/[slug]
/brokers/[slug]
/agencies/[slug]
/properties
/agents
```

Rules:

- Every published property must have a stable, unique slug.
- Every public broker must have a stable, unique slug.
- Draft, pending, archived, private and deleted records must not be indexable.
- Sold or rented properties should either remain as clearly labelled historical pages or return `404`/`410` when permanently removed.
- Avoid duplicate URLs using IDs, query strings or preview parameters.
- Use canonical URLs on every indexable page.

Implemented in the repository:

- CMS property queries return only published properties with `display.visible` enabled.
- Public API property queries apply the same published/visible rule.
- Public broker output requires a slug and excludes records marked private or unsearchable.
- Public member broker output requires a public, searchable portfolio with a slug.

## Phase 2 — Server-render public property pages

### Status: implemented

Current public property content is mainly hydrated in the browser. Search crawlers may not see the complete content immediately, and some AI crawlers do not execute JavaScript.

Update:

```text
src/app/(portal)/property/[slug]/page.tsx
```

Use the existing server-side CMS function:

```text
getProperty(slug)
```

The initial server HTML should contain:

- Property title
- Purpose: sale or rent
- Price in AED
- Emirate, area and community
- Property type
- Bedrooms, bathrooms and size
- Description
- Highlights and amenities
- Main image with useful alt text
- Broker name and broker profile link
- Availability and last updated date
- Related property links

Keep client-side components for filters, favourites, enquiry dialogs and other interactive features, but do not make the core property information depend on client-side API hydration.

Implemented in the repository:

- `/property/[slug]` now fetches the published property on the server through `getProperty(slug)`.
- Missing or unpublished properties return the application's `404` page.
- The normalized property, gallery, description, facts and broker relation are passed into `PropertyDetail` during the initial render.
- The route now provides a property-specific title and description instead of generic `Property Details` metadata.
- Existing client interactions remain available for sharing, favourites, enquiries and similar listings.

## Phase 3 — Server-render public broker and agency pages

### Status: implemented

Update:

```text
src/app/(portal)/brokers/[slug]/page.tsx
src/app/(portal)/agencies/[id]/page.tsx
```

Use server-side CMS queries such as:

```text
getBroker(slug)
getAgency(slug)
```

The initial HTML should include:

- Broker or agency name
- Professional title
- Dubai/UAE service areas
- Specialities
- Languages
- Verification status where legally appropriate
- Biography or company description
- Active property count
- Links to active property pages
- Contact options that the professional has made public

Private profiles and `/brokers/me` must not be indexable.

Implemented in the repository:

- Public broker pages fetch the broker record and active published properties on the server.
- Public broker pages pass initial broker and portfolio data into the interactive portfolio component, so the profile and listing content are available in the initial render.
- Public agency pages fetch the agency, its public brokers and active listings on the server.
- Missing broker and agency records return the application's `404` page.
- Broker and agency routes now generate record-specific titles and descriptions.

## Phase 4 — Dynamic metadata and canonical URLs

Add `generateMetadata()` to each dynamic public route.

Property title example:

```text
2 Bedroom Apartment for Sale in Dubai Marina | Emirate08
```

Property description example:

```text
View price, photos, size, amenities and listing broker for this 2-bedroom apartment for sale in Dubai Marina, Dubai.
```

Broker title example:

```text
Sara Al Mansoori — Dubai Real Estate Broker | Emirate08
```

Each page should define:

- Unique `title`
- Unique `description`
- `alternates.canonical`
- Open Graph title, description and image
- Twitter card metadata where required
- `robots: { index: false, follow: false }` for private, missing or preview pages

## Phase 5 — Structured data for search and AI understanding

Create reusable JSON-LD components, for example:

```text
src/components/seo/PropertyJsonLd.tsx
src/components/seo/BrokerJsonLd.tsx
src/components/seo/AgencyJsonLd.tsx
src/components/seo/BreadcrumbJsonLd.tsx
```

Property structured data should describe:

- Property name and URL
- Images
- Description
- Location
- Price and currency
- Sale or rental offer
- Availability
- Number of bedrooms, bathrooms and floor area
- Listing broker or agency

Broker/agency structured data should describe:

- Name
- URL
- Image or logo
- Areas served
- Contact details that are public
- Agency relationship
- Social profile links where applicable

Only publish structured data that matches the visible page content. Do not mark unverified information as verified.

## Phase 6 — Sitemap and robots controls

Create:

```text
src/app/sitemap.ts
src/app/robots.ts
```

The sitemap should include:

- Homepage
- Main property index page
- Main broker and agency index pages
- Every published property URL
- Every public broker URL
- Every public agency URL

Use each record's `updatedAt` as `lastModified` where available.

The sitemap must not include:

- Drafts
- Private profiles
- Preview URLs
- Workspace URLs
- Admin/control-room URLs
- Login/register pages
- Search-result URLs with uncontrolled query combinations

`robots.ts` should allow public pages and disallow private application areas. Use `noindex` for pages that must not appear in search; `robots.txt` alone is not a reliable noindex mechanism.

## Phase 7 — Search-friendly location landing pages

Create a controlled set of useful permanent pages, for example:

```text
/properties/dubai-marina
/properties/dubai-marina/apartments-for-sale
/properties/dubai-marina/apartments-for-rent
/properties/downtown-dubai/villas-for-sale
/brokers/dubai
/agencies/dubai
```

Each landing page should contain:

- An indexable heading
- Original area-specific introduction
- Current matching properties
- Links to brokers and agencies serving the area
- Links to related areas
- Unique metadata
- Breadcrumbs

Do not create thousands of thin pages for every possible filter combination.

## Phase 8 — Internal linking and crawl paths

Ensure important pages can be reached through normal HTML links.

Recommended linking structure:

```text
Homepage
  └── Location landing page
        ├── Property page
        │     └── Listing broker page
        └── Related property pages
```

Add links from:

- Homepage popular areas
- Property search results
- Broker portfolios
- Agency pages
- Similar-property sections
- Breadcrumbs
- Community/location landing pages

Use descriptive anchor text such as `2-bedroom apartment in Dubai Marina` instead of `Click here`.

## Phase 9 — Content quality and trust

For each public property, require before publication:

- Accurate title and location
- Current price
- Property type
- Size and room counts
- High-quality images
- Useful description
- Responsible broker
- Permit/verification information where required
- Last-updated date

For each broker, require:

- Real name or approved business name
- Public professional profile
- Service areas
- Contact method
- Verification status
- Active portfolio links

Remove expired, duplicate and misleading listings quickly. Search engines and AI systems are more likely to use pages that are complete, current and consistent.

## Phase 10 — Search engine registration and monitoring

After deployment to a public HTTPS domain:

1. Replace `NEXT_PUBLIC_SITE_URL` with the deployed public URL.
2. Verify the production domain in Google Search Console.
3. Submit `https://your-domain.com/sitemap.xml`.
4. Inspect representative property, broker, agency and location URLs.
5. Use the rendered-page inspection to verify that the complete content is visible without interaction.
6. Test structured data with Google's Rich Results Test and Schema Markup Validator.
7. Monitor Page Indexing, Core Web Vitals and crawl errors.
8. Request indexing for a small number of important URLs after launch.
9. Review logs for crawler requests and server errors.
10. Track organic impressions, clicks and enquiries.

Indexing may take days or weeks and is not guaranteed for every URL.

## Phase 11 — AI search readiness

There is no reliable switch that forces AI search systems to recommend a website. AI systems generally need to be able to discover and access the same public, indexable pages used by search engines.

Improve the probability of being referenced by:

- Publishing complete server-rendered pages
- Using clear headings and plain factual language
- Stating exact locations, prices and property details
- Linking properties to their brokers and agencies
- Keeping availability and prices current
- Adding structured data
- Earning links and mentions from reputable UAE real estate sources
- Publishing useful guides such as Dubai community, buying and renting guides
- Avoiding duplicate, auto-generated or misleading content

Do not create AI-only text that is not useful to buyers. The visible page content must be accurate and support any claims made in metadata or structured data.

## Suggested implementation order

1. Rotate exposed credentials and confirm production configuration.
2. Decide public/indexable data rules.
3. Server-render property pages.
4. Server-render broker and agency pages.
5. Add dynamic metadata and canonical URLs.
6. Add JSON-LD structured data.
7. Add sitemap and robots controls.
8. Add selected location landing pages.
9. Improve internal linking and content quality checks.
10. Deploy, submit the sitemap and monitor Search Console.

## Definition of done

- `view-source:` for a property page contains the property title, facts, description and broker link.
- Every public property and broker has a unique canonical URL.
- Private and preview pages return `noindex`.
- `/sitemap.xml` contains all eligible public URLs.
- `/robots.txt` links to the sitemap and protects private application routes.
- JSON-LD matches the visible content.
- Property and broker pages work without login.
- Google Search Console can crawl and render representative pages.
- Expired and unpublished listings are removed or correctly marked.
