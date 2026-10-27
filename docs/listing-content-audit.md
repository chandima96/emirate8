# Add Property: V5 dropped-items audit

Reviewed all seven pages of `EMIRATE08_V5_Dropped_Items.pdf` (source comparison dated 23 October 2026) against the shared broker/developer listing editor. This document describes useful fields removed from V5; its list is a restoration checklist, not a request to delete fields.

| PDF pages | Area                   | Current coverage                                                                                                                                                                                                                                                                               |
| --------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1         | Classification         | Land and four plot types, expanded residential/commercial types, initial sale versus resale.                                                                                                                                                                                                   |
| 1         | Location               | Subcommunity, dedicated tower/phase/cluster entry, developer for ready/off-plan, private unit number, street, coordinates/map-check link, public precision. Building names can be entered; missing-building proposals are retained with the listing.                                           |
| 2         | Property details       | Units and separate area measurements, larger/custom bedroom/bathroom/parking counts, parking types, layout code, storeys, progress/source/date, planned specifications, tenure/lease terms, multiple views, kitchen/appliances, pets and rental occupancy.                                     |
| 3         | Type-specific sections | Villa/townhouse, office, shop/showroom, warehouse/factory, land, whole-building and labour-accommodation questions.                                                                                                                                                                            |
| 3         | Amenities              | Standard amenity groups including accessibility, private/shared labels, existing/planned status, charge attributes and additional-feature details.                                                                                                                                             |
| 4-5       | Prices and terms       | Ready-sale possession/tenancy/privacy/service charges; off-plan initial booking/milestones/incentives; resale basis/developer payments/transfer/payment summary; rent/cheques/deposit/upfront/running costs; shared commission/tax/viewing and itemised terms with notes.                      |
| 6         | Marketing              | Factual template generator, additional language, private notes and contact/link checks.                                                                                                                                                                                                        |
| 6         | Photos and media       | Cover crop, photo categories/types, duplicate hashes, source-resolution warnings, actual-photo requirement for ready listings, camera input, video uploads/links/posters/subtitles/types, PDF/image floor plans with names and floor/level labels (ten-plan limit), media-rights confirmation. |
| 7         | Permit/display         | Permit link, session-only QR/authorization documents, account BRN/ORN/brokerage panel, authorization type/expiry, contact override fields, floor disclosure, portfolio/promotion and preferred submission date. Developer representation controls remain available.                            |
| 7         | Review                 | Per-step summaries, Public/Private/Not shown labels, edit links, hidden-answer notices, non-blocking suggestions and separate declarations.                                                                                                                                                    |

## Corrections made after reading this PDF

- Added photo checks against original bytes and dimensions before resizing/uploading. Identical bytes under a different filename are duplicates; low resolution warns without blocking. Hashes and dimensions persist with photo metadata. Legacy photos without original hashes cannot be matched against an original upload solely by filename.
- Added a separate floor/level field for every floor plan and included it in public gallery labels.
- Added notes to itemised additional terms and carried public terms into review/public property details. These are separate from private internal broker notes.
- Displayed actual BRN, ORN and brokerage values from the signed-in account, with missing values shown explicitly.
- Added Not shown labels for operational display controls and notices for answers hidden by classification changes.

## Integrations that remain separate

- Reviewed building/project catalogue search, automatic developer/coordinate population and catalogue-amenity import/confirmation need a real catalogue service. The supplied standalone catalogue contains sample buildings; those are not imported into the application as real records.
- Missing-building details are captured in the listing draft. A separate building-catalogue moderation queue and approval lifecycle are not implemented.
- QR, authorization and statement-of-account file pickers are session-only, matching the supplied standalone reference. Secure persistence and staff access need private document storage; the existing public media upload endpoint is not used for these files.
- Preferred submission date is a saved preference, not a publishing scheduler. Promotion remains subject to membership; this change adds no entitlement/billing service. The app currently provides a single public portfolio.
- Contact override values are recorded; phone/WhatsApp display uses the listing override. Email delivery continues through the existing enquiry workflow.

## Checks

`node --test scripts/test-listing-editor.mjs` covers the property journeys, draft/public projections, duplicate file identity, resolution guidance and additional PDF fields.

`node scripts/check-listing-render.cjs` renders all eight steps across ten representative journeys and checks field IDs.

Full-project TypeScript checking is separately affected by the existing Next.js/React dependency mismatches and missing GSAP installation.
