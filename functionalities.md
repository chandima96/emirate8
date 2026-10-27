# Emirate08 — Current Functionality and User Flows

## 1. Product overview

Emirate08 is a UAE real-estate portal and broker workspace. It currently combines:

- A public property discovery portal
- Public broker and agency profiles
- Broker/agency account registration and authentication
- A broker workspace for listings, portfolio management and enquiries
- A broker network for discovering and selecting other brokers’ properties
- A buyer saved-properties experience
- Developer and agency workspaces with role-specific tools
- Developer subscriptions, broker claims and listing notifications
- A Control Room for administrators, subadmins and verifiers
- Payload CMS collections and API routes for properties, brokers, agencies, members, media, enquiries, plans and waitlist signups

The application supports sample/demo inventory as well as member-created records. Public records are intended to be published, visible and searchable according to their profile/listing settings.

## 2. Roles and permissions

### Guest

Guests can browse public properties, brokers and agencies, open public detail pages, search/filter inventory, read help/legal pages and submit selected public forms. Actions that require an account redirect to login or registration.

### Buyer

Buyers can create a quick account, sign in, save properties, view saved activity and contact brokers through enquiries. They do not receive professional workspace tools. The previous Owner account type has been replaced by Developer.

### Developer

Developers can maintain a public developer profile, publish project inventory, select a primary broker for a property, publish properties directly without a primary broker, subscribe brokers/agencies to receive listing notifications and review broker claim activity.

### Agency

Agency accounts have a dedicated workspace with team management, agency properties, enquiries, subscriptions and developer-following workflows. Agency accounts are separate from individual broker accounts.

### Broker / agency member

Licensed brokers and agency members can use the workspace to manage their profile, listings, network selections, enquiries, account settings and subscription plan.

### Control Room staff

Control Room users are administrators, subadmins or verifiers. They can review members and properties according to role permissions. Verifiers have restricted review-only permissions.

### Payload administrator

Payload’s admin panel and API provide CMS-level management of collections and media. This is separate from the application Control Room.

## 3. Public website functionality

### 3.1 Homepage — `/`

The homepage provides:

- Dubai-focused hero section
- Buy, rent and sell entry points
- Search entry field for communities, buildings and property types
- Popular community shortcuts
- Recent/recommended listings carousel
- Budget explorer
- Find-an-agent and browse-agencies calls to action
- Community image links
- Public header, navigation and footer
- Navbar Sign In account-choice modal for Buyer/Tenant or Professional access
- Animated buyer sign-up modal with Google and email options

Flow:

```text
Visitor opens homepage
  → enters a location/property keyword or selects a purpose
  → navigates to /properties with query parameters
  → filters results or opens a property detail page
```

### 3.2 Property search — `/properties`

The property search page supports:

- Keyword search across community, building and listing text
- Sale/rent selection
- Property type filtering
- Bedrooms filtering
- Price range filtering
- Ready/off-plan filtering
- Community shortcuts
- Sort order and result count
- URL-synchronised filters using query parameters
- Reset filters
- Property cards linking to `/property/[slug]`

Flow:

```text
Visitor opens /properties
  → selects search filters
  → URL updates without a full page reload
  → matching published/visible listings are displayed
  → visitor opens a card
  → /property/[slug]
```

### 3.3 Property detail — `/property/[slug]`

The public property page currently displays:

- Breadcrumb and back-to-search navigation
- Sale/rent and ready/off-plan status
- Title, location and AED price
- Price context such as annual rent, asking price or starting price
- Gallery and image lightbox
- Property characteristics
- Description and highlights
- Amenities/features
- Payment plan for off-plan listings
- Property details and approximate map section
- Community insights
- Mortgage, payment, purchase-cost and rent-affordability calculators
- Listing broker profile and contact card
- Similar properties
- Mobile contact call-to-action
- Save/favourite action
- Share action

Current server flow:

```text
Request /property/[slug]
  → getProperty(slug) queries published and visible CMS data
  → missing/unpublished record returns 404
  → CMS record is normalized into the public listing shape
  → broker relation is attached
  → PropertyDetail renders the initial property content
  → client-side interactions activate after hydration
```

Public visitors can contact the listing broker through the configured contact method. Signed-in users can save the listing and create an enquiry.

### 3.4 Broker directory — `/agents`

The directory supports:

