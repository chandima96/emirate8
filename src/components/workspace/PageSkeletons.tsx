/**
 * Page-shaped loading skeletons for the workspace and Control Room.
 * Each skeleton mirrors the layout of the page it stands in for, so content swaps in without a jump.
 * Pure markup (no hooks) — safe in Server Components, `loading.tsx` files and client components alike.
 */

type Children = { children?: React.ReactNode };

export function Bone({ className = '' }: { className?: string }) {
  // A caller-supplied background (e.g. bones on a dark panel) replaces the default tone.
  const tone = /(^|\s)bg-/.test(className) ? '' : 'bg-line/60 ';
  return <div className={`rounded ${tone}${className}`} />;
}

/** Accessible wrapper: one live status for screen readers, decorative bones hidden from them. */
function Frame({ label, className = '', children }: Children & { label: string; className?: string }) {
  return (
    <div className={className} role="status" aria-busy="true">
      <span className="sr-only">{label}</span>
      <div aria-hidden="true" className="motion-safe:animate-pulse">
        {children}
      </div>
    </div>
  );
}

/* ---------- Building blocks (also used inline while page data loads) ---------- */

function PageHeader({ eyebrow = false, actions = 0, subtitle = true }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0 flex-1 space-y-2">
        {eyebrow && <Bone className="h-3 w-28" />}
        <Bone className="h-8 w-72 max-w-full" />
        {subtitle && <Bone className="h-4 w-96 max-w-full" />}
      </div>
      {actions > 0 && (
        <div className="flex gap-2">
          {Array.from({ length: actions }, (_, i) => (
            <Bone key={i} className="h-10 w-32 rounded-lg" />
          ))}
        </div>
      )}
    </div>
  );
}

/** A KPI tile's value while it loads. Keeps the real label visible. */
export function KpiValueBone({ className = 'mt-3 h-9 w-14' }: { className?: string }) {
  return <div aria-hidden="true" className={`motion-safe:animate-pulse rounded bg-line/60 ${className}`} />;
}

function KpiTiles({ count, className }: { count: number; className: string }) {
  return (
    <div className={className}>
      {Array.from({ length: count }, (_, i) => (
        <div className="kpi" key={i}>
          <div className="flex items-center justify-between">
            <Bone className="h-3 w-24" />
            <Bone className="h-4 w-4" />
          </div>
          <Bone className="mt-3 h-8 w-14" />
          <Bone className="mt-2 h-3 w-28" />
        </div>
      ))}
    </div>
  );
}

function PropertyCardBone() {
  return (
    <div className="card overflow-hidden">
      <Bone className="aspect-[4/3] rounded-none" />
      <div className="space-y-3 p-4">
        <Bone className="h-5 w-1/2" />
        <Bone className="h-4 w-4/5" />
        <Bone className="h-4 w-2/3" />
        <Bone className="h-4 w-1/3" />
      </div>
    </div>
  );
}

/** Property cards for a grid that is still loading. Render inside the page's own grid. */
export function PropertyCardBones({ count = 3, label = 'Loading properties…' }: { count?: number; label?: string }) {
  return (
    <div className="contents" role="status" aria-busy="true">
      <span className="sr-only">{label}</span>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} aria-hidden="true" className="motion-safe:animate-pulse">
          <PropertyCardBone />
        </div>
      ))}
    </div>
  );
}

