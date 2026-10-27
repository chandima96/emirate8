import { Icon } from '@/components/ui/Icon';

/** Dashed empty-state panel used in result grids (old market.js `empty()`). */
export function EmptyState({ title, text, icon = undefined, children = undefined }) {
  return (
    <div className="col-span-full rounded-lg border border-dashed border-line bg-white p-10 text-center">
      {icon && <Icon name={icon} className="mx-auto h-6 w-6 text-muted" />}
      <p className={'font-display text-[17px] font-semibold text-ink' + (icon ? ' mt-3' : '')}>{title}</p>
      <p className="mt-1 text-[13px] text-muted">{text}</p>
      {children}
    </div>
  );
}
