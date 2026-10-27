'use client';

import { Field, invalidProps } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import { AREAS, EMIRATES, TYPES } from '@/config/reference';
import { fmtNumber } from '@/lib/store';
import { GroupError, NumInput, OptionSelect } from './inputs';
import { priceWords } from './model';
import { PaymentPlan } from './PaymentPlan';

function StepHeading({ children, intro }) {
  return (
    <>
      <h2 className="h3" tabIndex={-1}>
        {children}
      </h2>
      <p className="mt-1 text-[13px] text-muted">{intro}</p>
    </>
  );
}

function Choice({ checked, disabled = undefined, onPick, children }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : 0}
      className="choice"
      onClick={() => !disabled && onPick()}
    >
      <span className="radio-dot" />
      <span>{children}</span>
    </button>
  );
}

/* ---------- 1 Classification ---------- */
export function StepClassification({ ed }) {
  const { L, errors, pick, setCategory, set } = ed;
  const off = L.completion === 'offplan';
  return (
    <>
      <StepHeading intro="These choices decide which fields you’ll be asked for.">Classification</StepHeading>
      <fieldset className="mt-6">
        <legend className="label">Property development status</legend>
        <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Development status">
          <Choice checked={L.completion === 'ready'} onPick={() => pick('completion', 'ready')}>
            <span className="flex items-center gap-2 font-semibold text-ink">
              <Icon name="house-check" className="h-4 w-4" />
              Ready property
            </span>
            <span className="mt-0.5 block text-xs text-muted">Completed and available to buy or rent now.</span>
          </Choice>
          <Choice checked={off} onPick={() => pick('completion', 'offplan')}>
            <span className="flex items-center gap-2 font-semibold text-ink">
              <Icon name="cone-striped" className="h-4 w-4" />
              Off-plan property
            </span>
            <span className="mt-0.5 block text-xs text-muted">
              Under construction, sold with a developer payment plan.
            </span>
          </Choice>
        </div>
        <GroupError id="err-completion" msg={errors.completion} />
      </fieldset>
      <fieldset className="mt-6">
        <legend className="label">Listing purpose</legend>
        <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Listing purpose">
          <Choice checked={L.purpose === 'sale'} onPick={() => pick('purpose', 'sale')}>
            <span className="block font-semibold text-ink">For sale</span>
            <span className="mt-0.5 block text-xs text-muted">Asking price in AED.</span>
          </Choice>
          <Choice checked={L.purpose === 'rent'} disabled={off} onPick={() => pick('purpose', 'rent')}>
            <span className="block font-semibold text-ink">For rent</span>
            <span className="mt-0.5 block text-xs text-muted">
              {off ? 'Not available — off-plan units are listed for sale.' : 'Annual rent and payment terms.'}
            </span>
          </Choice>
        </div>
        <GroupError id="err-purpose" msg={errors.purpose} />
      </fieldset>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="field">
          <span className="label">Category</span>
          <div className="seg w-full" role="group" aria-label="Category">
            {[
              ['residential', 'Residential'],
              ['commercial', 'Commercial'],
            ].map(([k, label]) => (
              <button
                key={k}
                type="button"
                className="flex-1"
                aria-pressed={L.category === k}
                onClick={() => setCategory(k)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <Field id="f-type" label={off ? 'Unit type' : 'Property type'} error={errors.type}>
          <OptionSelect
            id="f-type"
            value={L.type}
            options={TYPES[L.category]}
            placeholder="Select type"
            error={errors.type}
            onValue={(v) => set('type', v)}
          />
        </Field>
      </div>
    </>
  );
}

/* ---------- 2 Location / development ---------- */
function TextField({
  ed,
  id,
  path,
  label,
  optional = undefined,
  placeholder,
  className = undefined,
  textarea = undefined,
  ...rest
}) {
  const v = path.split('.').reduce((a, k) => (a == null ? a : a[k]), ed.L);
  const error = ed.errors[path];
  const Tag = textarea ? 'textarea' : 'input';
  return (
    <Field id={id} label={label} optional={optional} error={error} className={className}>
      <Tag
        id={id}
        className={textarea ? 'textarea' : 'input'}
        value={v == null ? '' : v}
        placeholder={placeholder}
        onChange={(e) => ed.set(path, e.target.value)}
        {...invalidProps(id, error)}
        {...rest}
      />
    </Field>
  );
}

function SelectField({
  ed,
  id,
  path,
  label,
  optional = undefined,
  options,
  placeholder = undefined,
  num = undefined,
  className = undefined,
}) {
  const v = path.split('.').reduce((a, k) => (a == null ? a : a[k]), ed.L);
  const error = ed.errors[path];
  return (
    <Field id={id} label={label} optional={optional} error={error} className={className}>
      <OptionSelect
        id={id}
        value={v}
        options={options}
        placeholder={placeholder}
        error={error}
        onValue={(x) => ed.set(path, num ? (x === '' ? '' : +x) : x)}
      />
    </Field>
  );
}

function NumField({
  ed,
  id,
  path,
  label,
  optional = undefined,
  placeholder = undefined,
  money = undefined,
  hint = undefined,
  className = undefined,
  ...rest
}) {
  const v = path.split('.').reduce((a, k) => (a == null ? a : a[k]), ed.L);
  const error = ed.errors[path];
  return (
    <Field id={id} label={label} optional={optional} error={error} hint={hint} className={className}>
      <NumInput
        id={id}
        value={v}
        money={money}
        placeholder={placeholder}
        error={error}
        onValue={(x) => ed.set(path, x)}
        {...rest}
      />
    </Field>
  );
}

export function StepLocation({ ed }) {
  const { L, t, set, errors } = ed;
  const off = t.offplan;
  return (
    <>
      <StepHeading
        intro={off ? 'Project details as published by the developer.' : t.ready ? 'Where is the property?' : ''}
      >
        {off ? 'Development information' : t.ready ? 'Location' : ''}
      </StepHeading>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Field id="f-emirate" label="Emirate" error={errors.emirate}>
          <OptionSelect
            id="f-emirate"
            value={L.emirate}
            options={EMIRATES}
            error={errors.emirate}
            onValue={(v) => set('emirate', v)}
          />
        </Field>
        <SelectField
          ed={ed}
          id="f-area"
          path="area"
          label="Community"
          options={AREAS[L.emirate] || []}
          placeholder="Select community"
        />
        {t.ready && (
          <>
            <TextField
              ed={ed}
              id="f-building"
              path="building"
              label="Building or cluster"
              placeholder="e.g. Marina Gate"
            />
            <TextField
              ed={ed}
              id="f-unit"
              path="unit"
              label="Unit number"
              optional="private"
              placeholder="Never shown publicly"
            />
          </>
        )}
        {off && (
          <>
            <TextField
              ed={ed}
              id="f-project"
              path="offplan.project"
              label="Project name"
              placeholder="e.g. Creekside Tower 2"
            />
            <TextField
              ed={ed}
              id="f-developer"
              path="offplan.developer"
              label="Developer"
              placeholder="Developer name"
            />
            <SelectField
              ed={ed}
              id="f-devtype"
              path="offplan.devType"
              label="Development type"
              options={[
                'Residential tower',
                'Mixed-use tower',
                'Villa community',
                'Townhouse community',
                'Low-rise residences',
                'Commercial tower',
              ]}
            />
            <SelectField
              ed={ed}
              id="f-devstatus"
              path="offplan.devStatus"
              label="Development status"
              options={['Launched', 'Under construction', 'Nearing completion']}
            />
            <TextField
              ed={ed}
              id="f-launch"
              path="offplan.launch"
              label="Launch date"
              optional="optional"
              placeholder="e.g. Q2 2025"
            />
            <TextField
              ed={ed}
              id="f-handover"
              path="offplan.handover"
              label="Expected handover"
              placeholder="e.g. Q4 2027"
            />
            <TextField
              ed={ed}
              id="f-projreg"
              path="offplan.projectReg"
              label="Project registration / reference"
              optional="if available"
              placeholder="Registration or escrow reference"
            />
            <SelectField
              ed={ed}
              id="f-unitavail"
              path="offplan.unitAvailability"
              label="Unit availability"
              options={['Selected units available', 'Limited units', 'Last units', 'Resale unit']}
            />
            <TextField
              ed={ed}
              id="f-projdesc"
              path="offplan.projectDesc"
              label="Project description"
              placeholder="The development, its facilities and the developer’s published highlights."
              className="sm:col-span-2"
              textarea
            />
          </>
        )}
      </div>
      {t.ready && (
        <p className="mt-4 flex items-center gap-2 text-xs text-muted">
          <Icon name="eye-slash" className="h-3.5 w-3.5" />
          Unit numbers are private and never appear on the public listing.
        </p>
      )}
    </>
  );
}

/* ---------- 3 Details ---------- */
function Counter({ value, max }) {
  return (
    <span className="text-2xs text-muted">
      {(value || '').length} / {max}
    </span>
  );
}

const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => String(a + i));

export function StepDetails({ ed }) {
  const { L, t, set, errors } = ed;
  const off = t.offplan;
  return (
    <>
      <StepHeading intro="Describe the property accurately — this is what buyers will see.">
        {off ? 'Unit information' : t.ready ? 'Property details' : ''}
      </StepHeading>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Field
          id="f-title"
          label="Listing title"
          error={errors.title}
          className="sm:col-span-2"
          labelAside={<Counter value={L.title} max={80} />}
          hint="Lead with the property type and its best feature. 40–70 characters works well."
        >
          <input
            id="f-title"
            className="input"
            maxLength={80}
            value={L.title || ''}
            placeholder="e.g. Two-bedroom marina residence with balcony"
            onChange={(e) => set('title', e.target.value)}
            {...invalidProps('f-title', errors.title)}
          />
        </Field>
        <Field
          id="f-summary"
          label="Short summary"
          optional="shown first"
          className="sm:col-span-2"
          labelAside={<Counter value={L.summary} max={160} />}
        >
          <input
            id="f-summary"
            className="input"
            maxLength={160}
            value={L.summary || ''}
            placeholder="One sentence buyers read before the full description"
            onChange={(e) => set('summary', e.target.value)}
          />
        </Field>
        <Field
          id="f-desc"
          label="Full description"
          error={errors.description}
          className="sm:col-span-2"
          labelAside={<Counter value={L.description} max={3000} />}
        >
          <textarea
            id="f-desc"
            className="textarea min-h-[160px]"
            maxLength={3000}
            value={L.description || ''}
            placeholder="Layout, condition, views and what makes it a good home or investment. Separate paragraphs with a blank line."
            onChange={(e) => set('description', e.target.value)}
            {...invalidProps('f-desc', errors.description)}
          />
        </Field>
        {t.res && (
          <SelectField
            ed={ed}
            id="f-beds"
            path="beds"
            label="Bedrooms"
            num
            placeholder="Select"
            options={[['0', 'Studio'], ...range(1, 7)]}
          />
        )}
        <SelectField
          ed={ed}
          id="f-baths"
          path="baths"
          label="Bathrooms"
          num
          placeholder="Select"
          options={range(1, 8)}
        />
        <NumField ed={ed} id="f-size" path="size" label="Built-up area (sqft)" placeholder="e.g. 1320" />
        {t.plot && (
          <NumField
            ed={ed}
            id="f-plot"
            path="plot"
            label="Plot area (sqft)"
            placeholder="Villas, townhouses and plots"
          />
        )}
        {t.ready && (
          <>
            <SelectField
              ed={ed}
              id="f-parking"
              path="parking"
              label="Parking spaces"
              num
              placeholder="Select"
              options={range(0, 5)}
            />
            <SelectField
              ed={ed}
              id="f-furn"
              path="furnishing"
              label="Furnishing"
              placeholder="Select"
              options={
                L.category === 'commercial'
                  ? ['Shell & core', 'Fitted', 'Furnished']
                  : ['Unfurnished', 'Semi-furnished', 'Furnished']
              }
            />
            <SelectField
              ed={ed}
              id="f-cond"
              path="condition"
              label="Property condition"
              placeholder="Select"
              options={['Brand new', 'Excellent', 'Upgraded', 'Good', 'Needs renovation']}
            />
            <NumField
              ed={ed}
              id="f-year"
              path="completionYear"
              label="Completion year"
              maxLength={4}
              placeholder="e.g. 2019"
            />
          </>
        )}
        <NumField ed={ed} id="f-floor" path="floor" label="Floor" optional="where applicable" placeholder="e.g. 31" />
        {t.ready && (
          <NumField ed={ed} id="f-floors" path="totalFloors" label="Total floors" optional="where applicable" />
        )}
        <SelectField
          ed={ed}
          id="f-view"
          path="view"
          label="View"
          placeholder="Select"
          options={[
            'Sea view',
            'Marina view',
            'Burj Khalifa view',
            'Canal view',
            'Creek view',
            'Golf view',
            'Park view',
            'Garden view',
            'Lake view',
            'City view',
            'Community view',
          ]}
        />
        {t.ready && (
          <TextField
            ed={ed}
            id="f-avail"
            path="availableFrom"
            label="Availability"
            placeholder="e.g. Immediately, or From 1 December"
          />
        )}
      </div>
    </>
  );
}

/* ---------- 4 Price & terms ---------- */
export function StepPrice({ ed }) {
  const { L, t } = ed;
  const rent = L.purpose === 'rent';
  const off = L.completion === 'offplan';
  const saleReady = t['sale-ready'];
  const plan = L.offplan.plan;
  const bookingPct = plan.filter((m) => m.stage === 'booking').reduce((s, m) => s + (+m.pct || 0), 0);
  const bookingPlaceholder =
    !L.offplan.booking && +L.price && bookingPct
      ? 'AED ' + fmtNumber(Math.round((+L.price * bookingPct) / 100)) + ' from the plan'
      : 'Calculated from the plan if left blank';
  return (
    <>
      <h2 className="h3" tabIndex={-1}>
        {rent ? 'Rent & rental terms' : saleReady ? 'Price & ownership' : off ? 'Price & payment plan' : ''}
      </h2>
      <p className="mt-1 text-[13px] text-muted">
        {rent
          ? 'Set the annual rent and the terms tenants will see.'
          : off
            ? 'Set the unit price and the developer’s payment plan.'
            : 'Set the asking price, occupancy and running costs.'}
      </p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <NumField
          ed={ed}
          id="f-price"
          path="price"
          money
          label={rent ? 'Annual rent (AED)' : off ? 'Unit price (AED)' : 'Asking price (AED)'}
          hint={priceWords(L.price, L.purpose, fmtNumber) || undefined}
        />
        {rent && (
          <>
            <SelectField
              ed={ed}
              id="f-cheques"
              path="cheques"
              label="Number of cheques"
              placeholder="Select"
              options={['1', '2', '4', '6', '12']}
            />
            <NumField
              ed={ed}
              id="f-deposit"
              path="deposit"
              label="Security deposit (% of annual rent)"
              inputMode="decimal"
              placeholder="e.g. 5"
            />
            <TextField
              ed={ed}
              id="f-avail2"
              path="availableFrom"
              label="Available from"
              placeholder="e.g. Immediately"
            />
            <Field id="f-terms" label="Rental terms" className="sm:col-span-2">
              <textarea
                id="f-terms"
                className="textarea min-h-[80px]"
                value={L.rentalTerms || ''}
                placeholder="Lease length, Ejari, maintenance, pets, chiller fees…"
                onChange={(e) => ed.set('rentalTerms', e.target.value)}
              />
            </Field>
          </>
        )}
        {saleReady && (
          <>
            <SelectField
              ed={ed}
              id="f-occ"
              path="occupancy"
              label="Vacant or tenanted"
              placeholder="Select"
              options={['Vacant', 'Tenanted', 'Owner-occupied']}
            />
            <NumField
              ed={ed}
              id="f-sc"
              path="serviceCharge"
              label="Service charges (AED per sqft per year)"
              inputMode="decimal"
              placeholder="If known"
            />
            {L.occupancy === 'Tenanted' && (
              <TextField
                ed={ed}
                id="f-tenancy"
                path="tenancyInfo"
                label="Tenancy information"
                className="sm:col-span-2"
                placeholder="e.g. Tenanted until March; 90-day notice for viewings"
              />
            )}
          </>
        )}
        {t.ready && (
          <SelectField
            ed={ed}
            id="f-own"
            path="ownership"
            label="Ownership"
            options={['Freehold', 'Leasehold', 'Usufruct']}
          />
        )}
        {off && (
          <NumField
            ed={ed}
            id="f-booking"
            path="offplan.booking"
            money
            label="Booking amount (AED)"
            optional="optional"
            placeholder={bookingPlaceholder}
          />
        )}
      </div>
      {off && <PaymentPlan ed={ed} />}
    </>
  );
}