/** Person/claim rows (name, email, trailing badge or buttons) for a list that is still loading. */
export function RowBones({ count = 3, label = 'Loading…', actions = 1 }: { count?: number; label?: string; actions?: number }) {
  return (
    <div className="space-y-2" role="status" aria-busy="true">
      <span className="sr-only">{label}</span>
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          aria-hidden="true"
          className="flex items-center justify-between gap-3 rounded-lg border border-line bg-white p-3 motion-safe:animate-pulse"
        >
          <div className="min-w-0 flex-1 space-y-2">
            <Bone className="h-4 w-40 max-w-full" />
            <Bone className="h-3 w-56 max-w-full" />
          </div>
          <div className="flex gap-2">
            {Array.from({ length: actions }, (_, j) => (
              <Bone key={j} className="h-8 w-20 rounded-lg" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Developer tiles on the Developers Network page. Render inside its grid. */
export function DeveloperTileBones({ count = 8 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} aria-hidden="true" className="rounded-2xl border border-line bg-white p-4 shadow-sm motion-safe:animate-pulse">
          <div className="flex items-center gap-2">
            <Bone className="h-12 w-12 shrink-0 rounded-2xl" />
            <div className="min-w-0 flex-1 space-y-2">
              <Bone className="h-4 w-full" />
              <Bone className="h-3 w-2/3" />
            </div>
          </div>
          <Bone className="mt-4 h-8 w-full rounded-lg" />
        </div>
      ))}
    </>
  );
}

function TableCard({ rows = 5, title = true, thumb = true }) {
  return (
    <div className="card overflow-hidden">
      {title && (
        <div className="flex items-center justify-between border-b border-line px-4 py-3.5">
          <Bone className="h-4 w-28" />
          <Bone className="h-3 w-16" />
        </div>
      )}
      <div className="divide-y divide-line">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3">
            {thumb && <Bone className="h-10 w-14 shrink-0" />}
            <div className="min-w-0 flex-1 space-y-2">
              <Bone className="h-4 w-1/2" />
              <Bone className="h-3 w-1/3" />
            </div>
            <Bone className="hidden h-4 w-20 sm:block" />
            <Bone className="h-5 w-16 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

function SectionTitle({ link = true }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Bone className="h-6 w-44" />
      {link && <Bone className="h-3 w-16" />}
    </div>
  );
}

function FormCard({ fields = 4 }) {
  return (
    <div className="card space-y-5 p-5 sm:p-6">
      <div className="space-y-2">
        <Bone className="h-3 w-24" />
        <Bone className="h-6 w-56" />
        <Bone className="h-4 w-80 max-w-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: fields }, (_, i) => (
          <div key={i} className="space-y-2">
            <Bone className="h-3 w-24" />
            <Bone className="h-10 w-full rounded-lg" />
          </div>
        ))}
      </div>
      <Bone className="h-10 w-32 rounded-lg" />
    </div>
  );
}

/* ---------- Dashboards ---------- */

/** Broker /dashboard: status cards, KPIs, listings table + activity, opportunity cards. */
export function BrokerDashboardSkeleton() {
  return (
    <Frame label="Loading your dashboard…" className="mx-auto max-w-[1240px]">
      <PageHeader actions={2} />
      <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className={`card flex items-start gap-3.5 p-4 ${i === 2 ? 'md:col-span-2 xl:col-span-1' : ''}`}>
            <Bone className="h-9 w-9 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <Bone className="h-4 w-40" />
              <Bone className="h-3 w-full" />
            </div>
            <Bone className="h-7 w-12 rounded-lg" />
          </div>
        ))}
      </div>
      <KpiTiles count={4} className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4" />
      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <TableCard rows={5} />
        </div>
        <div className="card">
          <div className="flex items-center justify-between border-b border-line px-4 py-3.5">
            <Bone className="h-4 w-28" />
            <Bone className="h-5 w-20 rounded-full" />
          </div>
          <div className="divide-y divide-line">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="flex gap-3 px-4 py-3">
                <Bone className="h-7 w-7 shrink-0 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Bone className="h-3 w-full" />
                  <Bone className="h-3 w-16" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-6">
        <SectionTitle />
        <div className="mt-3 flex gap-2">
          <Bone className="h-8 w-24 rounded-lg" />
          <Bone className="h-8 w-28 rounded-lg" />
        </div>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => <PropertyCardBone key={i} />)}
        </div>
      </div>
    </Frame>
  );
}

