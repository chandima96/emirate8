import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { filterQuery, type SearchFilters } from '@/lib/propertySearch';
import { cx } from '@/lib/utils';

/** Numbered pages around the current one, with gaps: 1 … 4 5 [6] 7 8 … 20. */
function pageList(page: number, pages: number) {
  const out: (number | '…')[] = [];
  for (let p = 1; p <= pages; p++) {
    if (p === 1 || p === pages || Math.abs(p - page) <= 2) out.push(p);
    else if (out[out.length - 1] !== '…') out.push('…');
  }
  return out;
}

/** Real `<a href>` pagination, so crawlers can reach every page of results. Used by server and client pages. */
export function Pagination({
  path,
  filters = {},
  page,
  pages,
  className = '',
}: {
  path: string;
  filters?: Partial<SearchFilters>;
  page: number;
  pages: number;
  className?: string;
}) {
  if (pages <= 1) return null;
  const href = (p: number) => path + filterQuery({ ...filters, page: p });
  return (
    <nav className={cx('flex flex-wrap items-center justify-center gap-1.5', className)} aria-label="Pages">
      {page > 1 && (
        <Link href={href(page - 1)} rel="prev" className="btn btn-ghost btn-sm">
          <Icon name="arrow-left" />
          Previous
        </Link>
      )}
      {pageList(page, pages).map((p, i) =>
        p === '…' ? (
          <span key={'gap' + i} className="px-1 text-muted" aria-hidden="true">
            …
          </span>
        ) : (
          <Link
            key={p}
            href={href(p)}
            aria-current={p === page ? 'page' : undefined}
            className={cx('btn btn-sm min-w-9', p === page ? 'btn-dark' : 'btn-outline')}
          >
            {p}
          </Link>
        ),
      )}
      {page < pages && (
        <Link href={href(page + 1)} rel="next" className="btn btn-ghost btn-sm">
          Next
          <Icon name="arrow-right" />
        </Link>
      )}
    </nav>
  );
}
