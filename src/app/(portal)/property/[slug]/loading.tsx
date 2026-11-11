export default function PropertyLoading() {
  return (
    <main className="wrap py-5 sm:py-6" role="status" aria-busy="true">
      <span className="sr-only">Loading property details…</span>
      <div className="animate-pulse">
        <div className="h-4 w-40 rounded bg-mist" />
        <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
          <div className="aspect-[16/10] rounded-lg bg-mist lg:aspect-[16/9]" />
          <div className="hidden gap-3 lg:grid">
            <div className="rounded-lg bg-mist" />
            <div className="rounded-lg bg-mist" />
          </div>
        </div>
        <div className="mt-6 space-y-3">
          <div className="h-7 w-2/3 rounded bg-mist" />
          <div className="h-5 w-1/3 rounded bg-mist" />
          <div className="h-4 w-1/2 rounded bg-mist" />
        </div>
        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-12">
          <div className="space-y-4">
            <div className="h-28 rounded-lg bg-mist" />
            <div className="h-36 rounded-lg bg-mist" />
          </div>
          <div className="hidden h-56 rounded-lg bg-mist lg:block" />
        </div>
      </div>
    </main>
  );
}