/** /agency-dashboard: heading + team button, three KPIs, recent property cards. */
export function AgencyDashboardSkeleton() {
  return (
    <Frame label="Loading agency dashboard…" className="mx-auto max-w-[1240px] space-y-8">
      <div className="space-y-2">
        <Bone className="h-3 w-28" />
        <Bone className="h-8 w-72 max-w-full" />
        <Bone className="mt-4 h-10 w-44 rounded-lg" />
        <Bone className="h-4 w-80 max-w-full" />
      </div>
      <KpiTiles count={3} className="grid gap-3 sm:grid-cols-3" />
      <div>
        <SectionTitle link={false} />
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => <PropertyCardBone key={i} />)}
        </div>
      </div>
    </Frame>
  );
}

/** /agency-team: KPIs, invite form, broker search, roster. */
export function AgencyTeamSkeleton() {
  return (
    <Frame label="Loading team…" className="mx-auto max-w-[1240px] space-y-6">
      <PageHeader eyebrow actions={1} />
      <KpiTiles count={3} className="grid gap-3 sm:grid-cols-3" />
      <div className="card space-y-4 p-5 sm:p-6">
        <Bone className="h-3 w-24" />
        <Bone className="h-6 w-48" />
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_180px_auto]">
          <Bone className="h-10 rounded-lg" />
          <Bone className="h-10 rounded-lg" />
          <Bone className="h-10 rounded-lg" />
          <Bone className="h-10 w-28 rounded-lg" />
        </div>
      </div>
      <div className="card space-y-4 p-5 sm:p-6">
        <Bone className="h-3 w-24" />
        <Bone className="h-6 w-56" />
        <Bone className="h-10 max-w-xl rounded-lg" />
      </div>
      <div className="card p-5 sm:p-6">
        <Bone className="h-3 w-24" />
        <Bone className="mt-2 h-6 w-56" />
        <div className="mt-5 space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center justify-between gap-3 rounded-lg border border-line p-3">
              <div className="space-y-2">
                <Bone className="h-4 w-40" />
                <Bone className="h-3 w-56" />
              </div>
              <Bone className="h-5 w-16 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </Frame>
  );
}

/** /developer-dashboard: two KPIs, add-property card, recent properties, claim requests. */
export function DeveloperDashboardSkeleton() {
  return (
    <Frame label="Loading developer dashboard…" className="mx-auto max-w-[1240px] space-y-8">
      <PageHeader eyebrow actions={1} />
      <KpiTiles count={2} className="grid gap-3 sm:grid-cols-2" />
      <div className="card space-y-3 p-5 sm:p-6">
        <Bone className="h-3 w-32" />
        <Bone className="h-6 w-40" />
        <Bone className="h-4 w-full max-w-2xl" />
        <Bone className="mt-2 h-10 w-36 rounded-lg" />
      </div>
      <div>
        <SectionTitle />
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => <PropertyCardBone key={i} />)}
        </div>
      </div>
      <div>
        <SectionTitle link={false} />
        <div className="mt-4 space-y-3">
          {[0, 1].map((i) => (
            <div key={i} className="card flex items-center justify-between gap-3 p-4">
              <div className="space-y-2">
                <Bone className="h-4 w-40" />
                <Bone className="h-3 w-56" />
              </div>
              <div className="flex gap-2">
                <Bone className="h-8 w-20 rounded-lg" />
                <Bone className="h-8 w-20 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </Frame>
  );
}

/** /developer-network: developer tiles, then developer property cards. */
export function DeveloperNetworkSkeleton() {
  return (
    <Frame label="Loading developers network…" className="mx-auto max-w-[1100px]">
      <PageHeader eyebrow />
      <div className="card mt-6 p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-2">
            <Bone className="h-6 w-48" />
            <Bone className="h-4 w-80 max-w-full" />
          </div>
          <Bone className="h-5 w-24 rounded-full" />
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <DeveloperTileBones count={8} />
        </div>
      </div>
      <div className="mt-8">
        <div className="space-y-2">
          <Bone className="h-3 w-32" />
          <Bone className="h-6 w-48" />
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => <PropertyCardBone key={i} />)}
        </div>
      </div>
    </Frame>
  );
}

