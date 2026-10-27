import Link from 'next/link';
import { LegalLayout, LegalSection } from '@/components/portal/LegalLayout';

export const metadata = {
  title: 'Privacy Policy',
  description: 'How Emirate08 collects, uses and protects personal data under the UAE PDPL.',
};

const TOC = [
  ['p1', '1. Who we are'],
  ['p2', '2. Data we collect'],
  ['p3', '3. How we use data'],
  ['p4', '4. Legal basis & consent'],
  ['p5', '5. Sharing'],
  ['p6', '6. Retention & security'],
  ['p7', '7. Your rights'],
  ['p8', '8. This demo'],
];

const text = (id, title, body) => (
  <LegalSection id={id} title={title}>
    <p className="mt-2 text-muted">{body}</p>
  </LegalSection>
);

export default function PrivacyPage() {
  return (
    <LegalLayout title="Privacy" emphasis="Policy" toc={TOC}>
      <div className="rounded-lg border border-warn/30 bg-warn-soft p-4 text-[13px] leading-[1.6] text-warn">
        <span className="font-semibold">Template notice.</span> This policy outlines the intended approach under the UAE
        Federal Decree-Law No. 45 of 2021 on the Protection of Personal Data (PDPL). It must be completed and approved
        by Emirate08&apos;s legal counsel before launch.
      </div>
      {text(
        'p1',
        '1. Who we are',
        'Emirate08 operates a professional platform for licensed brokers and real estate agencies in the UAE. Contact details for the data controller and any appointed data protection officer will be published here before launch.',
      )}
      <LegalSection id="p2" title="2. Data we collect">
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-muted">
          <li>Account details: name, email address, UAE mobile number, and password (stored as a secure hash).</li>
          <li>Professional credentials: BRN, ORN, trade licence number, credential documents, and expiry dates.</li>
          <li>Listing content you create, including property details, photographs, and permit information.</li>
          <li>Workspace activity such as selected properties and private notes.</li>
          <li>Technical data needed to operate and secure the service.</li>
        </ul>
      </LegalSection>
      {text(
        'p3',
        '3. How we use data',
        'To create and secure your account, verify professional credentials, publish and manage listings, enable communication between participating brokers, administer memberships, and meet legal and regulatory obligations.',
      )}
      {text(
        'p4',
        '4. Legal basis & consent',
        'We process personal data with your consent — captured during registration — and where processing is necessary to provide the service you request or to comply with law. You may withdraw consent at any time, although some features will then be unavailable.',
      )}
      {text(
        'p5',
        '5. Sharing',
        'Your professional name, agency, and contact details are visible to other verified network members on listings you publish. We do not sell personal data. Service providers acting on our instructions are bound by confidentiality and data protection terms.',
      )}
      {text(
        'p6',
        '6. Retention & security',
        'Data is kept only as long as needed for the purposes above or as required by law, and protected with appropriate technical and organisational measures.',
      )}
      {text(
        'p7',
        '7. Your rights',
        'Subject to the PDPL, you may request access to, correction of, or deletion of your personal data, restrict or object to processing, and request a copy of your data in a portable format.',
      )}
      <LegalSection id="p8" title="8. This demo" className="rounded-lg border border-line bg-white p-5">
        <p className="mt-2 text-muted">
          Account and workspace data is stored in Supabase through the Emirate08 platform. Uploaded listing images are
          stored with their listing records; credential documents are not currently uploaded. You can export or
          erase demo data at any time from{' '}
          <Link className="link" href="/profile#security">
            Profile › Security &amp; Privacy
          </Link>
          .
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
