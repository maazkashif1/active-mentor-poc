import { AlertIcon } from './Icons';

export default function ErrorState({ title = 'Something went wrong', message, tone = 'light' }) {
  return (
    <div className={`error-state ${tone === 'dark' ? 'on-dark' : ''}`} role="alert">
      <div className="error-icon">
        <AlertIcon />
      </div>
      <p className="empty-title">{title}</p>
      <p className="empty-copy">{message || 'Please try again in a moment.'}</p>
    </div>
  );
}
