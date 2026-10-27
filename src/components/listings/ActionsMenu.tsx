'use client';

import Link from 'next/link';
import { Dropdown } from '@/components/ui/Dropdown';
import { Icon } from '@/components/ui/Icon';
import { isPublic, listingUrl } from '@/lib/store';
import { routes } from '@/lib/routes';
import { cx } from '@/lib/utils';

function MenuItem({ icon, label, danger = undefined, onClick }) {
  return (
    <button
      type="button"
      role="menuitem"
      className={cx(
        'flex h-9 w-full items-center gap-2 rounded px-2.5 text-[13px]',
        danger ? 'text-danger hover:bg-danger-soft' : 'hover:bg-mist',
      )}
      onClick={onClick}
    >
      <Icon name={icon} className="h-4 w-4" />
      {label}
    </button>
  );
}

function MenuLink({ href, icon, label }) {
  return (
    <Link role="menuitem" href={href} className="flex h-9 items-center gap-2 rounded px-2.5 text-[13px] hover:bg-mist">
      <Icon name={icon} className="h-4 w-4" />
      {label}
    </Link>
  );
}

/** "⋯" menu with every action available for a listing in its current status. */
export function ActionsMenu({ listing: l, actions, onDeleted = undefined }) {
  const s = l.status;
  const closed = s === 'sold' || s === 'rented';
  const rent = l.purpose === 'rent';
  const { changeStatus, toggleVisible, toggleFeatured, duplicate, remove } = actions;
  return (
    <Dropdown
      className="inline-block text-left"
      menuClassName="w-56"
      button={(props) => (
        <button
          type="button"
          className="btn btn-ghost btn-sm h-8 w-8 px-0"
          aria-label={'Actions for ' + (l.title || 'listing')}
          {...props}
        >
          <Icon name="three-dots" />
        </button>
      )}
    >
      <MenuLink href={routes.listing(l.id)} icon="card-text" label="Details" />
      <MenuLink href={routes.editListing(l.id)} icon="pencil-square" label="Edit" />
      {isPublic(l) ? (
        <MenuLink href={listingUrl(l)} icon="box-arrow-up-right" label="View public page" />
      ) : (
        <MenuLink href={routes.editListing(l.id, 8)} icon="eye" label="Preview" />
      )}
      {(s === 'draft' || s === 'unpublished' || s === 'archived') && (
        <MenuItem icon="send" label="Publish" onClick={() => changeStatus(l.id, 'published')} />
      )}
      {(s === 'published' || s === 'pending') && (
        <MenuItem icon="eye-slash" label="Unpublish" onClick={() => changeStatus(l.id, 'unpublished')} />
      )}
      {s === 'published' && (
        <MenuItem
          icon={l.display.portfolioFeatured ? 'star' : 'star-fill'}
          label={l.display.portfolioFeatured ? 'Unfeature on portfolio' : 'Feature on portfolio'}
          onClick={() => toggleFeatured(l.id)}
        />
      )}
      {(s === 'published' || s === 'unpublished') && (
        <MenuItem
          icon={rent ? 'key' : 'check-circle'}
          label={'Mark ' + (rent ? 'rented' : 'sold')}
          onClick={() => changeStatus(l.id, rent ? 'rented' : 'sold')}
        />
      )}
      {closed && (
        <MenuItem
          icon={l.display.visible === false ? 'eye' : 'eye-slash'}
          label={l.display.visible === false ? 'Show in portfolio history' : 'Hide from portfolio history'}
          onClick={() => toggleVisible(l.id)}
        />
      )}
      <MenuItem icon="copy" label="Duplicate as draft" onClick={() => duplicate(l.id)} />
      {s !== 'archived' && <MenuItem icon="archive" label="Archive" onClick={() => changeStatus(l.id, 'archived')} />}
      <div className="my-1 h-px bg-line" />
      <MenuItem
        icon="trash3"
        label="Delete"
        danger
        onClick={async () => {
          if ((await remove(l.id)) && onDeleted) onDeleted();
        }}
      />
    </Dropdown>
  );
}
