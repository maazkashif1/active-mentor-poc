export default function GlassCard({ children, className = '', padded = true, ...rest }) {
  return (
    <div className={`glass-card lift ${padded ? 'padded' : ''} ${className}`} {...rest}>
      {children}
    </div>
  );
}
