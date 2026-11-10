import Link from 'next/link';
import { Avatar, VerifiedBadge } from './Avatar';
import { Icon } from '@/components/ui/Icon';
import { brokerStats, brokerUrl } from '@/lib/store';
import { routes } from '@/lib/routes';

export function AgentCard({ broker: b }) {
  const st = brokerStats(b);
  const url = brokerUrl(b);
  return (
    <article className="acard flex gap-5 p-5 sm:p-6">
      <Avatar person={b} size={96} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-display text-[18px] font-semibold text-ink">
            <Link href={url} className="hover:underline">
              {b.name}
            </Link>
          </h3>
          <VerifiedBadge broker={b} />
        </div>
        <p className="mt-0.5 text-[13px] text-text">
          {b.title || ''} · {b.agencyName || 'Independent broker'}
        </p>
        <p className="mt-1 flex items-center gap-1.5 text-[13px] text-muted">
          <Icon name="geo-alt" className="h-3.5 w-3.5" />
          {(b.areas || []).join(' · ')}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-mist pt-3 text-[13px] text-muted">
          <span>
            <b className="font-semibold text-ink">{st.active}</b> active listing{st.active === 1 ? '' : 's'}
          </span>
          {b.experience && (
            <>
              <span className="text-line">|</span>
              <span>
                <b className="font-semibold text-ink">{b.experience}</b> yrs experience
              </span>
            </>
          )}
        </div>
        <Link href={url} className="tlink mt-3 inline-block text-[14px]">
          View portfolio
        </Link>
      </div>
    </article>
  );
}

export function AgencyCard({ agency: a }) {
  const url = routes.agency(a);
  return (
    <article className="acard flex gap-5 p-5 sm:p-6">
      <Avatar person={a} size={96} square />
      <div className="min-w-0 flex-1">
        <h3 className="font-display text-[18px] font-semibold text-ink">
          <Link href={url} className="hover:underline">
            {a.name}
          </Link>
        </h3>
        <p className="mt-1 flex items-center gap-1.5 text-[13px] text-muted">
          <Icon name="geo-alt" className="h-3.5 w-3.5" />
          {(a.areas || []).join(' · ') || a.location || 'United Arab Emirates'}
        </p>
        <p className="mt-3 border-t border-mist pt-3 text-[13px] text-muted">
          <b className="font-semibold text-ink">{a.brokers.length}</b> broker{a.brokers.length === 1 ? '' : 's'} on
          Emirate08
        </p>
        <Link href={url} className="tlink mt-3 inline-block text-[14px]">
          View agency
        </Link>
      </div>
    </article>
  );
}
