import { cx } from '@/lib/utils';
import { Icon } from '@/components/ui/Icon';

const TONES = ['bg-sage text-ink', 'bg-ink text-white', 'bg-mist text-ink', 'bg-sage-soft text-ink'];

/** Photo or initials avatar for brokers and agencies (`square` for agency logos). */
export function Avatar({
  person = {},
  size = 48,
  square = false,
  className,
}: {
  person?: { photo?: string; tone?: number; initials?: string };
  size?: number;
  square?: boolean;
  className?: string;
}) {
  const style = { width: size, height: size, fontSize: Math.round(size * 0.36) };
  if (person.photo)
    return (
      <img
        src={person.photo}
        alt=""
        className={cx('avatar object-cover', square && 'rounded-lg', className)}
        style={style}
      />
    );
  return (
    <span
      className={cx('avatar', TONES[(person.tone || 0) % 4], square && 'rounded-lg', className)}
      style={style}
      aria-hidden="true"
    >
      {person.initials || ''}
    </span>
  );
}

/** Shown only when the record says the BRN has been verified — never fabricated. */
export function VerifiedBadge({ broker, label = 'BRN verified' }) {
  if (!broker?.brnVerified) return null;
  return (
    <span className="badge badge-ok">
      <Icon name="patch-check-fill" className="h-3 w-3" />
      {label}
    </span>
  );
}