/** /control-room: top bar, title, section tabs, six stat cards, verification + operations panels. */
export function ControlRoomSkeleton() {
  return (
    <main className="min-h-screen bg-[#f5f6f2]" role="status" aria-busy="true">
      <span className="sr-only">Loading Control Room…</span>
      <div aria-hidden="true" className="motion-safe:animate-pulse">
        <div className="flex h-16 items-center justify-between border-b border-line bg-white px-5 sm:px-10">
          <Bone className="h-6 w-48" />
          <div className="flex items-center gap-4">
            <Bone className="hidden h-4 w-24 sm:block" />
            <Bone className="h-5 w-16 rounded-full" />
            <Bone className="h-8 w-24 rounded-lg" />
          </div>
        </div>
        <div className="mx-auto max-w-[1380px] px-5 py-8 sm:px-10 lg:py-12">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="space-y-3">
              <Bone className="h-3 w-36" />
              <Bone className="h-10 w-64" />
              <Bone className="h-4 w-80 max-w-full" />
            </div>
            <Bone className="h-6 w-32 rounded-full" />
          </div>
          <div className="mt-8 flex flex-wrap gap-2">
            {['w-28', 'w-32', 'w-28', 'w-48', 'w-28'].map((w, i) => (
              <Bone key={i} className={`h-10 rounded-lg ${w}`} />
            ))}
          </div>
          <ControlRoomOverviewBones animate={false} />
        </div>
      </div>
    </main>
  );
}

/** Overview stat cards + panels while Control Room dashboard data loads (user already known). */
export function ControlRoomOverviewBones({ animate = true }: { animate?: boolean }) {
  return (
    <div aria-hidden="true" className={animate ? 'motion-safe:animate-pulse' : ''}>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="rounded-xl border border-line bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <Bone className="h-4 w-32" />
              <Bone className="h-9 w-9 rounded-lg" />
            </div>
            <Bone className="mt-5 h-9 w-16" />
          </div>
        ))}
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1.15fr_.85fr]">
        <div className="rounded-xl border border-line bg-white p-6">
          <Bone className="h-3 w-32" />
          <Bone className="mt-2 h-6 w-48" />
          <div className="mt-8 flex items-center gap-8">
            <Bone className="h-36 w-36 shrink-0 rounded-full" />
            <div className="flex-1 space-y-3">
              <Bone className="h-4 w-40" />
              <Bone className="h-4 w-32" />
              <Bone className="h-8 w-44 rounded-lg" />
            </div>
          </div>
        </div>
        <div className="rounded-xl bg-ink-deep/90 p-6">
          <Bone className="h-3 w-24 bg-white/15" />
          <Bone className="mt-2 h-6 w-64 bg-white/15" />
          <div className="mt-6 space-y-3">
            <Bone className="h-11 w-full rounded-lg bg-white/10" />
            <Bone className="h-11 w-full rounded-lg bg-white/10" />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Other workspace pages ---------- */

export function ListingsSkeleton() {
  return (
    <Frame label="Loading listings…" className="mx-auto max-w-[1240px]">
      <PageHeader actions={1} />
      <KpiTiles count={4} className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4" />
      <div className="mt-6 flex flex-wrap gap-2">
        <Bone className="h-10 w-64 rounded-lg" />
        <Bone className="h-10 w-36 rounded-lg" />
        <Bone className="h-10 w-36 rounded-lg" />
      </div>
      <div className="mt-4">
        <TableCard rows={7} title={false} />
      </div>
    </Frame>
  );
}

