'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from '@/components/ui/Icon';

/** Reveal a field before focusing it from validation or a review edit link. */
export function focusListingField(id: string) {
  const field = document.getElementById(id);
  if (!field) return;
  let ancestor = field.parentElement;
  while (ancestor) {
    if (ancestor instanceof HTMLDetailsElement) ancestor.open = true;
    ancestor = ancestor.parentElement;
  }
  field.focus({ preventScroll: true });
  field.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
}

export function EditorSection({
  title,
  id,
  optional = false,
  defaultOpen = false,
  hasErrors = false,
  className = '',
  children,
}: {
  title: ReactNode;
  id: string;
  optional?: boolean;
  defaultOpen?: boolean;
  hasErrors?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const details = useRef<HTMLDetailsElement>(null);
  const [initialOpen] = useState(defaultOpen);
  useEffect(() => {
    if (hasErrors && details.current) details.current.open = true;
  }, [hasErrors]);

  if (!optional)
    return (
      <section aria-labelledby={id} className={className}>
        <h3 className="h4 mb-4" id={id}>
          {title}
        </h3>
        {children}
      </section>
    );
  return (
    <details ref={details} open={initialOpen || undefined} className={'group ' + className}>
      <summary
        className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-sm py-1 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink [&::-webkit-details-marker]:hidden"
        aria-labelledby={id}
      >
        <span className="flex flex-wrap items-baseline gap-2">
          <span className="h4" id={id}>
            {title}
          </span>
          <span className="text-2xs font-normal uppercase tracking-wide text-muted">Optional</span>
        </span>
        <Icon
          name="chevron-down"
          className="shrink-0 text-xs transition-transform group-open:rotate-180 motion-reduce:transition-none"
        />
      </summary>
      <div className="pt-4">{children}</div>
    </details>
  );
}
