export default function EmptyState({ icon, title, children, tone = 'light' }) {
  return (
    <div className={`empty-state ${tone === 'dark' ? 'on-dark' : ''}`}>
      {icon && <div className="empty-icon">{icon}</div>}
      <p className="empty-title">{title}</p>
      {children && <p className="empty-copy">{children}</p>}
    </div>
  );
}
