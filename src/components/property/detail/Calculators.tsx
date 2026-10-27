'use client';

import { MortgageCalc } from './calculators/MortgageCalc';
import { PurchaseCostsCalc } from './calculators/PurchaseCostsCalc';
import { RentAffordabilityCalc } from './calculators/RentAffordabilityCalc';
import { PaymentPlanCalc } from './calculators/PaymentPlanCalc';
import { isClosed } from './shared';

/** 09 — estimates: rent affordability (rent) · payment plan + purchase costs (off-plan) · mortgage + purchase costs (ready sale). */
export function Calculators({ listing: l }) {
  if (isClosed(l)) return null;
  const p = +l.price || 0;
  const off = l.completion === 'offplan';
  const rent = l.purpose === 'rent';
  return (
    <section className="mt-12" aria-labelledby="h-calc">
      <h2 id="h-calc" className="h3">
        Calculators
      </h2>
      <div className={'mt-4 grid gap-4 ' + (off ? 'lg:grid-cols-3' : 'md:grid-cols-2')}>
        {rent ? (
          <RentAffordabilityCalc price={p} cheques={l.cheques} />
        ) : off ? (
          <PaymentPlanCalc price={p} plan={(l.offplan && l.offplan.plan) || []} />
        ) : (
          <MortgageCalc price={p} />
        )}
        {!rent && <PurchaseCostsCalc price={p} offplan={off} />}
      </div>
    </section>
  );
}
