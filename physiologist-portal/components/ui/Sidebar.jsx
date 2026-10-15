'use client';
import { useSyncExternalStore } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clearToken, getUserName } from '../../lib/api';
import logoImg from '../../logo.png';
import Avatar from './Avatar';
import EcgLine from './EcgLine';
import { CalendarIcon, ClockIcon, GridIcon, LogoutIcon, MessageIcon, UsersIcon } from './Icons';
import { disconnectSocket } from '../../lib/socket';

const LINKS = [
  { href: '/dashboard', label: 'Dashboard', icon: GridIcon },
  { href: '/appointments', label: 'Appointments', icon: CalendarIcon },
  { href: '/patients', label: 'Patients', icon: UsersIcon },
  { href: '/messages', label: 'Messages', icon: MessageIcon },
  { href: '/availability', label: 'Availability', icon: ClockIcon },
];

function subscribeName(onStoreChange) {
  window.addEventListener('storage', onStoreChange);
  return () => window.removeEventListener('storage', onStoreChange);
}

export default function Sidebar() {
  const path = usePathname();
  const name = useSyncExternalStore(subscribeName, getUserName, () => '');

  return (
    <aside className="sidebar">
      <Link href="/dashboard" aria-label="Active Mentor home">
        <Image src={logoImg} alt="Active Mentor" className="logo-img" priority />
      </Link>

      <nav className="side-nav" aria-label="Portal">
        {LINKS.map((link) => {
          const Icon = link.icon;
          const active = path === link.href || path.startsWith(`${link.href}/`);
          return (
            <Link
              key={link.href}
              href={link.href}
              className="side-link"
              aria-current={active ? 'page' : undefined}
            >
              <Icon />
              {link.label}
            </Link>
          );
        })}
      </nav>

      <div className="side-foot">
        <EcgLine className="sidebar-ecg" />
        <div className="side-profile">
          <Link href="/profile" className="side-profile-link" aria-current={path.startsWith('/profile') ? 'page' : undefined}>
            <Avatar name={name || 'Physiologist'} size="sm" />
            <span>
              <span className="side-name">{name || 'Physiologist'}</span>
              {name ? <span className="side-role">Physiologist</span> : null}
            </span>
          </Link>
          <button
            type="button"
            className="logout-btn"
            onClick={() => {
              disconnectSocket();
              clearToken();
              window.location.href = '/login';
            }}
          >
            <LogoutIcon size={16} />
            Log out
          </button>
        </div>
      </div>
    </aside>
  );
}
