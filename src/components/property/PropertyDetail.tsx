'use client';

import { PropertyHeader } from './detail/PropertyHeader';
import { Gallery } from './detail/Gallery';
import { Characteristics } from './detail/Characteristics';
import { Description, Highlights } from './detail/Description';
import { PaymentPlan } from './detail/PaymentPlan';
import { Features } from './detail/Features';
import { ContactSidebar } from './detail/ContactSidebar';
import { Details } from './detail/Details';
import { DemoMap } from './detail/DemoMap';
import { CommunityInsights } from './detail/CommunityInsights';
import { ListedBy } from './detail/ListedBy';
import { Calculators } from './detail/Calculators';
import { Similar } from './detail/Similar';
import { MobileCta } from './detail/MobileCta';
import { DeveloperOwnerCard } from './detail/DeveloperOwnerCard';
import { isClosed } from './detail/shared';

/**
 * Full Centris-style property page body for a normalised listing. Used by /property/[slug] and by the
 * listing editor's full-page preview (`preview`: links and contact actions are inert, similar properties,
 * area listings and the mobile contact bar are left out — exactly as the old `{ preview: true }` option).
 */
export function PropertyDetail({ listing: l, preview = false }) {
  if (!l) return null;
  return (
    <div>
      <PropertyHeader listing={l} preview={preview} />
      <Gallery listing={l} preview={preview} />
      <Characteristics listing={l} />
      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-12">
        <div className="min-w-0">
          <Description listing={l} />
          <Highlights listing={l} />
          <PaymentPlan listing={l} />
          <Features listing={l} />
        </div>
        <ContactSidebar listing={l} preview={preview} />
      </div>
      <Details listing={l} />
      <DeveloperOwnerCard listing={l} preview={preview} />
      <DemoMap listing={l} preview={preview} />
      <CommunityInsights listing={l} preview={preview} />
      <ListedBy listing={l} preview={preview} />
      <Calculators listing={l} />
      {!preview && <Similar listing={l} />}
      {!preview && !isClosed(l) && <MobileCta listing={l} />}
    </div>
  );
}