- Agent/broker view
- Agency view
- Search by name, agency, specialty or location
- Featured/public broker cards
- Agency cards
- Load-more pagination
- Links to broker and agency profiles

Flow:

```text
Visitor opens /agents
  → chooses Agents or Agencies
  → searches or browses cards
  → opens /brokers/[slug] or /agencies/[id]
```

### 3.5 Broker portfolio — `/brokers/[slug]`

Public broker pages include:

- Cover image and profile photo/avatar
- Broker name, professional title and agency
- Dubai/UAE service location
- Verification/BRN badges where available
- Headline, biography and specialities
- Languages and experience
- Active listing count and performance summary
- Active property portfolio
- Optional sold/rented history
- Filters for sale/rent, ready/off-plan, type, area, price and bedrooms
- Listing sort options
- Direct contact buttons
- Copy/share profile link
- Links to properties and agency profile

Flow:

```text
Visitor opens /brokers/[slug]
  → server fetches the public broker and active properties
  → broker profile and initial listings render
  → visitor filters portfolio or opens a property
  → visitor contacts broker or shares profile
```

Private, unsearchable or invalid broker profiles are not intended to be public.

### 3.6 Agency profile — `/agencies/[id]`

Agency pages provide:

- Agency name and logo/avatar
- Location and agency licence/ORN information
- Verification badge where applicable
- About section
- Public broker team
- Active agency listings
- Contact-agency call to action

Flow:

```text
Visitor opens /agencies/[id]
  → server fetches the agency, public brokers and active listings
  → agency profile renders
  → visitor opens a broker or property
```

### 3.7 Saved properties and activity — `/saved`

Signed-in users can:

- View saved properties
- View recently viewed properties
- View enquiry/contact activity
- Filter activity by category/status where available
- Open saved property and broker links

The save/favourite control is available from property cards and property detail pages. Saved activity is user-specific.

### 3.8 Seller and owner flow — `/sell`

The sell page explains the seller/owner path and presents an owner waitlist form. The waitlist flow collects an email and submits it to the waitlist endpoint/server action.

Flow:

```text
Visitor opens /sell
  → reads selling guidance
  → submits email to join the owner waitlist
  → receives success or validation feedback
```

### 3.9 Help and contact — `/help`

The help page provides contact/support form fields:

- Name
- Email
- Topic
- Message

Validation errors and submission feedback are shown in the UI.

### 3.10 Platform and professional marketing pages

Available marketing pages include:

- `/platform` — product/platform explanation
- `/for-professionals` — broker and agency acquisition page
- `/privacy` — privacy policy
- `/terms` — terms of service

These pages link visitors toward registration, public profiles and the professional workspace.

## 4. Authentication functionality

### 4.1 Registration — `/register`

The registration wizard supports account types:

- Licensed broker
- Real estate agency
- Property developer

`/register` is reserved for professional registration. It collects account credentials and role-specific profile information. Broker/agency registration may include mobile number, professional details, RERA/credential information and plan selection. The former Owner account type is no longer presented; Developer is the replacement role.

Flow:

```text
Visitor opens /register
  → chooses account type
  → completes multi-step form
  → submits registration
  → member record is created with pending credentials
  → user is signed in or shown next-step feedback
```

### 4.2 Buyer registration modal

Buyer registration is not presented in the professional `/register` wizard. It is opened from the public navbar:

```text
Visitor clicks Sign In
  → chooses Buyer/Tenant in the animated account-choice modal
  → buyer sign-up modal opens
  → chooses Continue with Google or Continue with email
  → email flow collects name, email, strong password and terms consent
  → account is created as a buyer
  → user is redirected to saved properties
```

The email form includes password visibility control, strength feedback, inline validation, loading state and Terms/Privacy consent. Google sign-up uses the optional Google OAuth routes and requires `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` configuration.

### 4.3 Login — `/login`

Users can sign in using email or mobile number plus password. After authentication, the destination depends on the user role and requested `next` URL:

- Broker/agency → workspace/dashboard
- Buyer → saved area
- Guest/private workspace access → unauthorized guidance

The public navbar Sign In button first opens the account-choice modal. Professional users continue to `/login`; buyers continue to the Google/email buyer modal.

Logout from the navbar, dashboard, account settings and Control Room clears the session and redirects to the public homepage (`/`).

### 4.4 Password recovery

Available routes:

- `/forgot-password`
- `/change-password`

Flow:

