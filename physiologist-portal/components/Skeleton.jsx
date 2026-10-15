// Base shimmer block
export function Sk({ className = '' }) {
  return (
    <div
      className={`rounded bg-white/[0.06] ${className}`}
      style={{
        backgroundImage: 'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.05) 50%, rgba(255,255,255,0) 100%)',
        backgroundSize: '200% 100%',
        animation: 'skshimmer 1.6s ease-in-out infinite',
      }}
    />
  );
}

// ── Primitives ───────────────────────────────────────────────────────────────
export function SkLine({ w = 'w-full', h = 'h-3.5' }) {
  return <Sk className={`${w} ${h} rounded-md`} />;
}

export function SkCircle({ size = 'w-9 h-9' }) {
  return <Sk className={`${size} rounded-full flex-shrink-0`} />;
}

// ── Dashboard skeletons ──────────────────────────────────────────────────────
export function SkStatCard() {
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.03] p-5 flex flex-col gap-3">
      <SkLine w="w-24" h="h-2.5" />
      <SkLine w="w-14" h="h-8" />
      <SkLine w="w-20" h="h-2" />
    </div>
  );
}

export function SkChartBar() {
  const heights = ['h-8', 'h-12', 'h-5', 'h-16', 'h-10', 'h-14', 'h-7'];
  return (
    <div className="flex items-end gap-1.5 h-16">
      {heights.map((h, i) => (
        <Sk key={i} className={`flex-1 ${h} rounded`} />
      ))}
    </div>
  );
}

export function SkQueueRow() {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-white/5 last:border-0">
      <div className="flex items-center gap-3">
        <SkCircle size="w-7 h-7" />
        <div className="space-y-1.5">
          <SkLine w="w-28" h="h-3" />
          <SkLine w="w-20" h="h-2.5" />
        </div>
      </div>
      <Sk className="w-14 h-5 rounded-full" />
    </div>
  );
}

export function SkTableRow() {
  return (
    <tr>
      <td className="py-2.5 pr-4"><SkLine w="w-24" /></td>
      <td className="py-2.5 pr-4"><SkLine w="w-20" /></td>
      <td className="py-2.5 pr-4"><SkLine w="w-12" /></td>
      <td className="py-2.5 pr-4"><Sk className="w-20 h-5 rounded-full" /></td>
      <td className="py-2.5"><SkLine w="w-10" /></td>
    </tr>
  );
}

// ── Appointments skeleton ────────────────────────────────────────────────────
export function SkAppointmentCard() {
  return (
    <div className="flex items-center justify-between rounded-xl border border-white/8 bg-white/[0.03] px-5 py-4">
      <div className="flex items-center gap-4">
        <SkCircle />
        <div className="space-y-2">
          <SkLine w="w-32" h="h-3.5" />
          <SkLine w="w-48" h="h-2.5" />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Sk className="w-24 h-6 rounded-full" />
        <Sk className="w-4 h-4 rounded" />
      </div>
    </div>
  );
}

// ── Patients skeleton ────────────────────────────────────────────────────────
export function SkPatientRow() {
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.03] px-5 py-4 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <SkCircle size="w-10 h-10" />
        <div className="space-y-2">
          <SkLine w="w-36" h="h-3.5" />
          <SkLine w="w-44" h="h-2.5" />
        </div>
      </div>
      <div className="flex items-center gap-6">
        <div className="space-y-1 hidden sm:block">
          <SkLine w="w-8" h="h-5" />
          <SkLine w="w-14" h="h-2.5" />
        </div>
        <div className="space-y-1 hidden sm:block">
          <SkLine w="w-8" h="h-5" />
          <SkLine w="w-16" h="h-2.5" />
        </div>
        <Sk className="w-5 h-5 rounded" />
      </div>
    </div>
  );
}

// ── Profile skeleton ─────────────────────────────────────────────────────────
export function SkProfileHero() {
  return (
    <div className="flex items-center gap-5 mb-8">
      <SkCircle size="w-16 h-16" />
      <div className="space-y-2">
        <SkLine w="w-48" h="h-6" />
        <SkLine w="w-36" h="h-3" />
        <Sk className="mt-1 w-28 h-5 rounded-full" />
      </div>
    </div>
  );
}

export function SkSection({ lines = 2 }) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.02] p-5">
      <SkLine w="w-32" h="h-2.5" />
      <div className="mt-4 space-y-3">
        {Array.from({ length: lines }).map((_, i) => (
          <SkLine key={i} w={i % 2 === 0 ? 'w-full' : 'w-3/4'} />
        ))}
      </div>
    </div>
  );
}
