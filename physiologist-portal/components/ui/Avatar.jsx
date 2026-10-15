const SIZES = { sm: 'avatar-sm', md: 'avatar-md', lg: 'avatar-lg' };

export default function Avatar({ name, size = 'md' }) {
  const initial = (name || '?').trim().charAt(0).toUpperCase() || '?';
  return (
    <span className={`avatar ${SIZES[size] || SIZES.md}`} aria-hidden="true">
      {initial}
    </span>
  );
}
