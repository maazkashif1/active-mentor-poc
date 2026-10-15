export default function PageHeader({ title, subtitle, children }) {
  return (
    <header className="page-header rise">
      <div>
        <h1 className="page-title">{title}</h1>
        {subtitle != null && subtitle !== '' && <p className="page-sub">{subtitle}</p>}
      </div>
      {children}
    </header>
  );
}
