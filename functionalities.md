# Emirate08 — Current Functionality and User Flows

This document describes the behavior implemented in the current source tree. It distinguishes persisted workflows from demonstrations and provider integrations that are not enabled. Routes below are Next.js application routes unless identified as API routes.

## 1. Product overview

Emirate08 is a UAE real-estate portal and workspace for buyers/tenants, brokers, agencies, developers and Control Room staff. It includes:

- Public property search and detail pages, broker and agency directories/profiles, and developer directory/profiles.
- Buyer accounts, saved properties and activity views.
- Broker listing, profile, enquiry, network and account tools.
- Agency dashboards, team invitations, agency listings and verification workflow.
- Developer projects/properties, broker representation claims, subscriptions and notifications.
- Control Room member/credential review, staff management and property moderation.
- Payload CMS collections and API routes backed by PostgreSQL, with optional S3-compatible media storage.

Sample inventory and demo controls are present alongside records created by members. Public visibility depends on publication state, display settings, profile visibility and privacy settings.

## 2. Roles and access

### Guest

Can browse public pages, search and filter visible listings, open public profiles, view help/legal/marketing pages, and submit the seller waitlist form. Account-specific actions lead to authentication.

### Buyer

Can use a buyer account to save properties and view saved/recent/enquiry activity. Buyers do not receive broker or agency workspace access.

### Broker

Can manage listings, a public broker portfolio, enquiries, selected network properties, developer subscriptions/claims, notifications, plan preferences and account settings. Credential review is required for publishing; the UI also provides a clearly labelled demo verification control.

### Agency and agency team members

Agency accounts have a dedicated dashboard, team and invitation management, agency property/enquiry views, developer network, notifications, verification and subscription/account access. Agency brokers are associated with the agency and can manage their own broker profile and listings subject to agency and credential rules. Agencies and individual brokers are distinct account types.

### Developer

Can manage a developer profile, developer-owned inventory, primary broker assignment, owner-direct publication/claimability, broker claims, subscribers and notifications. The legacy `owner` account type is normalized to developer in relevant workspace logic.

### Control Room staff

Control Room roles are administrator, subadmin and verifier. Actions are permission-gated; verifiers have narrower review permissions. Payload Admin users and application Control Room members are separate account/access paths.

## 3. Public website

### Homepage — `/`

The homepage includes a Dubai-focused hero/search, buy/rent/sell entry points, community shortcuts, recent/recommended listings, a budget explorer, community imagery, agent/agency discovery links and the public header/footer. The Sign In control opens an account-choice flow for Buyer/Tenant or Professional access. The buyer flow offers Google or email registration.

```text
Homepage → enter a keyword or choose a purpose → /properties with query parameters
          → refine results → open /property/[slug]
```

### Property search — `/properties`

Search supports keyword matching, sale/rent purpose, property type, bedrooms, price, ready/off-plan completion, community shortcuts and sorting. Search state is reflected in the URL; filters can be reset. Result cards link to property detail pages. Public inventory is filtered according to publication and visibility rules.

### Property detail — `/property/[slug]`

The page renders published, visible property data normalized from the CMS, attaches broker/developer context where available and returns 404 for missing or unavailable records. It includes:

- Price, purpose, completion state, location and property characteristics.
- Featured image/gallery and lightbox; optional floor plans, video, virtual tour, master plan and brochure.
- Description, highlights, features/amenities, grouped details and off-plan payment plan.
- A demonstration map with approximate community positioning and community insights.
- Mortgage, purchase-cost, rental-affordability and off-plan payment-plan calculators.
- Listing contact card, broker/developer context, similar properties and mobile contact bar.
- Save/favourite and share controls.

Phone, email and WhatsApp controls may open the corresponding external contact method. Enquiry and viewing requests submitted through the app are stored for the listing broker. A signed-in user can save listings to their account.

### Broker and agency directory — `/agents`

Visitors can switch between broker/agent and agency views, search by name, agency, specialty or location, browse public/featured cards and load additional results. Cards lead to `/brokers/[slug]` and `/agencies/[id]`.

### Broker portfolio — `/brokers/[slug]`

Public broker pages show profile/cover images, name and professional details, agency, location, credentials/badges where supplied, biography, specialities, languages, experience, portfolio listings, and optional sold/rented history. Portfolio filters include purpose, completion, type, area, price and bedrooms; sorting, contact links and sharing are available. `me` is used for the signed-in member's portfolio route; draft preview and embedded display modes are supported by query parameters. Private or non-searchable profiles are excluded from ordinary public discovery.

### Agency profile — `/agencies/[id]`

Shows public agency identity, location/licence details, verification state where available, about text, public broker team and active agency listings, with paths into broker and property detail pages.

### Developer directory and profile — `/developers`, `/developers/[slug]`