```text
User submits email
  → password reset request is sent through Payload
  → user enters reset token and new password
  → token is validated
  → password is changed and session can be established
```

### 4.5 Account security

Authenticated users can:

- Change email after verifying the current password
- Change password after verifying the current password
- Log out
- Export account data in the account UI
- Request account deletion with password and confirmation

## 5. Broker and agency workspace functionality

Workspace routes are under the authenticated application shell.

### 5.1 Dashboard — `/dashboard`

The dashboard provides:

- Workspace summary and KPIs
- Published listing count
- Draft/pending listing count
- Network opportunities
- Selected properties
- Recent enquiries
- Recent listings
- Recommended/network properties
- Quick links to create a listing, portfolio, network and subscription

### 5.2 Listing management — `/listings`

The listing manager supports:

- View listings
- Filter by status and other listing attributes
- Open listing detail
- Create a new listing
- Edit an existing listing
- Preview a listing
- Publish/unpublish listings
- Mark properties sold or rented
- Delete listings
- View public listing link

### 5.3 Listing creation and editing

Routes:

- `/listings/new`
- `/listings/[id]`
- `/listings/[id]/edit`

The multi-step editor captures:

#### Basics

- Listing title
- Summary and full description
- Purpose: sale or rent
- Residential/commercial category
- Property type
- Community, area, emirate and address
- Ready/off-plan status
- Bedrooms, bathrooms and size
- Parking, floor and total floors
- Price and price-on-request state
- Rental terms and cheques where applicable
- Availability and property condition details

#### Media

- Featured image
- Gallery images
- Floorplans
- Image captions
- Media upload and registration

#### More details

- Highlights
- Amenities
- Nearby attractions
- Investment/developer highlights
- Advertising permit number
- Permit expiry
- Permit document
- Internal reference
- Preferred contact method

#### Off-plan/payment plan

- Developer
- Handover information
- Payment milestones and percentages

Flow:

```text
Broker opens New Listing
  → completes editor steps
  → saves draft or opens preview
  → completes verification/readiness requirements
  → publishes listing
  → listing becomes eligible for public visibility
```

### 5.4 Listing preview

The editor can open a desktop/mobile preview modal. Preview mode renders the public listing style while keeping links and contact actions inert. This lets the broker review content before publishing.

### 5.5 Portfolio/profile management — `/profile`

The broker portfolio editor supports:

- Public display name
- Professional title and headline
- Biography
- Years of experience
- Languages
- Service areas
- Specialisations
- Credentials
- Profile photo
- Cover image and crop position
- Public email, phone and WhatsApp
- Preferred contact method
- Agency name, website and ORN
- Portfolio property order
- Featured portfolio listings
- Default listing sort order
- Sold/rented history visibility
- Public profile visibility
- Search-directory visibility

Flow:

```text
Broker edits draft profile
  → reviews the “What buyers see” preview
  → publishes changes
  → public /brokers/[slug] page reflects the published profile
```

The portfolio editor supports draft changes, publish, discard, desktop/mobile preview and profile sharing.

### 5.6 Broker network — `/network`

The network helps brokers discover property opportunities from participating brokers. It supports:

- Browse network inventory
- Search properties, brokers and notes
- Filter/sort opportunities
- Open network property detail
- View listing broker and agency
- Contact the listing broker
- Select properties into a private collection

Network property detail is available at `/network/[id]`.

Flow:

```text
Broker opens Network
  → searches or filters another broker’s inventory
  → opens network detail
  → contacts listing broker or selects the property
  → selected property is saved to private collection
```

### 5.7 Selected properties — `/selected`

Selected properties provide a private workspace collection with:

- Availability filtering
- Search
- Private broker notes
- Remove/deselect action
- Contact listing broker
- Open property/network detail

Private notes are not displayed to public visitors or the listing broker.

### 5.8 Enquiries — `/enquiries`

The enquiries inbox supports:

- View property and broker enquiries
- See sender and property context
- Filter or review enquiry status
- Mark enquiries replied/updated
- Contact or respond through available contact details

Public enquiry flow:

```text
Visitor opens property/broker contact action
  → enquiry form/provider opens
  → visitor submits message and contact details
  → enquiry is stored against broker/property
  → broker sees it in /enquiries
  → broker updates status
```

### 5.9 Subscription — `/subscription`

The subscription screen provides:

- Current plan summary
- Plan comparison
- Included seats/listing/selection allowances
- Feature comparison
- Trial/cancellation UI
- Plan switching controls
- Payment modal UI

The current implementation presents plan and billing interactions in the workspace. External payment-provider integration should be verified separately before production billing.

### 5.10 Account settings — `/account`

Account settings include:

- Personal information
- Legal name
- Mobile number
- Office/billing address
- Credential status and review information
- RERA/BRN details
- Credential verification/demo verification controls where enabled
- Privacy controls
- Contact visibility controls
- Language and currency preferences
- Notification preferences
- Subscription summary
- Change email
- Change password
- Logout
- Export account data
- Delete account

Privacy controls can determine whether phone, WhatsApp, email, languages, experience, BRN, transaction history and portfolio visibility appear publicly.

### 5.11 Developer workspace and public developer profiles

Developer accounts have a dedicated dashboard at `/developer-dashboard` with:

- Developer profile and public visibility controls
- Project/property creation and management
- Primary broker selection for developer-owned properties
- Public/direct listing option when no primary broker is selected
- Broker claim review and ownership context
- Developer subscriber management
- Notifications for broker and agency subscriptions

Public developer pages are available at `/developers` and `/developers/[slug]`. Published developer properties are linked to the developer profile and public property pages.

### 5.12 Agency workspace

Agency accounts have a dedicated dashboard at `/agency-dashboard` with:

- Agency overview and property summary
- Team tab for agency members and invitations
- Agency properties and enquiries
- Developer subscriptions
- Notifications and account/subscription access

Agency registration creates the agency record and associates the registering member as the agency administrator.

### 5.13 Broker claims and developer subscriptions

Broker and agency members can subscribe to public developers. When a subscribed developer publishes a property, the platform creates notifications for eligible subscribers.

For developer-direct/public properties, brokers and agencies can submit a claim saying they represent the property. The developer can review claim status and maintain the primary broker relationship separately from public broker claims.

## 6. Control Room functionality

Routes:

- `/control-room`
- `/control-room/property-verification/[id]`
- `/control-room/verification/[id]`

### 6.1 Control Room access

Approved Payload users with roles `admin`, `subadmin` or `verifier` can log in. Approved administrator-created members with Control Room access can also use the Control Room.

Temporary staff accounts must change their temporary password before using the rest of the Control Room.

### 6.2 Dashboard

The Control Room dashboard displays:

- Member count
- Pending credential count
- Property count
- Published property count
- Enquiry count
- New enquiry count
- Broker count
- Media count
- Member list
- Staff list
- Property list
- Property verification readiness checks

### 6.3 Member management

Administrators can:

- Review members
- Update credential status: pending, verified or rejected
- Record credential review checks and rejection reason
- Grant/revoke administrator access where permitted
- Create Control Room staff accounts
- Assign subadmin or verifier role
- Send temporary credentials by email

Verifier restrictions:

- Verifiers can submit member verification decisions.
- Verifiers cannot create staff accounts.
- Verifiers cannot grant/revoke admin access.
- Verifiers cannot review administrator-created accounts.

### 6.4 Property verification

Property readiness checks cover:

- Property identity
- Pricing
- Specifications
- Advertising permit
- Media evidence
- Responsible broker

Each check displays submitted values/evidence and pass/fail state. A property can be approved only when all required checks pass. Approved properties become published; properties needing changes return to pending.

### 6.5 Property moderation

Authorized Control Room users can:

- Change property status
- Publish/unpublish properties
- Mark properties sold or rented
- Archive properties
- Toggle public visibility

## 7. CMS and data functionality

Payload collections currently include:

- Members
- Users
- Properties
- Brokers
- Agencies
- Media
- Enquiries
- Plans
- Waitlist signups
- Member state
- Amenity definitions
- Developer subscriptions
- Developer/agency notifications
- Property broker claims
- Agency invitations

Property records include canonical CMS fields plus `appData` compatibility/workspace data. Member-created properties and broker profiles are synchronized into public-facing CMS records for administration and public display.

Public data loading uses:

- Server-side CMS helpers in `src/lib/cms.ts`
- Public application endpoint `/api/app-public`
- Session endpoint `/api/app-session`
- State endpoint `/api/app-state`

CMS changes invalidate the CMS cache through Payload hooks. Public CMS reads use a short revalidation period, while the public application payload currently uses no-store response headers.

