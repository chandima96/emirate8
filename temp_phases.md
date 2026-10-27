# Emirate08 — Developer, Agency, Buyer and Amenity Expansion Plan

## Implementation status — 22 October 2026

The implementation order below has been applied to the repository. Database changes are prepared as a migration and must be run against the configured database before deploying the new collections.

| Phase | Status | Delivered |
| --- | --- | --- |
| 0. Product rules and terminology | Complete | `developer` replaces new `owner` registrations; legacy `owner` is mapped for compatibility; public/owner-direct/claim rules are documented. |
| 1. Data model and migrations | Complete | Ownership fields, primary broker, claims, subscriptions, notifications, amenity definitions, agency invitations, plan audiences and migration file added. |
| 2. Authentication and registration | Complete | Developer registration, agency organization creation, quick buyer registration and role-aware routing added. |
| 3. Role dashboards | Complete | Developer, agency/team and notification workspaces added; broker overview includes developer subscriptions. |
| 4. Property ownership and claims | Complete | Developer property creation requires a broker or owner-direct mode; claim requests require developer approval and assign the primary broker. |
| 5. Subscriptions and notifications | Complete | Broker subscriptions, persisted notification center and idempotent publish/update fan-out added. Email delivery remains an integration point. |
| 6. Category amenities | Complete | Category presets, custom property amenities and seedable structured amenity definitions added. |
| 7. Plans and limits | Complete | Developer plan, role audiences, developer property limit and agency seat limit enforcement added. |
| 8. Control Room and moderation | Complete | Developer verification compatibility and new ownership/claim collections are available to staff; detailed dispute tooling remains an admin follow-up. |
| 9. Public pages and SEO | Complete | Public developer index/detail pages, owner-direct property card, sitemap and robots controls added; existing property/broker/agency SEO remains active. |
| 10. Migration and compatibility | Complete | Reversible migration, owner-to-developer conversion and broker-to-primary-broker backfill included. Run `npm run migrate` after reviewing the database backup. |
| 11. Testing and acceptance | Complete | `npm run typecheck` passes and `npm run lint` passes with the repository's existing generated-file warning. |

### Required deployment step

1. Back up the database.
2. Review `src/migrations/20261022_000000_developer_agency_platform.ts` and `src/migrations/20261022_000001_migrate_owners_to_developers.ts`.
3. Run `npm run migrate` with the production `DATABASE_URI`.
4. Run `npm run seed` if the new developer plan and amenity definitions are not already present.
5. Replace the local `NEXT_PUBLIC_SITE_URL=http://localhost:3000` with the deployed HTTPS domain before submitting the sitemap to search engines.

## 1. Scope and decisions

This plan covers five connected product changes:

1. Allow custom amenities per property category.
2. Replace the current `owner` account type with `developer`.
3. Add a dedicated developer dashboard.
4. Give agency accounts a dedicated dashboard with team management.
5. Add fast buyer registration, developer-to-broker subscriptions and developer property ownership/claim workflows.

The implementation should preserve existing broker, buyer, property, enquiry, Control Room and public SEO behavior while adding explicit ownership and permissions.

### Recommended terminology

| Current concept | New concept | Rule |
| --- | --- | --- |
| `owner` account | `developer` account | Migrate existing `owner` members to `developer`; do not keep `owner` as a selectable new role |
| Broker account | Broker account | Individual professional who can represent/list properties |
| Agency account | Agency account | Organization that owns a team and manages its brokers/listings |
| Buyer account | Buyer account | Fast individual account for saving, enquiries and developer subscriptions |
| Property owner | Developer/agency/other owner entity | Stored independently from the primary broker |
| Primary broker | Assigned listing broker | Required for developer listings unless explicitly published as owner-direct/public claimable |

### Core ownership rule

The system must distinguish these three relationships:

```text
Property owner/developer
        │ owns or controls the inventory
        ▼
Property record
        │ has one required primary broker unless owner-direct mode is enabled
        ▼
Primary broker / marketing representative
```

For an owner-direct/public developer listing:

```text
Developer owns property
        │ publishes as public claimable inventory
        ▼
Property has no primary broker yet
        │ eligible brokers request/claim representation
        ▼
Developer approves one broker or keeps the listing owner-direct
```