Visitors can browse public developers and their public projects/properties. Published developer properties link back to the developer and property detail pages. Developer visibility settings and listing publication/visibility govern what appears publicly.

### Saved properties and activity — `/saved`

Signed-in buyers can review saved properties and available recent-view/enquiry activity, filter activity where controls are available, and open property/broker links. The favourite control is available on property cards and detail pages. Workspace state is scoped to the authenticated member.

### Seller waitlist — `/sell`

The sell page explains the seller pathway and accepts an email for the owner waitlist. The form submits to the waitlist service/API and presents success or validation feedback. This is a waitlist, not a property listing submission flow.

### Help/contact — `/help`

The form validates name, email and message and displays a success state. **It is currently a frontend demonstration: no message is sent or persisted.**

### Marketing and legal pages

- `/platform` — platform overview and product presentation.
- `/for-professionals` — broker and agency acquisition information.
- `/privacy` and `/terms` — policy pages; image credits are included in Terms.

## 4. Authentication and account security

### Professional registration — `/register`

The registration wizard supports broker, real estate agency and developer account types. It collects account credentials and role-specific information, including profile/agency/developer details and professional credentials where relevant. Registration has multiple steps and creates a member account; credential status is pending until reviewed. Mobile OTP behavior shown in the wizard is a **demo code flow**, not delivery through an SMS provider. Plan selection is part of the registration experience, but no payment is collected.

### Buyer registration — `/register/buyer` and navbar modal

Buyer signup is separate from the professional wizard. The navbar account-choice modal offers Google or email signup. The email form collects name, email, password and terms consent, with password visibility/strength feedback and validation. Google OAuth routes are available when Google credentials and callback configuration are supplied. Successful buyer signup leads to the saved-properties experience.

### Login and logout — `/login`

Users authenticate using email or mobile plus password. The destination is role-aware and respects an allowed `next` destination: professional users enter their workspace, buyers enter the buyer area, and unauthorized workspace access receives guidance. Logout clears the Payload-backed session and returns to `/`.

### Password reset — `/forgot-password`, `/change-password`

Users can request a reset and submit a reset token with a new password through Payload authentication. Email delivery depends on configured mail transport. Authenticated members can change email/password after confirming the current password.

### Account deletion and export

Account settings provide password-confirmed deletion and a browser download of account/workspace JSON. Export is generated client-side from the available account, workspace and enquiry state. Account deletion removes the member's associated account data through server-side handling. The account UI also exposes a workspace reset action; it is distinct from deleting the account.

## 5. Broker and agency workspace

Workspace routes use an authenticated shell and role-aware access checks. Core broker routes include `/dashboard`, `/listings`, `/listings/new`, `/listings/[id]`, `/listings/[id]/edit`, `/profile`, `/network`, `/network/[id]`, `/selected`, `/enquiries`, `/notifications`, `/subscription` and `/account`.

### Dashboard — `/dashboard`

Shows workspace summary, listing/status counts, recent activity/enquiries and network/selected-property information, with shortcuts to common listing and profile tasks. Contents depend on member role and stored data.

### Listings — `/listings`

The listing manager supports browsing/searching/filtering listings and opening detail/editor views. Listing actions include preview, publish/unpublish, feature/portfolio selection where available, mark sold/rented, duplicate, archive and delete. Actions are subject to readiness, credentials, ownership and plan constraints.

### Listing editor — `/listings/new`, `/listings/[id]/edit`

The multi-step editor covers:

1. Classification: ready/off-plan, sale/rent, category and property type (off-plan is sale-only).
2. Location/development: community/building/unit or project/developer/status/handover and related development information.
3. Unit/property facts: title, summary/description, bedrooms, bathrooms, size, parking, furnishing, condition, floor/view and availability.
4. Price and terms: sale/rent pricing and rental terms; off-plan payment-plan milestones can be added, edited, reordered or removed and must total 100%.
5. Marketing: highlights, amenities and selling points.
6. Photos and media: upload, reorder, caption, replace/remove, set featured photo, and attach supported floorplan, brochure, master plan, video and virtual tour media.
7. Permit and display: advertising permit details/document, contact preference, visibility and portfolio options.
8. Review and publish: readiness checklist with links to missing fields/evidence.

The desktop/mobile preview modal renders the public card or page in an iframe using unsaved editor data. Publishing requires required listing information and verified credentials; unverified submissions are routed to pending review. Application status values include draft, pending, published, unpublished, sold, rented and archived.

Member listings are synchronized to canonical Payload property records before a workspace save is acknowledged. Uploaded listing images are persisted as media/data associated with the record; available storage depends on configured media storage.

### Portfolio management — `/profile`

