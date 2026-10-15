function Sk({ className = '' }) {
  return <div className={`glass-sk ${className}`} />;
}

export function DashboardSkeleton() {
  return (
    <div className="stack">
      <div className="split">
        <Sk className="h-[250px] flex-1 rounded-[22px]" />
        <Sk className="h-[250px] flex-1 rounded-[20px]" />
      </div>
      <div className="split">
        <Sk className="h-56 flex-1 rounded-[20px]" />
        <Sk className="h-56 flex-1 rounded-[20px]" />
      </div>
      <div className="split">
        <Sk className="h-64 flex-1 rounded-[20px]" />
        <Sk className="h-64 flex-1 rounded-[20px]" />
      </div>
    </div>
  );
}

export function ListSkeleton({ rows = 5, tone = 'light' }) {
  const toneClass = tone === 'dark' ? 'on-dark' : '';
  return (
    <div className="mt-3 space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <Sk key={i} className={`h-14 w-full ${toneClass}`} />
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 4 }) {
  return (
    <div className="mt-4 space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <Sk key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}

export function CalendarSkeleton() {
  return (
    <div className="grid grid-cols-7 gap-1.5">
      {Array.from({ length: 35 }).map((_, i) => (
        <Sk key={i} className="h-20" />
      ))}
    </div>
  );
}

export function ProfileSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Sk className="h-16 w-16 rounded-full" />
        <div className="flex-1 space-y-2">
          <Sk className="h-5 w-40" />
          <Sk className="h-3 w-24" />
        </div>
      </div>
      <Sk className="h-20 w-full" />
      <Sk className="h-14 w-full" />
      <Sk className="h-14 w-full" />
    </div>
  );
}
