# Listing Fields — Portal Benchmark & Optimization Plan (Broker + Agency)

> Prepared: 17 Nov 2026 · Branch: `feat/listing-optimization`
> Scope: (1) what Property Finder, Bayut and their Off-Plan / New-Projects sections collect and publish for a property, (2) a field-by-field audit of our listing editor, (3) what to **add / update / remove**, with an autofill source for every field, and (4) a step-by-step listing guide for **brokers** and **agencies**.

---

## 0. TL;DR

1. **Portals don't make agents type most data.** A listing on Property Finder / Bayut is ~25 public fields, and most of them come from **catalogues** (location tree → building → project → developer), the **DLD/Trakheesi permit**, and the **agent's/agency's account**. The agent mainly supplies price, unit specifics, photos and text.
2. **Our form is more detailed than the portals** (≈190 field definitions, ≈60 AI-fillable). That's good for buyer trust, but it means our real bottleneck is **data entry**. Our autofill today depends on one source only: the AI reading documents, links or pasted text.
3. **The biggest wins, in order:**
   - **Building / project catalogue.** Picking a building should fill the community, subcommunity, developer, map pin, completion year, zone, shared amenities, floors and service-charge benchmark. Off-plan projects should also fill handover, payment plan, unit types and floor plans.
   - **Permit-first start.** Start from the advertising permit (number, QR or PDF) and pre-fill the permit, unit, size, type and building from it.
   - **Profile defaults.** Fill BRN, ORN, brokerage, contact, commission and viewing defaults from the account, and from agency-level presets.
   - **Clone from a sibling listing** in the same building or project.
   - **Computed fields.** Calculate price per sq ft, annual service-charge total, sq m, floor band from floor number, and the summaries.
4. **Agency flow:** move "Team member" from step 8 to **step 1**, so the assigned broker's BRN and contact drive the permit and contact steps. Add agency-level presets.
5. **Remove or merge** low-value or duplicate fields: area unit as a step field, the separate `progressSource`/`progressDate` when the catalogue provides them, `scheduleDate`, `altLang` dropdown + duplicate title, `bookingInSchedule`, and others (§4.9).
6. **SEO / data:** our property page publishes **no JSON-LD**. Both portals publish `RealEstateListing`, and Property Finder also publishes `Product`/`Project`. Several editor answers are never projected to stored columns (subcommunity, transaction type, developer for ready units, yearly service charge). Fix that so filters, cards and schema can use them.

---

## Part 1 — Portal research

Method: I opened live listing pages, single property pages and project pages on propertyfinder.ae and bayut.com (Nov 2026), and read Property Finder's embedded page data (`__NEXT_DATA__`) and JSON-LD. Bayut blocks direct HTML fetches with a bot check, so Bayut fields come from the rendered page. Fields Bayut shows on other listings, but not on the sampled one, are marked *(typical)*.

### 1.1 Property Finder — listing page (search results card)

| Group | Fields shown |
|---|---|
| Badges | Verified, Premium / Featured / Spotlight, New, **Offplan: First Sale**, **Offplan: Re-Sale**, Ready, SuperAgent, price-drop % ("17% price drop"), 3D tour, Floor plan |
| Core | Price (AED), title/headline, property type, beds (or "Studio"), baths, size (ft²), location (building, community, city), "Listed N days ago" |
| Off-plan cards | Delivery date (Q3 2028), launch price, payment plan (20/20/60), developer name + logo, bedroom range, size range, unit count |
| Agent | Agent photo + name, agency logo, Call, WhatsApp |
| Filters | Buy / Rent / New projects, property type, beds & baths, price, **Off-plan / Ready**, keywords, map view, alert |

### 1.2 Property Finder — single property page (resale + off-plan unit)

**Displayed sections**

| Section | Fields |
|---|---|
| Header | Title, price, **price per sq ft** (computed), photo count, video, 360 view, floor plans |
| Property details | Property type, property size (**sq ft / sq m both shown**), bedrooms, bathrooms, **service charges (AED/sq ft)**, **available from**, furnishing |
| Amenities | Coded list (see below) — views are amenities here ("View of Water", "View of Landmark") |
| Description | Free text |
| Location | Building → community → city, map (coordinates come from the **building**, not the agent), building rating & reviews, building stats |
| Regulatory | Reference, Listed date, **Broker License (ORN)**, **Agency name**, **Zone name** (e.g. *Marsa Dubai* — the DLD zone), **Agent License (BRN)**, **DLD Permit Number** (link to `trakheesi.dubailand.gov.ae … listing/validation` = QR) |
| Insights | Price vs area average, size vs average, recent sales and rentals for the same size (DLD data), mortgage calculator |
| Agent | Name, SuperAgent, languages, response time, rating, experience, listing count |
| Off-plan unit extra | "Offplan: First Sale", project name + developer, delivery date, down payment %, floor plan linked from the project |

**Property Finder's internal property model (from page data) — the fields an agent's CRM actually sends**

```
property_type, offering_type ("Residential for Sale"), category_id
price{value, currency, period: sell|yearly|monthly}, price.is_hidden (price on request)
title, description (+ _original, Arabic share_url_translated)
bedrooms, bathrooms, size{value, unit}, price_per_area (computed)
furnished: YES | NO | PARTLY
completion_status: completed | off_plan_primary | (off-plan secondary / resale)
rental_availability_date
service_fee_per_sqft
amenities[{code, name}]          ← coded list
location{id, type: TOWER, name, path "1.50.3068", coordinates, building_details{developer_name, master_developer_name}}
zone_name (DLD zone)             ← from location catalogue
project{title, slug, delivery_date, payment_plan{down_payment_rate, installment_years, …}}   ← from project catalogue
floor_plans[{image_url, area, dimension 2d/3d, floor_number, unit_number}]                   ← from project catalogue
images[], video_id, view_360
rera{number, permit_validation_url (Trakheesi QR), authority_name, issued_license_number}
licenses[{license_type: brn, license_number}]
agent{…}, broker/client{name, license_number (ORN), phone, email}
reference, listed_date, is_verified, is_exclusive, listing_level (premium/featured…)
utilities_price_type, payment_method[], is_landscaped, is_upgraded, rooms
```

**Amenity codes seen:** BA Balcony · BW Built-in wardrobes · AC Central A/C · CP Covered parking · SP Shared pool · SY Shared gym · SE Security · VW View of water · BL View of landmark · PR Children's play area · CO Children's pool · LB Lobby in building. PF's standard list also includes private pool, private garden, private gym, private jacuzzi, maid's room, study, walk-in closet, kitchen appliances, pets allowed, concierge, maid service, shared spa, barbecue area, networked, and other views.