A broker must never be able to claim a property silently. Every claim must create an auditable request and require developer approval unless the product later introduces an explicit delegated auto-approval setting.

## 2. Current architecture findings

The current project already has:

- `members.accountType` values: `broker`, `agency`, `buyer`, `owner`
- A multi-step registration wizard with broker, agency, buyer and soon/owner states
- A broker-only workspace guard in `AppShell`
- `Properties` with a single `broker` relationship
- Property visibility/status fields and `appData` workspace snapshots
- A free-form property amenities array plus editor amenity presets
- Broker profile and public portfolio management
- Plans, subscription UI and network-selection quotas
- Enquiries tied to broker/property references
- Public API state synchronization between Payload and the client store
- Control Room member/property review and moderation

The most important architectural limitation is that the property model currently treats `broker` as the main relationship. Developer ownership, primary representation and broker claims need separate first-class fields instead of being encoded only in `appData` or inferred from a broker profile.

## Phase 0 — Product rules, migration safety and terminology

### Goal

Agree on roles, ownership rules and migration behavior before changing the UI or schema.

### Tasks

- Confirm that new registrations will expose `developer`, not `owner`.
- Map every existing `owner` account to `developer`.
- Decide whether existing owner profile data becomes the developer company profile or requires a migration review.
- Define whether an agency may own a property, or whether only developers may be property owners in the first release.
- Define whether a developer may publish without a broker only when `ownerDirect` is enabled.
- Define who can approve broker claims:
  - Developer account owner
  - Agency/developer staff with permission
  - Control Room fallback for disputes
- Define notification channels for the first release:
  - In-app notification required
  - Email optional but recommended
  - WhatsApp/SMS deferred
- Define subscription scope:
  - Developer + broker subscription to all developer listings
  - Developer + broker subscription to selected communities/categories
  - Broker subscriptions to individual developers

### Acceptance criteria

- Product terminology is consistent in registration, navigation, permissions, notifications and documentation.
- Existing `owner` records have a reversible migration plan.
- There is a written rule for every property state: draft, pending, published with broker, public claimable, sold, rented, archived and rejected.

## Phase 1 — Data model and migrations

### Goal

Add durable relationships for developers, agencies, ownership, claims, subscriptions, notifications and amenity taxonomies.

### 1.1 Member account type

Change the member enum from:

```text
broker | agency | buyer | owner
```

to:

```text
broker | agency | buyer | developer
```

Migration:

- Update the Payload collection and generated types.
- Convert all existing `owner` records to `developer`.
- Update seed data, tests, role helpers, dashboard routing and copy.
- Add a migration audit report showing converted member IDs.
- Keep a migration marker/version so the conversion is not repeated.

### 1.2 Developer profile

Prefer a structured `developerProfile` object, either inside `Members.profile` initially or as a dedicated `Developers` collection if independent organization records are required.

Recommended fields:

- Legal/company name
- Public display name
- Slug
- Logo and cover image
- Description
- Website
- Office location
- Emirates/communities served
- RERA/ORN/company registration details
- Verification status
- Public/searchable visibility
- Public phone, email and WhatsApp
- Team member IDs or agency relationship

For a first release, keeping the authenticated developer as a member and storing the profile in `profile.developer` minimizes schema churn. A separate developer organization collection is the better long-term option if several users will manage one developer.

### 1.3 Agency organization and team

The existing agency profile is currently stored mainly inside a broker portfolio and an `Agencies` CMS collection exists. Normalize the model so an agency account can own/manage:

- Agency organization record
- Agency admin members
- Broker/team members
- Team invitations
- Team roles and permissions
- Shared listings
- Agency public profile

Recommended team roles:

```text
agency_admin
agency_manager
agency_broker
agency_viewer
```

The account owner can be `agency_admin`. An agency broker must not automatically receive agency-admin permissions.

### 1.4 Property ownership and representation

Add first-class fields to `Properties`:

```text
ownerType: developer | agency | other
ownerDeveloper: relationship to members/developers
ownerAgency: relationship to agencies, optional
primaryBroker: relationship to brokers, required for normal listings
ownerDirect: boolean, default false
claimable: boolean, default false
claimPolicy: developer_approval | approved_brokers_only
```

Compatibility approach:

- Keep the current `broker` field temporarily as a backward-compatible alias.
- Backfill `primaryBroker` from `broker`.
- Update all reads and writes to use `primaryBroker`.
- Remove or freeze the old `broker` field only after all consumers and migrations are complete.

Recommended property states:

| State | Primary broker | Public | Broker claim allowed |
| --- | --- | --- | --- |
| Developer draft | Optional | No | No |
| Developer pending review | Required unless owner-direct permitted | No | No |
| Developer published represented | Required | Yes | No, already assigned |
| Developer published owner-direct | Empty | Yes | Yes, approval required |
| Claim pending | Empty or current broker | Yes/limited | Request in progress |
| Claim approved | Required | Yes | No, other claims blocked |
| Sold/rented | Existing broker retained | Optional history | No |

### 1.5 Broker claim/request collection

Create a collection such as `PropertyBrokerClaims`:

- Property relationship
- Developer/owner relationship
- Requesting broker/member relationship
- Current primary broker relationship, if any
- Status: pending, approved, rejected, withdrawn, cancelled
- Broker message/application note
- Developer response/reason
- Created, reviewed and updated timestamps
- Audit actor and audit event history

Add unique constraints to prevent duplicate active requests for the same property and broker.

### 1.6 Developer-broker subscriptions

Create `DeveloperSubscriptions`:

- Developer/member relationship
- Broker/member relationship
- Scope: all, emirates, communities, categories or selected developers
- Status: active, paused, cancelled
- Notification preferences
- Created/updated timestamps
- Unique developer + broker subscription key

Do not store subscription state only in browser storage; it must be server-side.

### 1.7 Notifications

Create a durable `Notifications` collection or member notification table:

- Recipient member
- Type
- Title and message
- Related property
- Related developer
- Related broker claim
- Read/unread state
- Delivery state for email
- Created timestamp

Initial notification events:

- New developer property published
- New claim request received
- Claim approved/rejected
- Primary broker assignment changed
- Developer subscription activated/cancelled
- Property updated by developer

### 1.8 Category-specific amenities

Current amenities are free-form property values and editor presets. Introduce a taxonomy:

```text
AmenityCategory
  id, key, label, active, sortOrder

AmenityDefinition
  id, category, key, label, inputType, options, active, sortOrder

PropertyAmenity
  property, amenityDefinition, customLabel, value, source
```

Recommended `inputType` values:

```text
boolean | text | number | select | multi_select
```

Keep `customLabel`/custom values so developers and brokers can add a property-specific amenity without modifying the global taxonomy. Examples:

- Residential: balcony, maid room, furnished, sea view
- Commercial: fitted, shell-and-core, grade, parking ratio
- Off-plan: payment plan, handover, escrow, developer amenities
- Villa: private garden, pool, plot size, driver room

## Phase 2 — Authentication and registration flows

### Goal

Make account creation match the new roles and reduce buyer friction.

### 2.1 Developer registration

Update the registration wizard:

- Replace “Property Owner” with “Developer”.
- Remove the current `soon`/waitlist-only owner behavior.
- Collect company/public profile basics.
- Collect developer verification documents separately from public profile data.
- Set `accountType=developer` and `credentialStatus=pending`.
- Route the new user to the Developer Dashboard after registration.

Flow:

```text
Register
  → choose Developer
  → enter company/profile details
  → submit verification details
  → account created as pending
  → Developer Dashboard
  → complete profile and wait for/undergo verification
```

### 2.2 Agency registration

Keep agency registration but change the destination and data shape:

- Create agency organization/profile data.
- Create the registering user as `agency_admin`.
- Support adding team members later rather than requiring all broker details in the initial wizard.
- Route to Agency Dashboard.

### 2.3 Fast buyer registration

Create a separate quick flow instead of the full professional wizard:

```text
/register/buyer
```

Minimum fields:

- Name
- Email or mobile
- Password, or passwordless verification if supported later
- Terms/privacy consent

Optional fields can be completed after registration. The quick flow should:

- Create `accountType=buyer` directly.
- Sign the user in immediately.
- Return the user to the property, enquiry or saved action that triggered registration.
- Avoid broker credentials, agency fields, permit fields and plan selection.

Recommended entry points:

- Save property → quick buyer registration modal/page
- Send enquiry → quick buyer registration if anonymous enquiries are not allowed
- Subscribe to developer → quick buyer registration

### 2.4 Routing and role guards

