import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { HelpContact } from '@/components/portal/HelpContact';

export const metadata = {
  title: 'Help Centre',
  description:
    'Answers to common questions about searching, saving, contacting agents and broker accounts on Emirate08.',
};

function Faq({ q, children }) {
  return (
    <details className="faq">
      <summary>
        {q}
        <Icon name="chevron-down" className="h-4 w-4 shrink-0" />
      </summary>
      <p className="pb-5 text-[14px] leading-[1.7] text-muted">{children}</p>
    </details>
  );
}

export default function HelpPage() {
  return (
    <>
      <section className="border-b border-line bg-white" aria-labelledby="help-h">
        <div className="wrap py-10 sm:py-14">
          <p className="eyebrow">Help centre</p>
          <h1 id="help-h" className="h1 mt-4">
            How can we <em className="f font-normal">help?</em>
          </h1>
          <div className="mt-7 flex flex-wrap gap-2">
            <a href="#buyers" className="btn btn-outline btn-sm">
              Buyers &amp; tenants
            </a>
            <a href="#professionals" className="btn btn-outline btn-sm">
              Brokers &amp; agencies
            </a>
            <a href="#contact" className="btn btn-outline btn-sm">
              Contact us
            </a>
          </div>
        </div>
      </section>
      <div className="wrap grid gap-12 py-12 sm:py-16 lg:grid-cols-[1fr_400px] lg:gap-16">
        <div className="min-w-0">
          <section id="buyers" className="scroll-mt-24" aria-labelledby="faq-b">
            <h2 id="faq-b" className="h3">
              Buyers &amp; tenants
            </h2>
            <div className="mt-4 divide-y divide-line border-y border-line">
              <Faq q="Are these listings real?">
                Not yet. Emirate08 is a working demo, and every property, broker and agency on it is sample data. Photos
                are illustrative.
              </Faq>
              <Faq q="How do I save a property?">
                Select the heart on any property card or detail page. Saved properties appear under{' '}
                <Link className="link" href="/saved">
                  Saved
                </Link>{' '}
                and are saved to your account.
              </Faq>
              <Faq q="What happens when I contact an agent?">
                Your enquiry is stored securely and listed under{' '}
                <Link className="link" href="/saved#enquiries">
                  Saved › Enquiries
                </Link>
                . No email or message leaves your device.
              </Faq>
              <Faq q="How do I check a broker is licensed?">
                Each profile shows a broker registration number (BRN) and agency. For a live transaction, verify these
                with the Dubai Land Department’s official services.
              </Faq>
            </div>
          </section>
          <section id="professionals" className="mt-12 scroll-mt-24" aria-labelledby="faq-p">
            <h2 id="faq-p" className="h3">
              Brokers &amp; agencies
            </h2>
            <div className="mt-4 divide-y divide-line border-y border-line">
              <Faq q="Which account type should I choose?">
                Individual brokers manage their own profile and listings. Brokerage teams and agencies add colleagues
                under one agency profile. Compare them on{' '}
                <Link className="link" href="/for-professionals#accounts">
                  For Professionals
                </Link>
                .
              </Faq>
              <Faq q="Can I try the workspace without registering?">
                Yes. Use the demo account shown on the{' '}
                <Link className="link" href="/login">
                  sign-in page
                </Link>{' '}
                to explore the dashboard, listings and network.
              </Faq>
              <Faq q="Where do public enquiries go?">
                Signed-in professionals see them under{' '}
                <Link className="link" href="/enquiries">
                  Enquiries
                </Link>{' '}
                in the workspace.
              </Faq>
            </div>
          </section>
          <section id="social" className="mt-12 scroll-mt-24" aria-labelledby="social-h">
            <h2 id="social-h" className="h4">
              Social channels
            </h2>
            <p className="mt-2 text-[14px] leading-[1.7] text-muted">
              Emirate08’s social accounts aren’t live yet. Until they are, the contact form is the best way to reach us.
            </p>
          </section>
        </div>
        <aside
          id="contact"
          className="scroll-mt-24 self-start rounded-lg border border-line bg-white p-6 sm:p-7"
          aria-labelledby="contact-h"
        >
          <h2 id="contact-h" className="h4">
            Contact us
          </h2>
          <p className="mt-1 text-[13px] text-muted">Demo form — nothing is sent.</p>
          <HelpContact />
        </aside>
      </div>
    </>
  );
}
