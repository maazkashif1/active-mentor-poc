'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clearToken, getUserName } from '../lib/api';
import logoImg from '../logo.png';

const links = [
  { href: '/dashboard',     label: 'Dashboard' },
  { href: '/appointments',  label: 'Appointments' },
  { href: '/patients',      label: 'Patients' },
  { href: '/availability',  label: 'Availability' },
];

function initials(name) {
  return (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

export default function Nav() {
  const path = usePathname();
  const name = getUserName();
  const isProfile = path.startsWith('/profile');

  return (
    <nav className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#111113] sticky top-0 z-50">
      <div className="flex items-center">
        <img src={logoImg.src} alt="Active Mentor" className="h-10 w-auto" />
      </div>

      <div className="flex items-center gap-1">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              path.startsWith(l.href)
                ? 'bg-white/10 text-white'
                : 'text-white/50 hover:text-white hover:bg-white/5'
            }`}
          >
            {l.label}
          </Link>
        ))}

        <div className="w-px h-4 bg-white/10 mx-2" />

        {/* Profile avatar */}
        <Link
          href="/profile"
          title={name || 'Profile'}
          className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ring-2 ${
            isProfile
              ? 'bg-[#DA7235] text-white ring-[#DA7235]'
              : 'bg-[#DA7235]/20 text-[#DA7235] ring-transparent hover:ring-[#DA7235]/40'
          }`}
        >
          {initials(name)}
        </Link>

        <button
          onClick={() => { clearToken(); window.location.href = '/login'; }}
          className="px-3 py-1.5 rounded-md text-sm text-white/40 hover:text-white hover:bg-white/5 transition-colors"
        >
          Log out
        </button>
      </div>
    </nav>
  );
}
