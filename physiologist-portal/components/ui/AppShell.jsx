'use client';
import Sidebar from './Sidebar';

export default function AppShell({ children }) {
  return (
    <div className="app-shell">
      <div className="app-glow" aria-hidden="true" />
      <div className="shell-row">
        <Sidebar />
        <main className="shell-main">{children}</main>
      </div>
    </div>
  );
}
