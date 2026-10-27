function Bone({ className = '' }) {
  return <div className={`rounded bg-line/60 ${className}`} />;
}

/** Place inside the same grid or carousel as the loaded cards. */
export function CardSkeletons({ count = 4, variant = 'property', className = '' }) {
  return (
    <div className="contents" role="status" aria-busy="true">
      <span className="sr-only">Loading cards…</span>
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          aria-hidden="true"
          className={`overflow-hidden rounded-lg border border-line bg-white motion-safe:animate-pulse ${className}`}
        >
          {variant === 'property' ? (
            <>
              <Bone className="aspect-[4/3] rounded-none" />
              <div className="space-y-3 p-4">
                <Bone className="h-6 w-2/3" />
                <Bone className="h-4 w-full" />
                <Bone className="h-4 w-3/4" />
                <Bone className="h-4 w-4/5" />
                <div className="mt-4 flex items-center gap-2 border-t border-mist pt-4">
                  <Bone className="h-7 w-7 rounded-full" />
                  <Bone className="h-3 w-1/2" />
                </div>
              </div>
            </>
          ) : (
            <div className="flex gap-5 p-5 sm:p-6">
              {variant === 'agent' && <Bone className="h-24 w-24 shrink-0 rounded-full" />}
              <div className="flex-1 space-y-3">
                <Bone className="h-5 w-2/3" />
                <Bone className="h-4 w-full" />
                <Bone className="h-4 w-3/4" />
                <Bone className="mt-5 h-4 w-1/2" />
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