export function NetworkSkeleton() {
  return (
    <Frame label="Loading network…" className="mx-auto max-w-[1240px]">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-2">
          <Bone className="h-8 w-56" />
          <Bone className="h-4 w-[460px] max-w-full" />
        </div>
        <Bone className="h-16 w-full max-w-[260px] rounded-lg" />
      </div>
      <div className="card mt-6 flex flex-wrap gap-2 p-3">
        <Bone className="h-10 min-w-[200px] flex-1 rounded-lg" />
        <Bone className="h-10 w-28 rounded-lg" />
        <Bone className="h-10 w-28 rounded-lg" />
      </div>
      <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => <PropertyCardBone key={i} />)}
      </div>
    </Frame>
  );
}

export function SelectedSkeleton() {
  return (
    <Frame label="Loading selected properties…" className="mx-auto max-w-[1100px]">
      <PageHeader actions={1} />
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="card space-y-3 p-4 sm:col-span-2">
          <Bone className="h-4 w-40" />
          <Bone className="h-2 w-full rounded-full" />
          <Bone className="h-3 w-56" />
        </div>
        <div className="card space-y-3 p-4">
          <Bone className="h-4 w-24" />
          <Bone className="h-8 w-14" />
        </div>
      </div>
      <div className="mt-6">
        <TableCard rows={4} title={false} />
      </div>
    </Frame>
  );
}

export function EnquiriesSkeleton() {
  return (
    <Frame label="Loading enquiries…" className="mx-auto max-w-[1100px]">
      <PageHeader actions={1} />
      <Bone className="mt-5 h-12 w-full rounded-lg" />
      <div className="mt-6 flex gap-4 border-b border-line pb-3">
        <Bone className="h-5 w-14" />
        <Bone className="h-5 w-14" />
        <Bone className="h-5 w-20" />
      </div>
      <div className="mt-5 grid gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="card p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2">
                <Bone className="h-5 w-40" />
                <Bone className="h-3 w-64 max-w-full" />
              </div>
              <Bone className="h-5 w-16 rounded-full" />
            </div>
            <Bone className="mt-4 h-3 w-56" />
            <div className="mt-3 space-y-2">
              <Bone className="h-4 w-full" />
              <Bone className="h-4 w-4/5" />
            </div>
            <div className="mt-4 flex gap-2">
              <Bone className="h-8 w-32 rounded-lg" />
              <Bone className="h-8 w-32 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </Frame>
  );
}

/** Listing detail and network property detail: gallery + facts + sticky sidebar. */
export function PropertyDetailSkeleton() {
  return (
    <Frame label="Loading property…" className="mx-auto max-w-[1240px]">
      <Bone className="h-4 w-40" />
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <Bone className="h-8 w-80 max-w-full" />
          <Bone className="h-4 w-56" />
        </div>
        <div className="flex gap-2">
          <Bone className="h-10 w-28 rounded-lg" />
          <Bone className="h-10 w-28 rounded-lg" />
        </div>
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          <Bone className="aspect-[16/9] w-full rounded-lg" />
          <div className="card mt-6 grid grid-cols-2 gap-4 p-4 sm:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="space-y-2">
                <Bone className="h-3 w-16" />
                <Bone className="h-5 w-20" />
              </div>
            ))}
          </div>
          <div className="mt-6 space-y-2">
            <Bone className="h-5 w-32" />
            <Bone className="h-4 w-full" />
            <Bone className="h-4 w-full" />
            <Bone className="h-4 w-2/3" />
          </div>
        </div>
        <div className="card h-fit space-y-3 p-5">
          <Bone className="h-6 w-32" />
          <Bone className="h-4 w-full" />
          <Bone className="h-4 w-3/4" />
          <Bone className="mt-2 h-10 w-full rounded-lg" />
          <Bone className="h-10 w-full rounded-lg" />
        </div>
      </div>
    </Frame>
  );
}