Broker portfolio editing includes public name/title/headline, biography, experience, languages, service areas, specialisations, credentials, profile and cover images/crop, public contact preferences, agency details, property ordering/featured listings, default sorting, transaction-history visibility and directory/profile visibility. Draft/editing, preview, publish, discard and share controls are available. Public profile output respects visibility and privacy settings.

### Broker network and selected properties — `/network`, `/network/[id]`, `/selected`

The network lets brokers discover participating broker inventory, search/filter/sort, view listing broker/agency context and open a network detail page. Brokers can contact the listing broker or save an opportunity to their private selected collection. Selected properties support search/availability filters, private notes, removal and links to the property/network detail. Notes are member-private. Selection quotas depend on the member's plan.

The developer network is also available to broker/agency accounts at `/developer-network`, with public developer inventory and subscription actions.

### Enquiries — `/enquiries`

The inbox displays enquiry and viewing-request context, sender/property details and status. Members can review and update status and use available contact details. Public enquiry submissions are stored against the relevant broker/property and surfaced in the broker workspace.

### Notifications — `/notifications`

The workspace displays member notifications, including developer property/subscription activity and broker claim requests/decisions where applicable. Notifications can be marked read. In-app notifications are persisted; outbound email/SMS notifications depend on provider configuration and are not implied by these records.

### Plans and billing — `/subscription`

Displays audience-specific plan comparison, limits and current usage for listings, selections and seats. Plan changes and trial cancellation are saved to the account. **Billing is disabled:** prices are unconfirmed and no payment is processed. Plan limit enforcement is applied to relevant workspace actions.

### Account — `/account`

Account settings include personal/legal and contact information, office/billing details, credential/review state, RERA/BRN information, privacy/contact visibility, language/currency preferences, notification preferences, plan summary, email/password changes, sign out, JSON export, account deletion and workspace reset. English is available; Arabic is marked coming soon. Notification preferences are saved, but the UI states that messages are not sent in this demo. The credential demo control simulates verification and does not check RERA.

## 6. Developer and agency workspaces

### Developer dashboard — `/developer-dashboard`

Developer tools include profile/public visibility, property/project inventory, claims and subscriber context. Developer properties can be created with title, area, type, purpose, price and related property details, and can have a primary broker selected or be configured for owner-direct publishing. Owner-direct claimability enables brokers to request representation. Plan limits apply to developer property creation. Public visibility still depends on publication and display state.

Developers can review pending broker claims and approve or reject them, with a decision reason. Approval assigns the broker as primary representative if none is already assigned and cancels other pending claims for that property. Claim requests and decisions create in-app notifications.

### Developer subscriptions and network

Broker and agency members can subscribe/unsubscribe to public developers and browse published developer inventory through `/developer-network`. Developer subscription records are persisted; notifications are generated for eligible subscription/property events by the application workflow.

### Agency dashboard — `/agency-dashboard`

Agency workspace includes overview/property counts, agency-owned and team broker inventory, enquiries and notifications. Agency properties can be assigned to a broker belonging to that agency. Agency dashboard also links to team, verification, developer network, account and subscription tools.

### Agency team — `/agency-team` and `/agency-invite`

Agency administrators can search eligible unaffiliated brokers, invite members with an agency role, review/cancel invitations and manage team context. Invitation acceptance is checked against token, expiry and invited email, then associates the member with the agency. New-member invitations use temporary credentials and email delivery; this requires mail transport. Temporary staff/team accounts may be required to change their temporary password. Agency brokers' listings are subject to agency assignment and credential checks.

### Agency verification — `/agency-verification`

Provides the agency verification workflow/status interface for submitting or reviewing agency details and credentials. Final verification is an administrative review process; the application does not automatically validate licensing with an external regulator.

## 7. Control Room

Routes include `/control-room`, `/control-room/verification/[id]` and `/control-room/property-verification/[id]`. Control Room access is separate from Payload Admin and requires an authorized staff/member role. Temporary staff accounts must change their temporary password before proceeding where the account is flagged accordingly.

### Dashboard and member review

The dashboard surfaces member/property/enquiry and review information, including pending credentials and property readiness. Staff can inspect member records, set credential status, record review checks/rejection reasons and manage staff access according to their role. Administrators can create staff accounts and assign staff roles; verifiers cannot create staff or grant/revoke administrator access and have restricted review scope.

### Property verification and moderation

Property review examines identity, price, specifications, permit, media and responsible broker evidence. Required readiness checks determine whether a record can be approved. Authorized staff can return records for changes, publish/unpublish, adjust status, toggle visibility, mark sold/rented or archive, subject to permissions.

## 8. CMS, persistence and visibility

Payload collections include Members, Users, Properties, Brokers, Agencies, Media, Enquiries, Plans, WaitlistSignups, MemberState, AmenityDefinitions, DeveloperSubscriptions, Notifications, PropertyBrokerClaims and AgencyInvitations. Property/member compatibility data is synchronized into canonical public/CMS records where required.

