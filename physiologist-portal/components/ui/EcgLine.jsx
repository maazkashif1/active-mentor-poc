export default function EcgLine({ className = '' }) {
  return (
    <svg
      className={`ecg-line ${className}`}
      viewBox="0 0 360 48"
      fill="none"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        className="ecg-draw"
        d="M0 30 H78 L90 30 L102 12 L116 40 L130 30 H200 L214 30 L228 8 L246 42 L262 30 H360"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
