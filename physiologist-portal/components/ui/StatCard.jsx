'use client';
import { useEffect, useState } from 'react';

const TONES = {
  amber: { num: 'var(--amber-text)', tile: 'var(--amber-tint)', icon: 'var(--amber-text)' },
  copper: { num: 'var(--copper)', tile: 'var(--copper-tint)', icon: 'var(--copper-strong)' },
  rose: { num: 'var(--rose)', tile: 'var(--rose-tint)', icon: 'var(--rose)' },
  sage: { num: 'var(--sage)', tile: 'var(--sage-tint)', icon: 'var(--sage)' },
};

function useCountUp(target) {
  const next = Number(target) || 0;
  const [val, setVal] = useState(next);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    let raf = 0;
    const start = performance.now();
    const dur = 700;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - (1 - t) ** 3;
      setVal(Math.round(eased * next));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [next]);
  return val;
}

export default function StatCard({ label, value, sub, tone = 'copper', icon }) {
  const colors = TONES[tone] || TONES.copper;
  const display = useCountUp(value);
  return (
    <div className="stat-cell">
      <div className="stat-top">
        <span className="stat-tile" style={{ background: colors.tile, color: colors.icon }}>{icon}</span>
        <span className="stat-label">{label}</span>
      </div>
      <p className="stat-num" style={{ color: colors.num }}>{display}</p>
      {sub && <p className="stat-sub">{sub}</p>}
    </div>
  );
}