## 8. API and server action functionality

### Application APIs

- `/api/auth/google` and `/api/auth/google/callback` — optional Google OAuth buyer registration/login
- `/api/app-auth` — login, registration, logout, password recovery/reset, password/email changes
- `/api/app-public` — public brokers, listings, member brokers and plans
- `/api/app-session` — current member session
- `/api/app-state` — authenticated member workspace state and mutations
- `/api/app-enquiries` — authenticated enquiry operations
- `/api/app-media` — authenticated media operations
- `/api/admin` — Control Room requests
- `/api/waitlist` — owner waitlist submission
- `/api/revalidate` — cache revalidation hook/endpoint
- `/api/register-media` — media registration
- `/api/media-assets/[...path]` — media asset delivery
- `/api/role-workspace` — role-specific developer and agency workspace data/actions
- Payload API route under `/admin/api`

### Server actions

Server actions wrap authentication, account changes, account deletion, enquiry creation/status updates and waitlist signup. They return normalized success/error results and set authentication cookies when required.

## 9. Cross-cutting functionality

### Media

- Featured images, galleries, floorplans, profile photos, agency logos and cover images
- Supabase S3-compatible storage when configured
- Local media fallback when storage is not configured
- Image lightbox/gallery interaction

### Contact methods

Depending on privacy settings and listing configuration, users can contact brokers through:

- Enquiry/message
- Phone
- WhatsApp
- Email

### Notifications and feedback

The app uses feedback/toast messaging for saves, shares, updates, errors, contact actions and successful submissions.

### Responsive behavior

Public and workspace screens include responsive layouts, mobile contact CTA, mobile/desktop preview switching and mobile-friendly filter/navigation controls.

Authentication choice and buyer registration dialogs include responsive layouts, animated open/close transitions, backdrop dismissal, Escape handling and focus management.

### Accessibility

Implemented patterns include:

- Skip-to-content link
- Semantic headings and sections
- Labels and screen-reader text
- Breadcrumb navigation
- ARIA tab/filter groups
- Keyboard-friendly dialogs and controls
- Alternative text/avatars for media where supplied

## 10. Current public visibility rules

The public data paths currently apply these rules:

- Properties must be `published`.
- Properties with `display.visible === false` are excluded.
- Broker records need a slug.
- Private/unsearchable broker profiles are excluded from public API output.
- Member portfolios need a public, searchable slug.
- Private workspace, admin and preview areas are not public product pages.

## 11. Important current limitations and items to verify

- The site is configured for `http://localhost:3000`; localhost cannot be crawled by Google or AI search systems.
- Public indexing requires deployment to a real HTTPS domain.
- Sitemap, robots controls and JSON-LD structured data are implemented and should be verified after deployment.
- Some public interactive lists still hydrate from the client public store after the server-rendered shell.
- Payment-provider processing is not confirmed by the current workspace subscription UI.
- Google buyer sign-in requires Google Cloud OAuth credentials in `.env` and an authorized callback URL.
- Demo/sample records and sample wording should be removed or clearly separated before production launch.
- Property and broker availability depends on correct CMS relations, slugs, visibility flags and profile privacy settings.
- Production build validation requires access to the configured remote database and storage services.

## 12. Primary end-to-end user journeys

### Property buyer journey

```text
Homepage
  → Search property
  → Filter sale/rent, location, type, budget and bedrooms
  → Open property detail
  → Review photos, facts, calculator and broker
  → Save property or send enquiry
  → Continue in Saved/Activity after login
```

### Buyer account journey

```text
Public homepage or any marketplace page
  → click Navbar Sign In
  → choose Buyer/Tenant
  → choose Google or email
  → create/sign in to buyer account
  → return to saved properties and buyer activity
```

### Broker acquisition journey

```text
Professional marketing page
  → Register as broker/agency
  → Complete account and credential information
  → Await/review verification
  → Configure public portfolio
  → Create and verify listing
  → Publish listing
  → Receive enquiries
```

### Broker collaboration journey

```text
Workspace dashboard
  → Open Broker Network
  → Search another broker’s inventory
  → Open network property
  → Contact listing broker or select property
  → Add private notes in Selected Properties
```

### Administrator moderation journey

```text
Control Room login
  → Review pending members/properties
  → Inspect credentials and property evidence
  → Approve or request changes
  → Publish, hide, mark sold/rented or archive
```