/** Listing editor and profile builder: step rail + form. */
export function EditorSkeleton({ label = 'Loading editor…' }: { label?: string }) {
  return (
    <Frame label={label} className="mx-auto max-w-[1240px]">
      <PageHeader actions={2} />
      <div className="mt-6 grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <div className="card hidden h-fit space-y-3 p-4 lg:block">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Bone className="h-6 w-6 shrink-0 rounded-full" />
              <Bone className="h-4 flex-1" />
            </div>
          ))}
        </div>
        <div className="space-y-6">
          <FormCard fields={6} />
          <FormCard fields={2} />
        </div>
      </div>
    </Frame>
  );
}

export function AccountSkeleton() {
  return (
    <Frame label="Loading account…" className="mx-auto max-w-[1100px]">
      <PageHeader />
      <div className="mt-6 flex gap-4 border-b border-line pb-3">
        {[0, 1, 2, 3].map((i) => <Bone key={i} className="h-5 w-24" />)}
      </div>
      <div className="mt-6 space-y-6">
        <FormCard fields={4} />
        <FormCard fields={2} />
      </div>
    </Frame>
  );
}

export function SubscriptionSkeleton() {
  return (
    <Frame label="Loading subscription…" className="mx-auto max-w-[1100px]">
      <PageHeader />
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="space-y-3 rounded-lg bg-ink/90 p-5 sm:p-6">
          <Bone className="h-3 w-24 bg-white/15" />
          <Bone className="h-8 w-32 bg-white/15" />
          <Bone className="h-4 w-full bg-white/15" />
          <Bone className="mt-4 h-10 w-full rounded-lg bg-white/15" />
        </div>
        <div className="card p-5 sm:p-6 lg:col-span-2">
          <Bone className="h-6 w-28" />
          <div className="mt-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="space-y-2">
                <Bone className="h-3 w-20" />
                <Bone className="h-6 w-16" />
                <Bone className="h-2 w-full rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-8">
        <Bone className="h-6 w-40" />
        <div className="mt-4">
          <TableCard rows={5} title={false} thumb={false} />
        </div>
      </div>
    </Frame>
  );
}

export function VerificationSkeleton() {
  return (
    <Frame label="Loading verification…" className="mx-auto max-w-3xl px-5 py-10">
      <PageHeader eyebrow />
      <div className="mt-6">
        <FormCard fields={4} />
      </div>
    </Frame>
  );
}

/** Pick the skeleton that matches the workspace page at `pathname` (used while the session loads). */
export function WorkspacePageSkeleton({ pathname, role }: { pathname: string; role?: string }) {
  if (pathname === '/dashboard') {
    if (role === 'agency') return <AgencyDashboardSkeleton />;
    if (role === 'developer') return <DeveloperDashboardSkeleton />;
    return <BrokerDashboardSkeleton />;
  }
  if (pathname === '/agency-dashboard') return <AgencyDashboardSkeleton />;
  if (pathname === '/agency-team') return <AgencyTeamSkeleton />;
  if (pathname === '/agency-verification') return <VerificationSkeleton />;
  if (pathname === '/developer-dashboard') return <DeveloperDashboardSkeleton />;
  if (pathname === '/developer-network') return <DeveloperNetworkSkeleton />;
  if (pathname === '/listings/new' || /^\/listings\/[^/]+\/edit$/.test(pathname)) return <EditorSkeleton label="Loading listing editor…" />;
  if (pathname.startsWith('/listings/') || pathname.startsWith('/network/')) return <PropertyDetailSkeleton />;
  if (pathname === '/listings') return <ListingsSkeleton />;
  if (pathname === '/network') return <NetworkSkeleton />;
  if (pathname.startsWith('/selected')) return <SelectedSkeleton />;
  if (pathname === '/enquiries') return <EnquiriesSkeleton />;
  if (pathname === '/profile') return <EditorSkeleton label="Loading profile…" />;
  if (pathname === '/account') return <AccountSkeleton />;
  if (pathname === '/subscription') return <SubscriptionSkeleton />;
  return <BrokerDashboardSkeleton />;
}
