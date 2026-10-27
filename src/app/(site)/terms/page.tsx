import { LegalLayout, LegalSection } from '@/components/portal/LegalLayout';
import credits from '@/config/credits.json';

export const metadata = {
  title: 'Terms of Service',
  description: 'The terms that govern use of the Emirate08 broker platform.',
};

const TOC = [
  ['t1', '1. About these terms'],
  ['t2', '2. Eligibility & accounts'],
  ['t3', '3. Professional verification'],
  ['t4', '4. Listings & advertising permits'],
  ['t5', '5. Broker network'],
  ['t6', '6. Memberships & trials'],
  ['t7', '7. Acceptable use'],
  ['t8', '8. Liability'],
  ['t9', '9. Governing law'],
  ['credits', 'Photography & map credits'],
];

const SECTIONS = [
  [
    't1',
    '1. About these terms',
    'These Terms of Service govern access to and use of the Emirate08 platform, including the public website, the broker workspace, and related services. By creating an account you agree to these terms on behalf of yourself and, where applicable, the agency you represent.',
  ],
  [
    't2',
    '2. Eligibility & accounts',
    'Phase 1 accounts are available to licensed real estate brokers and registered real estate agencies operating in the United Arab Emirates. You are responsible for keeping your login details confidential and for all activity under your account. Information you provide must be accurate and kept up to date.',
  ],
  [
    't3',
    '3. Professional verification',
    'Emirate08 reviews professional credentials — such as a RERA Broker Registration Number (BRN), Office Registration Number (ORN), and trade licence — before an account may publish listings. Verification may be declined, suspended, or withdrawn where credentials are expired, inaccurate, or cannot be confirmed.',
  ],
  [
    't4',
    '4. Listings & advertising permits',
    'You may only list properties you are authorised to market. Each published listing must carry a valid advertising permit where required by the relevant authority, and listing information — including price, size, availability, and photographs — must be accurate and not misleading. Emirate08 may remove listings that do not meet these requirements.',
  ],
  [
    't5',
    '5. Broker network',
    'Network listings are shared between participating professionals to support cooperation. Selecting a network property does not create an agency relationship or entitlement to commission. Any co-brokerage arrangement must be agreed directly between the professionals involved and comply with applicable regulations.',
  ],
  [
    't6',
    '6. Memberships & trials',
    'Memberships include usage limits such as user seats, active listings, and selected-property slots. Plan pricing and final limits will be confirmed before paid billing begins. Trials provide time-limited access; you will be told before any paid period starts.',
  ],
  [
    't7',
    '7. Acceptable use',
    'You must not misuse the platform, including by scraping data, contacting network professionals for unrelated marketing, uploading unlawful content, or attempting to access accounts or systems without authorisation.',
  ],
  [
    't8',
    '8. Liability',
    'The platform is provided to support professional workflows. Emirate08 does not verify every property detail supplied by users and is not a party to transactions between brokers, clients, or property owners, except as required by law.',
  ],
  [
    't9',
    '9. Governing law',
    'These terms are intended to be governed by the laws of the Emirate of Dubai and the federal laws of the United Arab Emirates, subject to final legal review.',
  ],
];

export default function TermsPage() {
  return (
    <LegalLayout title="Terms of" emphasis="Service" toc={TOC} articleClassName="text-text">
      <div className="rounded-lg border border-warn/30 bg-warn-soft p-4 text-[13px] leading-[1.6] text-warn">
        <span className="font-semibold">Template notice.</span> This text is a structured placeholder prepared for the
        Phase 1 build. It must be reviewed and replaced by Emirate08&apos;s legal counsel before launch and is not legal
        advice.
      </div>
      {SECTIONS.map(([id, title, text]) => (
        <LegalSection key={id} id={id} title={title}>
          <p className="mt-2 text-muted">{text}</p>
        </LegalSection>
      ))}
      <LegalSection id="credits" title="Photography & map credits" className="border-t border-line pt-9">
        <p className="mt-2 text-muted">
          Photographs are illustrative and do not depict specific advertised properties. They are used under the
          licences shown, sourced from Wikimedia Commons, and were resized and converted to WebP. Map geometry &copy;{' '}
          <a className="link" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">
            OpenStreetMap contributors
          </a>
          , available under the Open Database Licence (ODbL). Icons by{' '}
          <a className="link" href="https://icons.getbootstrap.com/" target="_blank" rel="noopener">
            Bootstrap Icons
          </a>{' '}
          (MIT).
        </p>
        <div className="mt-5 overflow-x-auto rounded-lg border border-line bg-white">
          <table className="table min-w-[640px]">
            <thead>
              <tr>
                <th>Image</th>
                <th>Author</th>
                <th>Licence</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {credits.map((r) => (
                <tr key={r.file}>
                  <td className="font-semibold text-ink">
                    {r.subject}
                    <span className="block text-2xs font-normal text-muted">{r.file}</span>
                  </td>
                  <td>{r.artist}</td>
                  <td>
                    <a className="link" href={r.licenseUrl} rel="noopener" target="_blank">
                      {r.license}
                    </a>
                  </td>
                  <td>
                    <a className="link" href={r.source} rel="noopener" target="_blank">
                      Wikimedia Commons
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </LegalSection>
    </LegalLayout>
  );
}