**JSON-LD** on the property page: `@type: ["ApartmentComplex","RealEstateListing","House","Product"]` with `BreadcrumbList`, `PostalAddress` (locality, region, name), `amenityFeature[]` as `LocationFeatureSpecification{name, value:true}`, `description`, offers/price, `speakable`.

### 1.3 Property Finder — New Projects (Off-plan) page

Project-level model, filled once per project and inherited by every unit listing:

```
title, slug, developer{name, logo, slug}, description, ownershipType (freehold)
constructionPhase (under_construction…), constructionProgress %, inspections / lastInspectionDate, constructionImages
salesPhase (booking_started…), salesStartDate, deliveryDate, timelinePhases[{phaseKey, date, completed, progress%}]
startingPrice, minResalePrice, stockAvailability
units[{propertyType, bedroomsFrom/To, bathroomsFrom/To, areaFrom/To, priceFrom, floor-plan types}]
paymentPlans[{title, phases[{label: down_payment|during_construction|on_handover|post_handover, value %, miles[]}]}]
amenities[], masterPlan{image, description}, brochureUrl, images, video
location{coordinates, tower id}, locationTree
agencies[{name, qrUrl (Trakheesi permit for the project)}]   ← brokers authorised by DLD to market it
faqs[], government fee (4%), historicalTransactions, similarProjects
```

JSON-LD: `["Product","Project","ProductCollection","WebPage"]` + `Organization/Corporation` for the developer.

### 1.4 Bayut — listing page (search results card)

| Group | Fields shown |
|---|---|
| Badges | **TruCheck™** (verified listing, as a filter and sort), **TruBroker™** agent, Premium/Prime, **Off-Plan + Initial Sale / Resale** tags, Story, floor-plan available |
| Core | Price, property type, beds, baths, area (sq ft), title, building + community + city, "Property authenticity was validated on …", "Agent last visited this property on …", added date |
| Off-plan | Handover (Q4 2027), payment plan (30/70) |
| Agent | Photo, name, agency logo, Email / Call / WhatsApp |
| Filters | Purpose, location, completion status (All/Ready/Off-plan), property type, beds & baths, price, area, keywords, furnishing, amenities, TruCheck first, TruBroker first, floor plans only, video / 360 |

### 1.5 Bayut — single property page

| Section | Fields |
|---|---|
| Property information | Type, Purpose, Reference no., **Completion** (Ready/Off-plan), **Furnishing**, Average Rent, **Added on**, *(typical)* Handover date, Ownership, TruCheck date |
| Validated information *(typical, from DLD)* | Developer, Ownership (freehold), Built-up area, Usage, Balcony size, Parking availability |
| Building information *(typical)* | Building name, Year of completion, Total floors, Swimming pools, Total parking spaces, Total building area, Elevators, Developer |
| Price | Price, *(typical)* price per sq ft, payment plan (off-plan), mortgage calculator, **TruEstimate™** valuation |
| Features / Amenities | Groups: **Features**, **Building**, **Business & Security**, *(typical)* Recreation & Family, Health & Fitness, Laundry & Kitchen, Technology, Cleaning & Maintenance, Miscellaneous |
| Location | Breadcrumb Emirate › Community › Subcommunity/Project › Building, map, nearby (schools, metro, hospitals), "nearby buildings" |
| Regulatory information *(typical)* | Trakheesi / permit no., DLD QR, RERA / ORN, BRN, DED licence, zone |
| Market data | Similar property transactions (DLD), trends & indices |
| Agent | TruBroker, Quality Lister, Responsive Broker, agency listing count |

Bayut locations follow a **4-level tree** (Emirate › Community › Subcommunity › Building), e.g. *Dubai › Dubai Marina › Al Sahab Tower › Al Sahab Tower 2*. That is the same shape our AI prompt already expects.

### 1.6 Bayut — New Projects (Off-plan)

Project name, developer, **project status + completion %** (e.g. "Under construction, 36%"), handover quarter, launch price / "from", payment plan headline (70/30) + stages (down payment 20%, pre-handover 50%, on handover 30%), property types, **unit types** (Studio Type 1 465 sq ft AED 1.25M …) with floor plan per type, brochure download, gallery, location & nearby, register-interest form, featured TruBrokers, market stats (listings, sold in 12 months, average price, change %).

### 1.7 Consolidated field matrix

Legend: ● shown/collected · ◐ partly/derived · — not present. "E8" = our editor today.

| Field | PF listing | Bayut listing | Off-plan project | E8 today | Typical source on portals |
|---|:-:|:-:|:-:|:-:|---|
| Purpose (sale/rent) | ● | ● | ● | ● | Agent |
| Category / property type | ● | ● | ● | ● | Agent / permit |
| Completion status (ready / off-plan) | ● | ● | ● | ● | Agent / project |
| Transaction (first sale / resale) | ● | ● | — | ● | Agent / project |
| Emirate › community › subcommunity › building | ● | ● | ● | ◐ (free text, small community list) | **Location catalogue** |
| Map coordinates | ● | ● | ● | ◐ (paste Google link) | **Building catalogue** |
| DLD zone name | ● | ◐ | — | — | **Catalogue** |
| Developer / master developer | ● | ● | ● | ◐ (typed; only stored for off-plan) | **Building catalogue** |
| Beds / baths | ● | ● | ● ranges | ● | Agent / permit |
| Size (sq ft + sq m) | ● | ● | ● ranges | ● | Agent / permit / title deed |
| Plot / BUA / balcony | ◐ | ● validated | ◐ | ● | Title deed / DLD |
| Price | ● | ● | ● from | ● | Agent |
| Price per sq ft | ● | ● | — | ◐ (summary only) | **Computed** |
| Price on request | ● | ◐ | ● "coming soon" | ● (column only, no editor field) | Agent |
| Service charge | ● per sq ft | ◐ | — | ● | Agent / **building benchmark** |
| Furnishing | ● | ● | — | ● | Agent |
| Available from (rent / handover) | ● | ◐ | ● | ● | Agent / project |
| Ownership (freehold) | ◐ | ● | ● | ● | **Catalogue / title deed** |
| Views | ● (as amenity) | ● | — | ● | Agent |
| Amenities (coded) | ● | ● grouped | ● | ● grouped (33 + custom) | Agent + **building inherits** |
| Building info (floors, lifts, pools, year) | ◐ | ● | ● | ◐ (only for whole-building type) | **Catalogue** |
| Handover / delivery date | ● | ● | ● | ● | **Project catalogue** |
| Construction % + date | — | ● | ● | ● | **Project catalogue / DLD** |
| Payment plan stages | ◐ | ● | ● | ● | **Project catalogue** |
| Unit types / floor plans per type | ● | ● | ● | ◐ (upload only) | **Project catalogue** |
| Brochure / master plan | — | — | ● | ◐ (brochure only) | Developer |
| Photos / video / 360 | ● | ● | ● | ● | Agent |
| Permit no. + QR / validation URL | ● | ● | ● (per agency) | ● (manual) | **Trakheesi / Madhmoun** |
| BRN / ORN / agency / agent licence | ● | ● | ● | ● (from profile) | **Account** |
| Reference no. | ● | ● | — | ● auto + CRM ref | System |
| Listed / verified / last visited date | ● | ● | — | ◐ | System |
| Market data (transactions, average) | ● | ● | ● | — | DLD feed |
| Title / description | ● | ● | ● | ● | Agent (+ AI) |
| Arabic version | ● | ● | ● | ◐ (one "additional language") | Agent / translation |
| JSON-LD | ● | ● | ● | **— (missing on property page)** | System |

