/** Shared shell for the legal pages: title header, “On this page” sidebar and the article column. */
export function LegalLayout({ title, emphasis, toc, articleClassName = undefined, children }) {
  return (
    <div>
      <header className="border-b border-line bg-white">
        <div className="wrap py-12 lg:py-16">
          <p className="eyebrow">Legal</p>
          <h1 className="h2 mt-4 lg:text-[36px]">
            {title} <em className="f font-normal">{emphasis}</em>
          </h1>
          <p className="mt-3 text-[13px] text-muted">
            Draft for client and legal review · Last updated <span>{new Date().getFullYear()}</span>
          </p>
        </div>
      </header>
      <div className="wrap grid grid-cols-1 gap-10 py-12 lg:grid-cols-12 lg:py-16">
        <nav className="lg:col-span-3" aria-label="On this page">
          <div className="lg:sticky lg:top-24">
            <p className="text-2xs font-semibold tracking-[.12em] text-muted uppercase">On this page</p>
            <ol className="mt-4 space-y-2 text-[13px]">
              {toc.map(([id, label]) => (
                <li key={id}>
                  <a className="hover:underline" href={'#' + id}>
                    {label}
                  </a>
                </li>
              ))}
            </ol>
          </div>
        </nav>
        <article
          className={
            'max-w-[720px] min-w-0 space-y-9 text-[14px] leading-[1.75] lg:col-span-9 ' + (articleClassName || '')
          }
        >
          {children}
        </article>
      </div>
    </div>
  );
}

export function LegalSection({ id, title, className = undefined, children }) {
  return (
    <section id={id} className={className}>
      <h2 className="h4">{title}</h2>
      {children}
    </section>
  );
}