Payload uses `DATABASE_URI` for PostgreSQL. Workspace state and account-scoped data are read/written through authenticated server routes and persisted in Payload; the browser's in-memory store is a reactive cache, not durable storage. CMS hooks clear/revalidate cached public data. Media uses configured S3-compatible storage when available, with local/configuration-dependent handling otherwise. Seed and media-sync scripts import/link bundled sample media and inventory.

Public visibility rules include:

- Property records must be published and not explicitly hidden (`display.visible !== false`).
- Public broker records need valid public slugs and must satisfy profile/search visibility/privacy settings.
- Developer profiles and properties must be public/visible and published as appropriate.
- Private workspace, staff/admin and editor-preview routes are not public inventory pages.

## 9. APIs and server actions

Application API routes include:

- `/api/app-auth` — login, registration, logout and password/account authentication operations.
- `/api/auth/google`, `/api/auth/google/callback` — optional Google OAuth.
- `/api/app-public` — public brokers, listings, member brokers and plans.
- `/api/app-session` — current member session operations.
- `/api/app-state` — authenticated member workspace state and listing synchronization.
- `/api/app-enquiries` — enquiry retrieval and mutations.
- `/api/app-media` and `/api/register-media` — authenticated media upload/registration.
- `/api/admin` — Control Room requests.
- `/api/role-workspace` — developer/agency workspace data, subscriptions, team invitations, claims and notification actions.
- `/api/waitlist` — waitlist submissions.
- `/api/revalidate` — cache revalidation.
- `/api/media-assets/[...path]` — media asset delivery.
- Payload's `/admin` and API — CMS administration and collection operations.

Next.js server actions wrap authentication, account updates/deletion, enquiry creation/status updates and waitlist submission. Shared server services perform validation, authorization, Payload operations and session-cookie handling.

## 10. Cross-cutting behavior and limits

### Media and contact

Listings and profiles support images and associated media. Gallery/lightbox interactions are keyboard/touch friendly. Phone/email/WhatsApp links can open external apps; actual message delivery is outside the app. In-app enquiries are persisted. The Help form is a demo and does not send. Mail-dependent flows (password reset, team invitation and credential emails) require configured SMTP/provider settings.

### Demonstration features

- Mobile OTP and account credential demo verification simulate checks; they do not send SMS or verify regulatory status.
- Subscription/trial controls update plan/account state but do not charge money.
- Help/contact form only validates and shows a demo success state.
- Maps are approximate community demonstrations and do not show an exact unit location or verified distances.
- Calculators are estimates based on editable assumptions, not quotations. USD equivalents use the fixed AED peg (3.6725).
- Sample broker, agency, developer and property records are fictional; sample photos are illustrative and may not depict advertised units.

### Responsive/accessibility patterns

The site uses responsive public/workspace layouts, mobile property contact controls, mobile/desktop previews, responsive filters/navigation, semantic headings/forms, labels, skip link, breadcrumbs, ARIA controls and keyboard-operable dialogs/actions where implemented.

## 11. Current operational requirements

- Set `DATABASE_URI` and `PAYLOAD_SECRET`; apply migrations with `npm run migrate` when deploying schema changes. Automatic schema push is disabled by default.
- Configure S3-compatible storage credentials/settings for durable remote media uploads; `npm run storage:check` checks access.
- Configure Google OAuth credentials and authorized callback URL to enable Google signup/login.
- Configure mail transport for reset and invitation emails. SMS, WhatsApp delivery and payment processing are not configured.
- Deploy to a public HTTPS domain for search engine access. Sitemap, robots and structured metadata are present in the app and should be checked against the deployed domain.
- Credential verification is an internal review workflow, not an external RERA check. Demo/sample data should be reviewed before production use.

## 12. Primary user journeys

### Buyer discovery

```text
Homepage → search/filter properties → open detail → review facts/media/calculators
         → contact broker or save → sign in as buyer when prompted → review Saved/activity
```

### Broker onboarding and listing

```text
/for-professionals → /register → create broker account and credentials
                   → credential review → configure /profile
                   → create listing → complete readiness checklist
                   → publish or submit for review → receive/manage enquiries
```

### Broker collaboration

```text
/network → search broker inventory → open network detail
         → contact listing broker or select property → add private note in /selected
```

### Developer representation

```text
/developer-dashboard → create developer property → assign primary broker or enable owner-direct
                      → receive claim request → approve/reject → broker/developer notifications
```

### Agency team operations

```text
/agency-dashboard → /agency-team → invite/search broker or manage invitation
                  → invitee accepts with matching email/token → agency manages team inventory
```

### Control Room review

```text
/control-room → review member credentials or property evidence
              → approve / request changes / moderate visibility and status
```