### 1.8 What the portals do that we should copy

1. **Pick a building and everything else follows.** Property Finder stores `location.id` (the tower). Developer, master developer, zone, coordinates, building photos and transaction data all hang off that one ID. The agent never types them.
2. **Off-plan units inherit the project.** Delivery date, payment plan, unit types and floor plans are entered **once per project** and every unit listing links to it.
3. **The permit is the trust anchor.** Every listing shows a DLD permit validation link/QR plus BRN, ORN and zone. Bayut's "Validated information" uses DLD records to fill built-up area, ownership, developer and parking.
4. **Computed fields are shown, never typed:** price per sq ft, sq m conversion, "% below area average", and "listed N days ago".
5. **Views and parking are simple amenities**, not separate multi-field sections.
6. **Very few fields are mandatory:** type, purpose, location, price, beds/baths, size, photos, permit, plus completion status for off-plan.

---

## Part 2 — Audit of our current listing editor

Sources: [designer-schema.js](src/components/listings/editor/designer-schema.js) (field definitions and steps), [designer-model.js](src/components/listings/editor/designer-model.js) (projection and validation), [ListingEditor.tsx](src/components/listings/editor/ListingEditor.tsx) (wizard and roles), [listingAutofill.ts](src/lib/listingAutofill.ts) and [listing-autofill/route.ts](src/app/api/listing-autofill/route.ts) (AI extraction), [Properties.ts](src/collections/Properties.ts) (stored columns).

### 2.1 Current steps

| # | Step (broker) | Step (agency) | Main fields |
|---|---|---|---|
| 1 | Classification | Classification | purpose, category, ptype, devStatus, stage, txn, extRef |
| 2 | Location | Location | emirate, community (+ subcommunity), building (free text / propose), tower, developer, unitNo, floorNo, street, Google Maps link → lat/lng, locPrecision |
| 3 | Property details | Property details | areaUnit, beds, baths, unit/BUA/plot/balcony area, areaSource, parking (+type), extraRooms, layoutCode, floorBand, storeys, furnishing, condition, occupancy, completionYear / handover Q+Y+date, progress % + source + date, plannedSpec, tenure, lease, villa/office/shop/warehouse/land/building/labour blocks, views, viewExtent, kitchen, appliances, amenities, pets, custom features, otherInfo |
| 4 | Price & terms | Price & terms | sale: askingPrice, negotiable, possession, tenancy, service charge · off-plan initial: unitPrice, booking, schedule, incentives · off-plan resale: price basis, developer payments, transfer, SOA · rent: annualRent, availability, cheques, deposit, utilities, cooling, maintenance · fees: commission, tax, viewing |
| 5 | Marketing | Marketing | title, description, highlights, locHighlights, alt language, internal notes |
| 6 | Photos & media | Photos & media | photos (cover, type), videos, floor plans, tour, brochure, media rights |
| 7 | Permit & display | Permit & display | permitNo, permitUrl, permitExpiry, QR doc, BRN/ORN (read-only from profile), authType, authExpiry, auth doc, contact override, floorDisplay, portfolio, promotion, scheduleDate |
| 8 | Review & publish | **Team member** | review + 3 declarations · agency: assigned broker |
| 9 | — | Review & publish | |

### 2.2 Autofill today

| Source | What it fills | Gap |
|---|---|---|
| AI document / link / paste ([AiAutofill](src/components/profiles/AiAutofill.tsx)) | ~60 descriptive fields (§`LISTING_AI_FIELDS`) | Can't fill permit, unit number, floor number, authorization, contact. No catalogue match, so building and developer stay as text. |
| Account profile | BRN, ORN, brokerage name, contact (shown read-only in step 7) | Shown only in step 7. Not used to pre-fill commission/viewing defaults. Agency can't set presets. |
| `?purpose=` URL param | purpose | — |
| Duplicate as draft ([useListingActions.tsx](src/components/listings/useListingActions.tsx)) | whole record | Copies the permit and unit too; no "clone building data only" option |
| Developer listings + broker claims ([PropertyBrokerClaims.ts](src/collections/PropertyBrokerClaims.ts)) | broker takes over a developer listing | Works for developer-owned units only |
| Catalogue | `AREAS` = 14 Dubai communities + a few per emirate ([reference](src/config/reference.ts)) | **No building or project catalogue.** Building is free text. The developer help text says "filled automatically when you pick a catalogue building", but that catalogue doesn't exist. |

### 2.3 Agency vs broker differences today

- **Broker:** 8 steps; the listing is owned by the broker; BRN/ORN come from the broker profile.
- **Agency:** 9 steps; `ownerType = agency`; the **team member is chosen at step 8**, *after* the permit and contact steps. Step 7 therefore shows the *agency account's* BRN and contact, not the assigned broker's. Choosing a broker is optional.
- No agency-level defaults (commission, contact routing, viewing policy, watermark, portfolio).

### 2.4 Problems found

