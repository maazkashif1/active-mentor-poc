const VARIANTS = {
  pending: { label: 'Pending', className: 'pill-pending' },
  approved: { label: 'Approved', className: 'pill-approved' },
  summarised: { label: 'Awaiting Review', className: 'pill-review' },
  active: { label: 'Active', className: 'pill-active' },
  missed: { label: 'Missed', className: 'pill-missed' },
  free: { label: 'Free', className: 'pill-free' },
  booked: { label: 'Booked', className: 'pill-booked' },
};

export default function StatusPill({ status, label }) {
  const variant = VARIANTS[status] || { label: status || 'Unknown', className: 'pill-active' };
  return (
    <span className={`status-pill ${variant.className}`}>
      <span className="status-dot" aria-hidden="true" />
      {label || variant.label}
    </span>
  );
}
