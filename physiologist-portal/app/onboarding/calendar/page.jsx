'use client';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { api, getToken, setUserName } from '../../../lib/api';
import logoImg from '../../../logo.png';

function CalendarOnboardingInner() {
  const router = useRouter();
  const params = useSearchParams();
  const justConnected = params.get('google') === 'connected';

  const [checking, setChecking] = useState(true);
  const [connected, setConnected] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
  const token = typeof window !== 'undefined' ? getToken() : null;
  const googleHref = token
    ? `${apiBase}/api/auth/google?token=${encodeURIComponent(token)}&returnTo=${encodeURIComponent('/onboarding/calendar')}`
    : '#';

  useEffect(() => {
    if (!getToken()) { router.replace('/login'); return; }
    api.get('/api/physiologist/profile')
      .then(d => {
        const u = d.user || d;
        setName(u.name || '');
        if (u.name) setUserName(u.name);
        const ok = !!(u.googleTokens && u.googleTokens.refreshToken);
        setConnected(ok || justConnected);
      })
      .catch(e => setError(e.message))
      .finally(() => setChecking(false));
  }, [router, justConnected]);

  const continueToSchedule = () => {
    router.push('/availability?onboarding=1');
  };

  return (
    <div className="flex flex-1 items-center justify-center min-h-screen py-12 px-6">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <img src={logoImg.src} alt="Active Mentor" className="h-12 w-auto" />
        </div>

        <div className="bg-white/[0.03] border border-white/8 rounded-2xl p-6 space-y-5">
          <div className="flex items-center gap-2 mb-2">
            {[1, 2].map(n => (
              <div key={n} className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                  n === 1 ? 'bg-[#DA7235]/20 border border-[#DA7235] text-[#DA7235]' : 'bg-white/5 border border-white/10 text-white/30'
                }`}>{n}</div>
                {n < 2 && <div className="h-px w-10 bg-white/10" />}
              </div>
            ))}
          </div>

          <div>
            <p className="text-white/40 text-xs uppercase tracking-wide mb-1">Step 1 of 2</p>
            <h1 className="text-xl font-bold text-white">
              {connected ? 'Calendar connected' : 'Connect Google Calendar'}
            </h1>
            <p className="text-white/45 text-sm mt-2 leading-relaxed">
              {connected
                ? `You’re set${name ? `, ${name.split(' ')[0]}` : ''}. Next, set the hours patients can book.`
                : 'Patients need a video link when they book. Connecting Google creates Meet links automatically for every appointment.'}
            </p>
          </div>

          {justConnected && connected ? (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-emerald-300 text-sm">
              Google Calendar linked successfully.
            </div>
          ) : null}

          {error ? <p className="text-red-400 text-sm">{error}</p> : null}

          {checking ? (
            <p className="text-white/40 text-sm">Checking connection…</p>
          ) : connected ? (
            <button
              type="button"
              onClick={continueToSchedule}
              className="w-full py-3 rounded-lg bg-[#DA7235] text-white font-semibold hover:bg-[#c5622a] transition-colors"
            >
              Continue to schedule →
            </button>
          ) : (
            <>
              <a
                href={googleHref}
                className="w-full py-3 rounded-lg bg-[#DA7235] text-white font-semibold hover:bg-[#c5622a] transition-colors flex items-center justify-center gap-2"
              >
                Connect with Google
              </a>
              <p className="text-white/30 text-xs text-center leading-relaxed">
                Without this, bookings still work but patients won’t get a Join meeting link.
              </p>
              <button
                type="button"
                onClick={continueToSchedule}
                className="w-full py-2.5 rounded-lg border border-white/10 text-white/50 hover:text-white hover:border-white/30 text-sm transition-colors"
              >
                Skip for now
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CalendarOnboardingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-white/40">Loading…</div>}>
      <CalendarOnboardingInner />
    </Suspense>
  );
}
