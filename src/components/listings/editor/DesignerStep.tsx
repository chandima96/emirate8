'use client';

import { EditorSection } from './EditorSection';
import { listingSchema as S } from './designer-schema';
import { DesignerField } from './DesignerFields';
import { VideoManager } from './VideoManager';
import { StepMedia } from './StepMedia';
import { StepReview } from './StepsMore';
import {
  AdditionalFeatures,
  AmenitiesWidget,
  LocationWidget,
  MarketingWidget,
  MilestonesWidget,
  PriceSummary,
  PrivateDocument,
  ProfileWidget,
  Representation,
  ReviewSummary,
  TermsWidget,
} from './DesignerWidgets';

export function DesignerStep({ ed, step, preview, ready }) {
  const d = ed.L.editor.d,
    c = S.ctxOf(d),
    definition = S.STEPS[step - 1];
  // Keep the existing production upload manager and append the reference's rights declaration.
  if (step === 6)
    return (
      <>
        <StepMedia ed={ed} />
        <VideoManager ed={ed} />
        <EditorSection
          id="section-md-tour"
          title="Virtual tour"
          optional
          defaultOpen={!!d.tourUrl}
          hasErrors={!!ed.errors.tourUrl}
          className="mt-6 border-t border-line pt-5"
        >
          <DesignerField ed={ed} fieldKey="tourUrl" />
        </EditorSection>
        <div className="mt-6 border-t border-line pt-5">
          <DesignerField ed={ed} fieldKey="mediaRights" />
        </div>
      </>
    );
  const sections = S.activeSections(step - 1, c, d);
  return (
    <>
      {step === 8 ? (
        <StepReview ed={ed} preview={preview} ready={ready} />
      ) : (
        <>
          <h2 className="h3" tabIndex={-1}>
            {definition.title}
          </h2>
          <p className="mt-1 text-[13px] text-muted">{definition.desc}</p>
        </>
      )}
      {step === 7 && (
        <div className="mt-6">
          <Representation ed={ed} />
        </div>
      )}
      <div className="mt-6 space-y-7">
        {sections.map((section) => (
          <EditorSection
            key={section.id}
            id={'section-' + section.id}
            optional={!!section.optional}
            defaultOpen={
              (section.fields || []).some((key) => !S.util.isBlank(d[key]) && d[key] !== false) ||
              (section.kind === 'custom' && !!ed.L.editor.custom?.length) ||
              (section.kind === 'highlights' && !!ed.L.highlights?.length) ||
              (section.kind === 'extra' && !!ed.L.editor.extraTerms?.length) ||
              (section.kind === 'cheques' && Object.values(ed.L.editor.cheqAmts || {}).some((value) => !S.util.isBlank(value)))
            }
            hasErrors={
              (section.fields || []).some((key) => !!ed.errors[key]) || !!ed.errors[S.WIDGET_ERRKEY[section.kind]]
            }
            title={
              section.title === 'Broker licence & brokerage' && ed.isDeveloper
                ? 'Developer credentials'
                : section.id === 'mk-notes' && ed.isDeveloper
                  ? 'Internal developer notes'
                  : section.title
            }
            className="border-t border-line pt-5 first:border-t-0 first:pt-0"
          >
            {['community', 'building', 'map'].includes(section.kind) && <LocationWidget ed={ed} kind={section.kind} />}
            {section.kind === 'needClass' && (
              <p id="designer-classification" tabIndex={-1} className="text-sm text-muted">
                Complete Classification first.{' '}
                <button type="button" className="underline" onClick={() => ed.go(1, true)}>
                  Go to Classification
                </button>
              </p>
            )}
            {section.kind === 'ref' && (
              <p className="mb-4 text-xs text-muted">
                Platform reference: {ed.L.ref || 'Assigned on first save'}. Your CRM reference stays private.
              </p>
            )}
            {section.kind === 'areaBasis' && (
              <p className="mb-4 text-xs text-muted">
                Unit, built-up, plot and balcony areas are recorded separately. Price per area uses the appropriate area
                for this property type.
              </p>
            )}
            {section.kind === 'amen' && <AmenitiesWidget ed={ed} />}
            {section.kind === 'custom' && <AdditionalFeatures ed={ed} />}
            {section.kind === 'milestones' && <MilestonesWidget ed={ed} />}
            {['saleSummary', 'rentSummary', 'resaleSummary'].includes(section.kind) && (
              <PriceSummary ed={ed} kind={section.kind} />
            )}
            {['cheques', 'extra'].includes(section.kind) && <TermsWidget ed={ed} kind={section.kind} />}
            {['generate', 'highlights'].includes(section.kind) && <MarketingWidget ed={ed} kind={section.kind} />}
            {section.kind === 'doc' && <PrivateDocument name={section.doc} ed={ed} />}
            {['broker', 'contact', 'precisionNote'].includes(section.kind) && (
              <ProfileWidget ed={ed} kind={section.kind} />
            )}
            {section.kind === 'verify' && (
              <p className="mb-4 text-xs text-muted">
                Permit details and links are supplied for review. Providing a number or link does not verify this
                listing.
              </p>
            )}
            {section.kind === 'review' && <ReviewSummary ed={ed} />}
            <div className="grid gap-4 sm:grid-cols-2">
              {(section.fields || []).map((key) => (
                <DesignerField key={key} ed={ed} fieldKey={key} />
              ))}
            </div>
            {section.note && (
              <p className="mt-4 rounded-lg bg-mist p-3 text-xs leading-relaxed text-muted">{section.note}</p>
            )}
          </EditorSection>
        ))}
      </div>
    </>
  );
}
