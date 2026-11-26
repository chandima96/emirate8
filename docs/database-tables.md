# Database table guide

This guide maps the ERD to the current application. The project uses Payload CMS 3 with PostgreSQL (configured in `payload.config.ts`). The Payload collection definitions in `src/collections/` and migrations in `src/migrations/` are the source of truth; the attached ERD is a visual reference. Payload collection slugs generally become snake_case PostgreSQL tables. Payload arrays are stored in separate child tables with `_parent_id` and `_order`; relationship columns refer to the related collection's `id`. Payload also adds `created_at` and `updated_at` fields that the ERD omits.

## How the data fits together

- **Listings and media:** `properties` stores the listing and points to `media`, `members` (developer owner), and `agencies`. A property has **up to 5 brokers** (no primary broker), linked through `properties_rels`. Listing highlights, amenities, photos, floor plans, and off-plan payment milestones are array child tables.
- **People and organizations:** `members` are platform-facing accounts (brokers, agencies, developers, and other roles). `brokers` and `agencies` hold public directory/profile data. Payload administrators are separate `users`.
- **Workflow:** `enquiries`, `property_broker_claims`, `notifications`, `agency_invitations`, and `developer_subscriptions` record contact and collaboration activity.
- **Property feed API:** `api_feeds` holds each independent broker's or agency admin's API key (hashed) and which published properties their feed shares with external websites.
- **Billing and AI:** `plans` defines the catalogue; `membership_payments` records manually recorded payment history; `ai_usage` records metered AI activity.
- **Admin and public content:** `amenity_definitions`, `seo_content`, `waitlist_signups`, and Payload's internal tables support configuration, page metadata, lead capture, authentication, and CMS operations.

## Listings and media

| Table | Purpose and key data | Main links |
|---|---|---|
| `properties` | Main property listing: title, slug/reference, publication status, purpose/category/type, emirate and address, price and specifications, description, permit details, owner, visibility, and rent/off-plan settings. `app_data` (JSON) keeps the full workspace listing, including `ownerMemberId`. | `featured_image_id`, `permit_document_id` → `media`; brokers through `properties_rels` (up to 5); `owner_developer_id` → `members`; `owner_agency_id` → `agencies`; `app_data->>'ownerMemberId'` → `members` (application join, not a foreign key). |
| `properties_rels` | The property's brokers: one row per broker, at most 5 per property, `path = 'brokers'`. There is no primary broker; `order` is only the display order. Replaced the old `broker_id` and `primary_broker_id` columns (migration `20261126_000001_property_brokers`). | `parent_id` → `properties` (cascade delete); `brokers_id` → `brokers` (cascade delete). |
| `properties_highlights` | Ordered highlight strings for a property (for example, a view or building feature). | `_parent_id` → `properties`. |
| `properties_amenities` | Ordered amenity strings attached to a property. | `_parent_id` → `properties`. |
| `properties_photos` | Ordered gallery entries, with media reference and optional caption. | `_parent_id` → `properties`; `image_id` → `media`. |
| `properties_floorplans` | Ordered floor-plan entries, with media reference and optional label. | `_parent_id` → `properties`; `image_id` → `media`. |
| `properties_offplan_payment_plan` | Ordered off-plan payment milestones, each with a label and percentage. | `_parent_id` → `properties`. |
| `media` | Upload catalogue and metadata (file URL/name/type/size, alt text, caption, and source path). The binary files live in configured S3-compatible storage or the app's bundled-media fallback. | Referenced by properties, brokers, and agencies. |

## People and organizations

| Table | Purpose and key data | Main links |
|---|---|---|
| `members` | Authenticated platform accounts and business identity: name/email, account type, mobile/profile, credential review, plan and membership snapshot/status, and access/suspension flags. | Parent of `members_sessions`; referenced by listings, enquiries, claims, notifications, invitations, subscriptions, payments, AI usage, and member state. |
| `members_sessions` | Active/previous Payload authentication sessions for members, with creation and expiry times. | `_parent_id` → `members`. |
| `brokers` | Public broker profile: name/slug, RERA number, agency, title, bio, contact/social details, experience and rating stats, verification/featured flags. A member's profile is mirrored here, with `app_data->>'ownerMemberId'` pointing back to the member. | `photo_id` → `media`; `agency_id` → `agencies`; parent of broker specialties and languages; referenced by `properties_rels` (property brokers), enquiries, and claims. |
| `brokers_specialties` | Ordered specialty values for a broker profile. | `_parent_id` → `brokers`. |
| `brokers_languages` | Ordered language values for a broker profile. | `_parent_id` → `brokers`. |
| `agencies` | Agency profile and directory data: name/slug, license, description/location/contact, social links, and featured/verified flags. | `logo_id`, `cover_image_id` → `media`; referenced by brokers, properties, enquiries, and invitations. |

## Workflow and communications