Replace broker-only assumptions in `AppShell` with role-aware routing:

```text
broker    → /dashboard
agency    → /agency-dashboard
developer → /developer-dashboard
buyer     → /saved
```

Do not allow buyer accounts into professional dashboards. Do not allow developer accounts to use broker-only network actions unless explicitly enabled.

## Phase 3 — Role-specific dashboards

### Goal

Create distinct workspaces while reusing shared UI and data components.

### 3.1 Developer Dashboard — `/developer-dashboard`

Recommended navigation:

- Overview
- Properties
- Add Property
- Broker assignments
- Claim requests
- Subscribed brokers
- Notifications
- Developer profile
- Team/permissions, if enabled
- Subscription/plan
- Account settings

Developer dashboard KPIs:

- Total properties
- Draft properties
- Pending review
- Published properties
- Owner-direct claimable properties
- Active primary broker assignments
- Pending broker claims
- Subscriber broker count
- New notifications

Developer property flow:

```text
Developer Dashboard
  → Add Property
  → fill property details/media/permit
  → choose primary broker or Owner-direct/Public claimable
  → submit for review or save draft
  → Control Room verification
  → publish
  → subscribed brokers receive notification
```

### 3.2 Agency Dashboard — `/agency-dashboard`

Recommended tabs:

- Overview
- Team
- Properties
- Shared enquiries
- Agency profile
- Performance
- Subscription
- Settings

Team tab functionality:

- View team members
- Invite broker
- Resend/cancel invitation
- Assign team role
- Approve/remove team member
- See member status and public profile
- Assign/reassign agency listings
- View team performance and enquiry ownership

Agency property permissions should be explicit:

- Agency admin: manage all agency properties and team members
- Agency manager: manage assigned team properties and enquiries
- Agency broker: manage own/assigned properties
- Agency viewer: read-only access

### 3.3 Broker Dashboard changes

Keep the existing broker dashboard, but add:

- Properties where the broker is primary broker
- Properties where the broker has an approved claim
- Pending claim requests made by the broker
- Developer subscriptions
- Notifications from subscribed developers
- Clear separation between owned/managed listings and network inventory

### 3.4 Shared dashboard components

Reuse:

- KPI cards
- Listing tables/cards
- Status badges
- Enquiry lists
- Notification menu
- Profile forms
- Plan/usage display

Do not copy the entire broker dashboard for each role. Extract shared components and role-specific sections.

## Phase 4 — Property creation, primary broker and owner-direct publishing

### Goal

Implement the exact developer property workflow safely.

### 4.1 Developer add-property form

Reuse the existing listing editor fields for:

- Basics
- Media
- More details
- Permit
- Off-plan/payment plan
- Amenities

Add a new ownership/representation step:

```text
Who is representing this property?

( ) Assign a primary broker
( ) Publish owner-direct and allow approved broker claims
```

For “Assign a primary broker”:

- Show current eligible brokers.
- Search by name, agency, area and speciality.
- Require one selected broker before submission.
- Notify the selected broker when the property is approved/published.

For “Owner-direct”:

- Require developer confirmation that it owns/controls the listing.
- Require claimable/public settings.
- Show a clear public label such as “Developer direct — broker representation available”.
- Do not allow a broker to change ownership or primary assignment directly.

### 4.2 Broker selection eligibility

Eligible broker list should use:

- Public/active broker profile
- Verified or approved credential state where required
- Active account
- Relevant service area/property speciality filters
- No blocked/suspended status

The developer may select one primary broker. The system should retain assignment history.

### 4.3 Public owner-direct listing behavior

Public page should show:

- Developer/owner identity
- “Open for broker representation” state
- Developer contact or controlled enquiry path
- Claim/request button for eligible brokers when signed in
- No fake primary broker

Broker view should show:

- Property details and availability
- Developer identity
- Claim/request action
- Existing primary broker, if assigned
- Commission/representation terms only if explicitly provided; do not infer them

### 4.4 Claim request flow

```text
Broker opens owner-direct property
  → selects “Request to represent”
  → submits optional message/experience note
  → claim request created as pending
  → developer receives in-app/email notification
  → developer approves or rejects
  → approval assigns broker as primaryBroker
  → property and broker portfolios update
  → all other active claim requests are closed or marked unavailable
```