1. **Projection gaps** (editor answers never reach stored columns, so public cards, filters and schema can't use them):
   - `subcommunity`, `txn` (initial/resale), `parkingType`, `extraRooms`, and `views` (stored as a joined string) are not stored as fields.
   - `developer` is only projected when off-plan, so ready listings lose the developer.
   - `serviceCharge` is only projected when the basis is per sq ft. A yearly total (`per_year`) is dropped.
   - `deposit` is only projected when entered as %.
   - `negotiable`, `possession`, `minTenancy` and `handoverDate` are not stored as fields.
2. **No JSON-LD** on [property/[slug]/page.tsx](src/app/(portal)/property/[slug]/page.tsx). Broker, agency and developer pages have it.
3. **Two models:** the Payload collection ([Properties.ts](src/collections/Properties.ts)) has a thin legacy shape (e.g. `rent.cheques` is a number, `offplan.paymentPlan` uses `percent`). The editor writes a richer shape through `appData` and legacy `model.ts` keys. `priceOnRequest` exists in the collection but not in the editor.
4. **Step order fights autofill:** the permit (which can pre-fill type, size, building and unit) comes at step 7. The agency's broker (who determines BRN and contact) comes at step 8.
5. **Duplicated or overlapping questions:**
   - `possession` (sale) vs `occupancy` vs `availability` (rent).
   - `floorNo` + `floorBand` + `floorDisplay`.
   - `views` + `viewExtent`.
   - `appliances` both as a field and as an amenity ("Kitchen appliances").
   - `parking` in step 3 vs `bldParking`.
   - `extraRooms` "Storage/Laundry" vs amenities "Storage/Laundry room".
6. **Area unit is a required step field.** It's a display preference and belongs in the user's settings.
7. **Map pin from a pasted Google Maps link only.** There's no building pin and no draggable map. The coordinate check only knows Dubai's bounds, so it warns on correct pins in other emirates (for example Abu Dhabi).
8. **Community list is tiny** (14 Dubai communities). Real portals use the full DLD/RERA tree (~200+ Dubai communities, thousands of buildings).

---

## Part 3 — Field-wise recommendations (Add / Update / Remove)

### 3.1 Autofill sources (use these codes in the tables)

| Code | Source | Notes |
|---|---|---|
| **P** | Account profile (broker) | BRN, name, photo, phone, WhatsApp, email, languages, brokerage |
| **A** | Agency presets (new) | ORN, agency name, licence, default commission, contact routing, viewing policy, portfolios |
| **C** | Catalogue — community / building / project (new) | community tree, zone, coordinates, developer, master developer, completion year, tenure, floors, lifts, pools, shared amenities, service-charge benchmark |
| **O** | Off-plan project record (new; filled by the developer on our platform or by admin) | handover, construction stage/%, unit types, payment plans, floor plans, brochure, master plan, starting price |
| **T** | Permit — Trakheesi (Dubai) / Madhmoun (Abu Dhabi) / other emirates' permit, entered as number, QR scan or PDF | permit no., expiry, validation URL, and the property details the permit carries. Confirm which fields the permit validation page exposes before relying on them. |
| **D** | Documents through AI: title deed, Form A (seller–broker agreement), Oqood / SPA, SOA, Ejari / tenancy contract, developer price list or brochure | unit no., size, plot, tenure, price, commission, tenancy expiry/rent, paid / outstanding amounts |
| **L** | Link / pasted text through AI (existing) | descriptive fields |
| **S** | Sibling listing — same building/project (new "clone from") | specs and amenities of the same layout; never the permit, unit number or price |
| **X** | Computed | price/sq ft, sq m, annual service charge, floor band, summaries, title draft |
| **U** | User must answer | — |

### 3.2 Step 1 — Start & Classification

| Field | Action | Detail | Autofill |
|---|---|---|---|
| **Start source picker** (new widget) | **ADD** | First screen with five options: *Enter / scan permit* · *Upload documents* · *Paste a link or text* · *Clone a listing in the same building* · *Start blank*. They can be combined; results merge into one AI review. | — |
| **Assigned broker** (agency only) | **MOVE** from step 8 → here, **required** when the agency has more than one broker | Drives BRN, contact and permit ownership in later steps. Default: the creating user if they're a broker, otherwise the last used broker. | A |
| purpose | KEEP | | L D T |
| category | KEEP | Infer from type when the permit or document gives it | T L X |
| ptype | KEEP | | T L D |
| devStatus | UPDATE | Combine with `txn` into one **Market status** field: *Ready – resale* · *Ready – first sale (developer)* · *Off-plan – first sale* · *Off-plan – resale*. This mirrors PF `completion_status` and Bayut's tags. | O D T |
| stage | UPDATE | Read from the project record when a catalogue project is chosen. Ask only for proposed projects. | O |
| txn | MERGE | into Market status | — |
| extRef | KEEP | Optional, collapsed | U |

### 3.3 Step 2 — Location

| Field | Action | Detail | Autofill |
|---|---|---|---|
| **Building / project search** (new) | **ADD** — the primary field | One type-ahead over the catalogue: "Al Sahab Tower 2, Dubai Marina". Selecting a result fills the emirate, community, subcommunity, tower/phase, developer, master developer, zone, coordinates, completion year, tenure and building info (§3.4), and imports shared amenities for review. | C |
| emirate | UPDATE | Derived from the building, editable | C |
| communityId | UPDATE | Derived from the building. Expand the catalogue to the full DLD/ADREC community list. | C |
| subcommunity | UPDATE | Derived. **Persist to a column.** | C |
| buildingName | UPDATE | Becomes a catalogue reference (`buildingId`) + name. Keep "Propose a building" as a fallback. | C |
| propName / propDeveloper / propNote | KEEP | Only when proposing | U |
| tower | UPDATE | Derived when the catalogue has phases or clusters | C |
| developer | UPDATE | Derived from the building, read-only with an override. **Persist for ready listings too.** | C O |
| **masterDeveloper** | **ADD** | e.g. Emaar for Dubai Marina towers (PF shows it) | C |
| **zoneName** (DLD zone) | **ADD** (read-only) | Shown in the regulatory block, as on PF | C |
| unitNo | KEEP (private) | | T D |
| floorNo | KEEP (private) | **Auto-derive `floorBand`** from floorNo ÷ the building's total floors | D T |
| street | UPDATE | Optional, collapsed; derived from the building | C |
| mapLocation / lat / lng | UPDATE | Default pin = building coordinates. Allow a **draggable map** as well as a Google link. Replace the Dubai-only bounds check with a per-emirate check. | C |
| locPrecision | KEEP | Default "Building" | X |

### 3.4 Step 3 — Property details

| Field | Action | Detail | Autofill |
|---|---|---|---|
| areaUnit | **REMOVE from the step** | Move to user preferences. Store canonical sq ft and always **display both sq ft and sq m**, as PF does. | P |
| bedrooms / bathrooms | KEEP | Off-plan: allow choosing a **unit type** from the project, which fills beds, baths, size range and floor plan | T D O S L |
| unitArea / builtUpArea / plotArea / balconyArea | KEEP | | T D O S L |
| areaSource | UPDATE | Auto-set: "Title deed" when it comes from a deed, "Developer floor plan" when from the project, "Permit" when from the permit | X |
| parking | KEEP | Default from a sibling listing or document | D S L |
| parkingType | **MERGE** into amenities | "Covered parking", "Basement parking" as amenities (portal practice) | L |
| extraRooms | KEEP, de-duplicate | Remove "Storage" and "Laundry" here because amenities already cover them; keep Maid's, Study, Driver's | D L S |
| layoutCode | UPDATE | Select from project unit types when available | O S |
| floorBand | UPDATE | Computed from floorNo when both floor values are known; editable | X |
| storeys | KEEP | | D L |
| furnishing | KEEP | Also show for off-plan if the project says "furnished" | L |
| condition | KEEP | | L |
| occupancy | KEEP (ready) | Drives possession in step 4 automatically (§3.5) | D L |
| completionYear | UPDATE | From the building catalogue, read-only with an override | C |
| handoverQ / handoverY / handoverDate | UPDATE | From the project record; editable only for resale or proposed projects | O |
| progressPct / progressSource / progressDate | UPDATE | From the project record (DLD / developer update). **Remove the separate source/date inputs** when the value comes from the catalogue. | O |
| plannedSpec | KEEP | From the project brochure | O L |
| tenure | UPDATE | Default from the building (freehold zone) | C D |
| leaseExpiry / leaseTerm | KEEP | Leasehold only | D |
| views | KEEP | **Store as an array**; also emit as amenities in JSON-LD | L S |
| viewExtent | **REMOVE** | Low value. Use "Partial sea view" wording in the views options or highlights instead. | — |
| kitchenLayout | KEEP (optional, collapsed) | | L |
| appliances | **REMOVE** as a field | Already the amenity "Kitchen appliances" | — |
| pets | KEEP | Default from the building rules | C L |
| amenities (private) | KEEP | | L S |
| amenities (shared / building services) | UPDATE | **Import from the building** (the existing "inherited → review" flow already supports this); the user only confirms | C |
| **Building information block** (new, read-only) | **ADD** | Total floors, lifts, pools, total parking, year of completion, building area (Bayut "Building information") | C |
| type-specific blocks (villa, office, shop, warehouse, land, whole building, labour) | KEEP | Collapse optional fields under "More details". | D L |
| otherInfo | KEEP | | L |

### 3.5 Step 4 — Price & terms

| Field | Action | Detail | Autofill |
|---|---|---|---|
| askingPrice / unitPrice / annualRent | KEEP | Off-plan initial: default to the project's "from" price for the chosen unit type | D O L |
| **priceOnRequest** | **ADD to editor** (it exists only in the collection) | Toggle; hides the price publicly, still required internally | U |
| **pricePerSqft** | **ADD (computed, read-only)** and **persist** | Shown on card and detail, as on both portals | X |
| **previousPrice / price-drop** | **ADD (system)** | Keep a price history on save, so a "Price reduced N%" badge can be shown | X |
| negotiable | KEEP | Persist | U |
| possession | UPDATE | **Auto-derive** from occupancy (vacant → available now; tenanted → subject to tenancy) with an override | X |
| rentalIncome / tenancyExpiry | KEEP | From the Ejari / tenancy contract | D |
| tenancyPublic | KEEP | Default "hide" | X |
| serviceCharge / serviceBasis | UPDATE | Default from the **building benchmark** (AED/sq ft). **Always persist annual + per-sq-ft** (fixes the per-year drop). | C D X |
| servicePeriod | **REMOVE** | Low value; replace with an automatic "as of" date stored with the catalogue benchmark | — |
| bookingBasis / booking | UPDATE | From the project payment plan's down payment | O |
| bookingInSchedule | **REMOVE** | Model the booking as the first schedule row always; validation prevents double counting | — |
| postHandover | UPDATE | Derived from the schedule (true if any row is "post") | X |
| milestones (payment schedule) | UPDATE | **Select a plan from the project** (projects can have several); edit only for overrides | O D |
| incentives / incentiveExpiry | KEEP | From the project | O |
| priceBasis / priceIncludes / originalPrice / paidToDev / outstanding / payToSeller / remainingSchedule / nextInst* | KEEP for off-plan resale | **Autofill from the SOA / Oqood upload** (D). Compute `outstanding = original − paid`, and `payToSeller` from the basis. | D X |
| transferElig / nocStatus / transferCharges / transferPayer | KEEP | Default transferCharges from the developer's fee table in the project record | O |
| finSource / finDate | UPDATE | Auto-set from the uploaded SOA's name and date | X |
| availability / availableFrom / minTenancy | KEEP | **Persist minTenancy** | D L |
| cheques | KEEP | Persist as an array (the collection stores a number) | L |
| depositBasis / deposit | UPDATE | **Default 5% unfurnished / 10% furnished** of annual rent (common Dubai practice), editable. Persist both AED and %. | X |
| refundTerms / upfrontFees / upfrontNote | KEEP (collapsed) | | U |
| utilities / cooling | UPDATE | Cooling default from the building (district cooling provider) | C |
| maintenance | KEEP | | U |
| commBasis / commission / commPayer | UPDATE | **Default from Form A (D) or agency/broker preset (A/P)**, e.g. 2% buyer (sale), 5% tenant (rent) | D A P |
| taxTreatment | KEEP | Default from the preset | A |
| otherCharges | KEEP (collapsed) | | U |
| viewing / viewingNotes | UPDATE | Default from the preset; "Restricted — tenant occupied" auto-suggested when tenanted | A X |
| Additional terms | KEEP | | U |

### 3.6 Step 5 — Marketing

| Field | Action | Detail | Autofill |
|---|---|---|---|
| title | UPDATE | **One-click draft from structured data**, e.g. "Vacant 2BR · Full Marina View · High Floor · Al Sahab Tower 2". Keep the 100-character limit. | X L |
| description | UPDATE | AI "Generate from details" already exists (`kind: 'generate'`). Feed it the catalogue and project data too. Keep the contact-detail filter. | L X |
| highlights | UPDATE | Suggest chips from the data (view, vacant, upgraded, corner unit, post-handover plan) | X |
| locHighlights | UPDATE | Pre-fill from the community/building catalogue: metro, schools, malls, travel times (Bayut/PF "nearby") | C |
| altLang / altTitle / altDesc | UPDATE | Replace the generic language dropdown with a dedicated **Arabic** title and description (both portals publish AR). Offer machine translation. Other languages are optional. | X |
| notes | KEEP (private) | | U |

### 3.7 Step 6 — Photos & media

| Field | Action | Detail | Autofill |
|---|---|---|---|
| photos | KEEP | Add **AI auto-tagging** of room type (living, kitchen, bedroom, view, building) and auto-ordering. Suggest a cover photo. Flag duplicates and low resolution. Keep "actual photo required for ready". | X |
| **building / community photos** | **ADD** | Offer catalogue building photos (as PF does with `images.tower` / `images.community`), clearly labelled | C |
| videos | KEEP | | U |
| floor plans | UPDATE | Attach the project's unit-type floor plan automatically | O S |
| tourUrl | KEEP | | U |
| brochure | UPDATE | From the project record | O |
| **masterPlan** | **ADD** (off-plan) | From the project record | O |
| mediaRights | MERGE | into the declarations in the final step (one tick-box set, not two) | — |

### 3.8 Step 7 — Permit, compliance & display

| Field | Action | Detail | Autofill |
|---|---|---|---|
| permitNo | UPDATE | **Moved to the Start step** as an option. When entered there, pre-fill and lock it here. Accept a **QR scan or PDF**. | T D |
| permitUrl | UPDATE | Generated from the QR / number (Trakheesi validation URL) | T X |
| permitExpiry | KEEP | From the permit | T |
| **issuingAuthority** | **ADD** | DLD/RERA (Dubai), ADREC (Abu Dhabi), RERA Sharjah, RERA Ajman, RAK… derived from the emirate; changes the permit label and format hint | X |
| QR document | KEEP | Generated from the URL if none is uploaded | T |
| Broker licence block (BRN / ORN / brokerage) | UPDATE | Agency: show the **assigned broker's BRN** + the agency's ORN (needs the step-1 move) | P A |
| **agentLicence / DED licence** | **ADD (read-only)** | Both portals show an agent licence and a company licence | P A |
| authType / authExpiry / auth doc | UPDATE | Default "Owner–broker agreement (Form A)" when Form A was uploaded; expiry taken from it | D |
| overrideContact + cPhone / cWhats / cEmail / cChannels / cHours | UPDATE | Agency: default from **contact routing preset** (assigned broker / agency call centre) | A P |
| floorDisplay | KEEP | Default "band" | X |
| portfolio | KEEP | | A |
| promotion | KEEP | | U |
| scheduleDate | **REMOVE** | It only records a preference, there's no publishing service behind it yet. Re-add when scheduling exists. | — |
| **exclusive** | **ADD** | Exclusive / non-exclusive mandate (PF `is_exclusive`). Can be derived from Form A. | D U |

### 3.9 Step 8 — Review & publish

| Field | Action | Detail |
|---|---|---|
| Review summary | UPDATE | Show an **"Autofilled from" chip per field** (Catalogue, Permit, Document, AI, Profile, Computed) and a **quality score** (photos ≥ 8, description length, Arabic, floor plan, tour), like PF's `qs` |
| decl1 / decl2 / decl3 + mediaRights | MERGE | One block of 3 tick-boxes (accuracy, authorisation, media rights) |
| Team member (agency) | **REMOVE from here** (moved to step 1) | Keep a read-only "Assigned to" line |

### 3.10 System / storage changes (no UI)

| Item | Action |
|---|---|
| Persist to [Properties.ts](src/collections/Properties.ts) | `subcommunity`, `buildingId`, `projectId`, `developer` (all statuses), `masterDeveloper`, `zoneName`, `marketStatus` (ready-resale / ready-primary / offplan-primary / offplan-resale), `pricePerSqft`, `serviceChargeAnnual`, `serviceChargePerSqft`, `views[]`, `extraRooms[]`, `negotiable`, `possession`, `minTenancy`, `cheques[]`, `depositAed`, `depositPct`, `handoverDate`, `sizeSqm`, `exclusive`, `issuingAuthority`, `permit.url`, `priceHistory[]`, `fieldSources{}` |
| Align legacy shapes | `rent.cheques` number → array; `offplan.paymentPlan.percent` → the editor's milestone shape; remove `broker` once `primaryBroker` is backfilled |
| New collections | `Communities`, `Buildings` (catalogue) and `Projects` (off-plan, linked to the developer `Members`, unit types, payment plans, floor plans, progress) |
| JSON-LD | Add `RealEstateListing` (+ `Apartment`/`House`/`SingleFamilyResidence`, `Offer` with price/currency, `PostalAddress`, `GeoCoordinates`, `floorSize` QuantitativeValue, `numberOfRooms`, `numberOfBathroomsTotal`, `amenityFeature[]`, `datePosted`, `BreadcrumbList`) to [property/[slug]/page.tsx](src/app/(portal)/property/[slug]/page.tsx). Add `Product`/`Project` to off-plan project pages. |
| AI extraction | Add `unitNo`, `permitNo`, `permitExpiry`, `commission`, `authExpiry`, `originalPrice`, `paidToDev`, `tenancyExpiry` to suggestions **from private documents only** (never from public links). Always show them for review; never apply silently. Match `buildingName` and `communityId` text to catalogue IDs on the server. |

### 3.11 Fields to remove or merge — summary

| Remove / merge | Reason |
|---|---|
| `areaUnit` (as a step field) | Display preference; show both units |
| `txn` → merged into Market status | One question instead of two |
| `viewExtent` | Low value; fold into the views options or highlights |
| `appliances` field | Duplicates the amenity |
| `parkingType` → amenities | Portal practice |
| `extraRooms`: storage, laundry | Duplicates amenities |
| `servicePeriod` | Replace with an automatic "as of" date |
| `bookingInSchedule` | Model the booking as schedule row 1 |
| `postHandover` (input) | Derive from the schedule |
| `progressSource` / `progressDate` (when from the catalogue) | Come from the project record |
| `scheduleDate` | No publishing service behind it |
| `mediaRights` → declarations | One consent block |
| `altLang` generic dropdown | Replace with a dedicated Arabic version |

---

## Part 4 — Step-wise listing guide (proposed flow)

Typed fields: today, roughly 35–50 typed answers for a ready resale apartment. Target: **8–12**, with everything else autofilled or computed and only confirmed by the user.

### 4.1 Broker guide

**Step 1 — Start (≈30 s)**
1. Click **Add property**.
2. Choose how to start; you can combine options:
   - **Enter or scan the advertising permit.** Fills permit no., expiry, validation link and the property details the permit carries.
   - **Upload documents.** Title deed, Form A, Oqood/SPA, SOA, tenancy contract, price list. Fills unit, size, tenure, price, commission, tenancy and payment figures.
   - **Paste a link or text.** Your own website or CRM listing.
   - **Clone from my listing in the same building.** Copies specs and amenities, not the permit, unit or price.
3. Review the AI-filled answers (purple "AI-filled" chips) and accept or reject them.

**Step 2 — Classification (≈10 s)**
1. Confirm **Purpose** (sale / rent), **Category**, **Property type**.
2. Confirm **Market status**: Ready-resale · Ready-first sale · Off-plan-first sale · Off-plan-resale.

**Step 3 — Location (≈15 s)**
1. Type the **building or project** name and pick it from the list. Community, subcommunity, developer, map pin, zone and building facts fill in automatically.
2. Add the **unit number** and **floor number**. Both stay private; the floor band is calculated.
3. Not in the list? Choose **Propose a building** and enter the name and developer.

**Step 4 — Property details (≈1 min)**
1. Confirm **beds, baths and size**. For off-plan, pick the **unit type** instead.
2. Confirm **furnishing, condition and occupancy** (ready only).
3. Review the **shared amenities imported from the building**, and tick the private ones (balcony, maid's room, private pool…).
4. Pick **views**.
5. Optional: open "More details" for type-specific extras.

**Step 5 — Price & terms (≈1 min)**
1. Enter the **price**. Price per sq ft is calculated.
2. Sale: confirm **negotiable**. Possession is derived from occupancy. Confirm the **service charge**, which is pre-filled from the building benchmark.
3. Off-plan first sale: pick the project's **payment plan**; the booking amount fills in.
4. Off-plan resale: upload the **SOA**. Paid, outstanding and next instalment fill in; check "What the buyer pays".
5. Rent: confirm **annual rent, cheques, available from**. The deposit is pre-filled at 5% or 10%.
6. Confirm the **commission**, pre-filled from Form A or your defaults.

**Step 6 — Marketing (≈1 min)**
1. Click **Generate title** and **Generate description**, then edit.
2. Accept suggested **highlights** and **location highlights**.
3. Optional: **Arabic version** (auto-translate, then review).

**Step 7 — Photos & media (≈2 min)**
1. Drag in photos. They're auto-tagged and ordered, and a cover is suggested. Aim for 8–15.
2. Floor plan and brochure are attached automatically for project units. Add a video or tour link if you have one.

**Step 8 — Permit & display (≈15 s)**
1. Permit no., expiry and QR are already filled from step 1. Check them.
2. BRN, ORN and contact come from your profile. Override the contact for this listing only if needed.
3. Confirm the **authorization type** (Form A) and the **exclusive** mandate.

**Step 9 — Review & publish (≈30 s)**
1. Check the **quality score** and the per-field source chips.
2. Tick the 3 declarations, then **Preview**, then **Submit for review**.

### 4.2 Agency guide

Identical to the broker flow, with these differences:

**Step 1 — Start: choose the broker first**
1. **Assigned broker** (required if the agency has more than one broker). This sets the BRN, the permit holder and the default contact for the listing.
2. The agency's **presets** apply automatically: commission, tax treatment, viewing policy, contact routing (assigned broker / agency line / both), portfolio, watermark.
3. Then choose the start source (permit / documents / link / clone from **any agency listing** in the same building).

**Steps 2–7:** same as the broker flow. Commission, viewing and contact defaults come from the agency presets instead of the broker's.

**Step 8 — Permit & display**
- Shows the **assigned broker's BRN** with the **agency's ORN and trade licence**.
- Contact follows the routing preset.
- Agency admins can set **Promotion** (featured) within the membership quota.

**Step 9 — Review & publish**
- Read-only "Assigned to: <broker>" line. Reassigning is done from the listings table, not inside the wizard.
- Agency admins can **submit on behalf** of the broker. The broker receives a notification.

**Agency settings (new screen, once per agency):** ORN, DED licence, default commission (sale / rent), payer, tax treatment, viewing policy, contact routing, default portfolio, photo watermark, preferred brokers per community.

### 4.3 What the user still types (target)

| Listing kind | Typed by the user | Everything else |
|---|---|---|
| Ready resale apartment | building pick, unit no., floor no., beds/baths/size (if no document), furnishing, condition, occupancy, price, photos, permit (if not scanned) | catalogue, permit, documents, profile, computed, AI text |
| Off-plan first sale (catalogue project) | project + unit type pick, price (if not the "from" price), photos optional, permit | project record |
| Off-plan resale | project + unit type pick, unit no., asking price, SOA upload, permit | project record + SOA |
| Annual rental | building pick, unit, beds/baths/size, furnishing, rent, cheques, available from, photos, permit | catalogue, presets, computed deposit |

---

## Part 5 — Implementation order

| Phase | Work | Impact |
|---|---|---|
| **1. Quick wins** (no new data) | Move agency "Team member" to step 1. Remove the fields in §3.11. Compute price/sq ft, sq m, floor band, possession, deposit default and postHandover. Fix the projection gaps (§2.4-1). Add `priceOnRequest` to the editor. Add JSON-LD to the property page. Fix the per-emirate map bounds. | High |
| **2. Profile & presets** | Broker defaults (commission, viewing). Agency settings screen + presets. Contact routing. | High for agencies |
| **3. Catalogue** | `Communities` / `Buildings` collections (seeded from DLD/ADREC open data plus admin entry). Building type-ahead. Imported amenities. Building-info block. Service-charge benchmark. Server-side AI name-to-ID matching. | Very high |
| **4. Off-plan projects** | `Projects` collection, filled by developers on our platform. Unit types, payment plans, floor plans, progress. Units link to a project. Project page + JSON-LD. | Very high for off-plan |
| **5. Permit-first & documents** | Permit number / QR / PDF intake. Private-document extraction for unit no., permit, commission and SOA figures. Form A parsing → authorization + exclusive. | High |
| **6. Media & quality** | Photo auto-tagging and ordering, quality score, Arabic auto-translate, price history and price-drop badge. | Medium |

**How to measure success:** median time to publish; number of fields typed per listing; share of fields filled automatically (from the stored `editor.sources`); share of listings with ≥ 8 photos, a floor plan and an Arabic version; share of listings that pass review the first time.

---

## Part 6 — Implementation status (17 Nov 2026)

No database migration is needed. Every new answer is stored in the listing's `appData`, which the platform already saves and reads back for each listing.

### 6.1 How the flow works now (broker and agency)

Brokers have **8 steps**. Agencies have **9**: the optional "Team member" step stays before Review, as before. The planned Start panel (broker choice, permit and QR, copy from a sibling listing in step 1) was built and then removed at your request, so the permit is entered in Permit & display as before.

| Step | What's new |
|---|---|
| 1 Classification | **Market status** is now one choice: Ready·Resale / Ready·First sale / Off-plan·First sale / Off-plan·Resale. |
| 2 Location | **Building / project search** over the platform catalogue. Picking a building fills the emirate, community, subcommunity, tower, developer, master developer, map pin, completion year, tenure, total floors, cooling, pets and service-charge benchmark, plus handover, construction progress and payment plan for off-plan projects. A read-only **Building information** card shows what came from the catalogue, and shared amenities are imported for review. The community list is expanded to ~150 real communities. Coordinates can be typed directly. The pin check uses per-emirate bounds instead of Dubai only. |
| 3 Property details | **Unit-type picker** for off-plan projects: fills beds, baths, size range, layout and the project floor plan. **Floor band** is calculated from the floor number and total floors. The area unit is a toggle, with the default set in Account. Parking types, storage and laundry are now amenities. A new **Parking** amenity group was added, with a confirm step for imported amenities. |
| 4 Price & terms | **Price on request** option. Possession is derived from occupancy. Service-charge basis is guessed from the amount. Deposit defaults to 5% (unfurnished) or 10% (furnished). Commission, tax, viewing and maintenance come from **Account › Listing defaults**. The booking is counted once automatically (no tick-box), and post-handover is derived from the schedule. |
| 5 Marketing | "Generate" now drafts a **structured title** (e.g. "Vacant 2 BR Apartment · Sea view · High floor · Building") and a fuller factual description. **Suggested highlight chips**. A dedicated **Arabic version** section with **AI translation**. |
| 6 Photos & media | Media-rights consent now lives only in the declarations at Review. |
| 7 Permit & display | The permit label and authority follow the emirate (DLD/Trakheesi, ADREC/Madhmoun…). New **Exclusive / Non-exclusive** mandate field. Agencies see the **assigned broker's BRN and contact** (chosen in the Team member step) plus the agency ORN and trade licence. "Preferred submission date" was removed. |
| 8 Review & publish | **Listing quality score (0–100)** with tips. Each field shows a **source chip** (Calculated, Your defaults, Building catalogue, Project, AI-filled). |

**Account › Listing defaults (new tab):** area unit, sale commission, rental fee, deposit %, maintenance, tax treatment, viewing arrangements and notes, and an optional default listing contact (e.g. an agency call centre). These apply to new listings only.

### 6.2 Data and public side

- **Stored on every listing:**
  - Location and building: `subcommunity`, `tower`, `buildingRef`, `developer` (for all statuses), `masterDeveloper`, `totalFloors`.
  - Market status: `marketStatus`, `transaction`.
  - Price and size: `pricePerSqft`, `sizeSqm`, `priceOnRequest`, `priceHistory` / `previousPrice`.
  - Charges and terms: `serviceChargePerSqft` + `serviceChargeAnnual` (fixes the dropped yearly charge), `depositAed` / `depositPct`, `negotiable`, `possession`, `minTenancy`, `handoverDate`, `postHandover`, `exclusive`.
  - Unit features: `views[]`, `extraRooms[]`.
  - Permit and quality: `issuingAuthority`, `permit.url`, `qualityScore`.
- **Public listing:**
  - "Price on request" hides the price.
  - A **"N% price drop"** badge appears only for a real reduction after publishing.
  - Cards show **Off-plan · First sale / Resale**.
  - `priceHistory` and `qualityScore` stay private.
- **JSON-LD:** the property page now publishes `RealEstateListing` + `Offer` + `Apartment`/`House`, plus `BreadcrumbList`.
- **AI autofill:**
  - Removed fields were dropped from extraction.
  - Unit no., floor, permit, Form A terms (authorization, expiry, exclusivity, commission) and SOA figures are extracted **only when no public web page is among the sources**, and are always held for review.
- **Bug fixed:** "Duplicate as draft" kept the permit and unit number, because the editor re-reads them from its own data.

### 6.3 Changed from the plan

| Planned | What was built instead, and why |
|---|---|
| Curated `Communities` / `Buildings` / `Projects` collections seeded from DLD/ADREC | The catalogue is **derived from published listings on the platform** (`/api/listing-catalogue`), which needs no migration and no third-party data. It only includes listings with a public building location, exposes only building-level facts, and prefers the developer's own listings for project facts. A curated register can replace the data source later without changing the UI. |
| Draggable map | Building pin from the catalogue, plus typed coordinates. Adding a map library was out of scope. |
| Pre-fill property details from the permit validation page | Not built. We haven't confirmed which fields the DLD/ADREC validation pages expose. Property details come from the permit document through AI. |
| Permit-first Start panel, broker choice in step 1, copy from a sibling listing | Built, then removed at your request. The original flow is kept: permit in Permit & display, agency broker in the Team member step. |

### 6.4 Not done yet

- AI photo tagging and automatic ordering.
- Agency watermark, preferred brokers per community, and "submit on behalf" notifications.
- Location highlights pre-filled from nearby places (no nearby-places data source yet).
- Aligning the legacy Payload columns (`rent.cheques` as a number, `offplan.paymentPlan.percent`). That needs a migration.

---

## Sources

- Property Finder: [Dubai Marina listing page](https://www.propertyfinder.ae/en/buy/dubai/apartments-for-sale-dubai-marina.html) · [Marina Pinnacle resale listing](https://www.propertyfinder.ae/en/plp/buy/apartment-for-sale-dubai-dubai-marina-marina-pinnacle-172419299.html) · [Six Senses off-plan unit](https://www.propertyfinder.ae/en/plp/buy/apartment-for-sale-dubai-dubai-marina-six-senses-residences-164563785.html) · [Six Senses new-project page](https://www.propertyfinder.ae/en/new-projects/select-group/six-senses-residences-dubai-marina) · [Off-plan Dubai Marina](https://www.propertyfinder.ae/en/for-sale/off-plan/apartments/dubai/dubai-marina)
- Bayut: [Dubai Marina listing page](https://www.bayut.com/for-sale/apartments/dubai/dubai-marina/) · [Al Sahab Tower 2 listing](https://www.bayut.com/property/details-17212728.html) · [New projects](https://www.bayut.com/new-projects) · [Binghatti Skyrise Tower A project](https://www.bayut.com/for-sale/property/dubai/business-bay/binghatti-skyrise/binghatti-skyrise-tower-a/)
- Off-plan buyer checklist context: [Driven Properties off-plan projects](https://www.drivenproperties.com/dubai/off-plan-projects?page_no=8)