| Table | Purpose and key data | Main links |
|---|---|---|
| `enquiries` | Incoming property/contact requests: sender details, message, enquiry kind/type/status, budget, preferred contact/date, source, and internal notes. Keeps property/broker/agency identifiers and text snapshots where useful. | `property_id` → `properties`; `broker_id` → `brokers`; `broker_member_id`, `from_member_id` → `members`; `agency_id` → `agencies`. |
| `property_broker_claims` | A broker's request to represent a claimable developer listing, including review status, messages/reason, and review metadata. Approving a claim adds the broker to the property's brokers; claims stay open until the property has 5 brokers, then the remaining pending claims are cancelled. | `property_id` → `properties`; `developer_id`, `broker_member_id`, `reviewed_by_id` → `members`; `broker_id` → `brokers`. |
| `notifications` | In-app or delivery workflow notices with recipient, type, title/message, read state, delivery result, and event key. Types include `broker_assigned` (sent to each broker newly added to a property; formerly `primary_broker_assigned`). | `recipient_id`, `developer_id` → `members`; `property_id` → `properties`; `claim_id` → `property_broker_claims`. |
| `agency_invitations` | Email invitations for people to join an agency, with role, status, token, inviter, and expiry. | `agency_id` → `agencies`; `invited_by_id` → `members`. |
| `developer_subscriptions` | A broker member's subscription to new listing/update notifications from a developer, including status and frequency preferences. | `developer_id`, `broker_id` → `members` (the field called `broker` in the collection stores a member account). |
| `waitlist_signups` | Public pre-registration/contact interest: email, name, phone, intended role, source, message, and whether contacted. | No required relationship; email is unique. |

## Property feed API

| Table | Purpose and key data | Main links |
|---|---|---|
| `api_feeds` | One row per independent broker or agency admin who uses the property feed API: SHA-256 hash and display prefix of the API key (the key itself is never stored), key creation and last-use time, request count, and the feed selection. With `auto_include_new = true` (default) the feed is every published property except the IDs in `excluded`; with `false` it is only the IDs in `included`. | `member_id` → `members` (unique, cascade delete). See [api-fetch.md](../api-fetch.md) for how a feed request reads the other tables. |

## Billing, AI, and site metadata

| Table | Purpose and key data | Main links |
|---|---|---|
| `plans` | Configurable membership catalogue: audience, monthly price, seat/listing/selection limits, AI credits, highlighting, and order. The `selections` limit is no longer enforced for brokers: the old Selected Properties slots were replaced by the property feed API. | Parent of `plans_features`. Members store the selected plan as a string/snapshot rather than a database relationship. |
| `plans_features` | Ordered feature-description strings for a plan. | `_parent_id` → `plans`. |
| `membership_payments` | Manually recorded membership payment transactions: unique reference, subscriber snapshot, plan snapshot, amount/currency, status, transaction date, and recorder. | Optional `member_id` → `members`. |
| `ai_usage` | AI activity and credit accounting: member using the feature, account/pool charged, model, token/cache/web-fetch counters, credits, outcome, and request ID. | `member_id`, `pool_id` → `members`. |
| `amenity_definitions` | Admin-managed amenity catalogue: category/key/label, input type/options, active/searchable/public flags, and ordering. | No foreign-key relationship; properties currently store chosen amenities as strings in `properties_amenities`. |
| `seo_content` | Generated or curated SEO metadata keyed by public path: content kind/status, title/description, FAQ/issues, source hash, model, generation time, and error. | The path identifies the page/record; it is not a foreign key to the corresponding collection. |

## Payload admin and system tables

| Table | Purpose and key data | Main links |
|---|---|---|
| `users` | Payload CMS staff/admin login accounts, roles, password/auth fields, and account security flags. These are distinct from public/business `members`. | Parent of `users_sessions`; may be referenced by Payload admin relationship tables. |
| `users_sessions` | Payload authentication sessions for staff users, with creation and expiry times. | `_parent_id` → `users`. |
| `payload_locked_documents` | Payload's document-lock records used to prevent conflicting edits in the admin. | Related documents are represented in `payload_locked_documents_rels`. |
| `payload_locked_documents_rels` | Polymorphic relationship rows connecting document locks to collections (for example users, media, properties, brokers, agencies, plans, api feeds, and other collections). `path` and collection-specific ID columns identify the target. | `parent_id` → `payload_locked_documents`; collection-specific `*_id` columns reference their target tables. |
| `payload_preferences` | Saved per-user Payload admin preferences, such as UI state. | Related user links are in `payload_preferences_rels`. |
| `payload_preferences_rels` | Relationships from a preference record to the account that owns it. | `parent_id` → `payload_preferences`; `users_id` and, in current schema, `members_id` → respective account tables. |
| `payload_migrations` | Migration ledger recording which database migrations Payload has applied. | No application-level foreign keys. |

## Reading the ERD accurately

The image groups tables by domain and shows selected columns. Some labels combine several real fields for readability (for example coordinates, contact/social fields, or security fields). Array tables use Payload's `_parent_id` and `_order` convention; these are implementation tables generated from collection `array` fields, not separate user-facing concepts. Many-to-many relationships (such as a property's brokers) use `<collection>_rels` tables with `parent_id`, `path`, `order` and a `<target>_id` column.

The ERD image predates two changes: `properties.broker_id` / `primary_broker_id` were replaced by `properties_rels` (up to 5 brokers per property), and `api_feeds` was added. Update the image when it is next regenerated. The actual field definitions and relationship targets can change over time, so check `src/collections/` and `src/migrations/` when making schema changes.