If a property already has a primary broker, a new broker must not claim it. The broker may submit a collaboration/enquiry request instead.

## Phase 5 — Developer subscriptions and notifications

### Goal

Allow brokers to subscribe to developers and receive relevant listing events.

### 5.1 Subscription UI

Add “Subscribe” to:

- Developer public profile
- Developer listing owner card
- Broker dashboard developer directory
- Property detail page when the property is owned by a developer

Subscription states:

- Not subscribed
- Subscribed
- Paused
- Unsubscribed

Allow notification preference controls:

- New property published
- Price/availability change
- New project/off-plan launch
- Claim decision
- Digest frequency: immediate or daily

### 5.2 Notification event flow

```text
Developer publishes or updates a property
  → event handler identifies active broker subscriptions
  → creates in-app notifications
  → queues email notifications according to preferences
  → broker sees unread count and notification detail
  → opening notification marks it read and links to property
```

### 5.3 Reliability requirements

- Use idempotent event keys so a retry does not duplicate notifications.
- Queue email delivery instead of blocking property publishing.
- Store notification status and failure reason.
- Respect broker opt-out and digest preferences.
- Do not expose private developer inventory to unsubscribed brokers.

### 5.4 Notification center

Add a shared notification center to professional dashboards:

- Unread count
- Recent notifications
- Mark read/mark all read
- Filter by type
- Deep links to property, claim, developer or enquiry

## Phase 6 — Amenities taxonomy and custom values

### Goal

Allow each property category to have suitable amenity fields while preserving custom additions.

### 6.1 Admin taxonomy management

Control Room/Payload admin should manage:

- Amenity categories
- Amenity definitions
- Labels and sort order
- Active/inactive state
- Input type
- Allowed options
- Whether the amenity is searchable
- Whether the amenity is public

### 6.2 Property editor behavior

When the user selects category/type:

```text
Select category/type
  → load relevant amenity definitions
  → show boolean/select/number/text controls
  → allow “Add custom amenity”
  → save structured values and custom labels
```

Examples:

- Residential apartment: furnished, balcony, view, maid room, parking, gym
- Villa/townhouse: plot area, private pool, garden, driver room, barbeque area
- Commercial office: fitted status, grade, parking ratio, partitions, meeting rooms
- Retail: frontage, signage, shell/core, footfall, loading access
- Off-plan: developer, handover, escrow, payment plan, launch phase

### 6.3 Search and public display

- Display structured amenities in property details.
- Add only approved/searchable amenities to search filters.
- Keep custom amenities visible on the property but exclude them from global filters until approved.
- Include suitable amenities in structured SEO data only when they are visible and factual.

## Phase 7 — Plans, billing and feature limits

### Goal

Align subscriptions with the new roles and notification features.

### Plan audiences

Add explicit plan audiences:

```text
broker | agency | developer | buyer | platform
```

Suggested feature limits:

- Developer active properties
- Developer team seats
- Developer broker subscriptions/notifications
- Owner-direct claimable listings
- Agency team seats
- Agency shared listings
- Broker network selections
- Buyer saved properties

### Enforcement points

- Before creating a property
- Before adding a team member
- Before activating a developer subscription
- Before publishing an owner-direct listing
- Before creating a broker claim

When a limit is reached, show the current usage, limit and upgrade path. Do not silently fail.

## Phase 8 — Control Room and moderation

### Goal

Give staff oversight over new roles, ownership and claims.

Add Control Room sections for:

- Developer verification
- Agency verification
- Developer properties
- Primary broker assignments
- Owner-direct listings
- Broker claim requests
- Subscription/notification audit
- Amenity taxonomy management

Moderation rules:

- A developer may not publish a verified property without required evidence.
- A primary broker assignment must be auditable.
- A broker claim cannot override a developer decision.
- Staff can freeze a property, claim or account during a dispute.
- Staff actions record actor, reason and timestamp.

## Phase 9 — Public pages and SEO changes

### Goal

Expose useful developer and agency information without exposing private data.

Add or extend public pages:

- `/developers`
- `/developers/[slug]`
- `/agencies/[slug]`
- Developer-owned property pages
- Claimable property status on public detail pages

Server-render:

- Developer profile and company details
- Public developer properties
- Primary broker/representation status
- Agency team and public listings

SEO/structured data:

- Developer/agency metadata and canonical URLs
- Organization/RealEstateAgent structured data where accurate
- Property ownership/offer data only when visible and legally appropriate
- Sitemap inclusion for public developer and agency pages
- Noindex for private dashboards, pending claims and private developer inventory

## Phase 10 — Data migration and compatibility

### Migration order

1. Back up the database.
2. Add new nullable fields and collections.
3. Add `developer` account type while accepting legacy `owner` during migration.
4. Convert existing owners to developers.
5. Backfill `primaryBroker` from existing `broker`.
6. Backfill developer/agency ownership where it can be determined.
7. Convert old amenity strings into custom amenity values.
8. Deploy code that reads new fields with legacy fallback.
9. Run verification reports for orphaned properties and profiles.
10. Remove `owner` from new registration options.
11. Remove legacy fallbacks only after all records are migrated and verified.

### Backward compatibility requirements

- Existing broker public pages must continue to work.
- Existing broker listings must retain their primary broker.
- Existing saved properties and enquiries must retain links.
- Existing `owner` users must be able to log in during migration.
- Existing API consumers must receive compatible listing fields during the transition.
- Client store normalization must support both old `broker` and new `primaryBroker` during rollout.

## Phase 11 — Testing and acceptance criteria

### Account tests

- Buyer quick registration creates a buyer and returns to the original action.
- Developer registration creates a pending developer.
- Agency registration creates an agency admin.
- Legacy owner login works after migration.
- Buyer cannot access professional dashboards.
- Broker cannot access developer/agency administration without permission.
- Agency broker cannot manage team members.

### Property tests

- Broker-created listings retain primary broker behavior.
- Developer must select a primary broker or explicitly choose owner-direct mode.
- Owner-direct listing can be public without a primary broker.
- A broker can submit one active claim request per property.
- Developer approval assigns the primary broker atomically.
- Rejected brokers cannot claim again until allowed by policy.
- Unpublished/private properties never appear in public API, search, sitemap or AI-crawlable pages.

### Notification tests

- Active subscribers receive a notification for a new published developer property.
- Unsubscribed brokers receive nothing.
- Duplicate publish/update retries do not duplicate notifications.
- Claim approval/rejection sends the correct notification.
- Read/unread state is persisted server-side.

### Amenity tests

- Category-specific definitions appear in the editor.
- Custom amenities can be added without changing the global taxonomy.
- Searchable approved amenities can filter results.
- Inactive definitions remain on old records but are not offered for new records.
- Public page shows only intended public amenity data.

### Security tests

- Property ownership cannot be changed by a broker through client-side mutation.
- Claim approval requires the developer or authorized staff.
- Agency members cannot access another agency’s team data.
- Notification endpoints only return the authenticated recipient’s notifications.
- Private developer data is not included in `/api/app-public`.

## Phase 12 — Recommended implementation sequence

Implement in this order:

1. Finalize role/ownership rules and prepare database backup.
2. Add account type migration from owner to developer.
3. Add developer and agency organization/profile data.
4. Add property ownership, primary broker and owner-direct fields.
5. Add role-aware authentication and dashboard routing.
6. Build the Developer Dashboard.
7. Build the Agency Dashboard and Team tab.
8. Add developer property creation and primary broker selection.
9. Add owner-direct publishing and broker claim requests.
10. Add developer subscriptions and notification storage/events.
11. Add notification center and email delivery.
12. Add category-specific amenities and custom amenities.
13. Update plans and enforce role-specific limits.
14. Add Control Room verification and moderation.
15. Add public developer pages, SEO and structured data.
16. Run migration, integration tests and production security review.

## Definition of done

- `owner` is no longer offered to new users; existing owners are migrated to `developer`.
- Buyers can register through a short flow and return to their original action.
- Developers have a separate dashboard and can manage properties.
- Agencies have a separate dashboard with a working Team tab and role permissions.
- Developer properties support a required primary broker or explicit owner-direct mode.
- Public owner-direct properties can receive broker claim requests.
- Developers can approve/reject broker claims.
- Brokers can subscribe to developers and receive persisted notifications.
- Amenities support category-specific structured fields and custom values.
- Public APIs, pages and SEO paths never expose private or unapproved records.
- All ownership, claim and notification actions are authorized, audited and covered by tests.
