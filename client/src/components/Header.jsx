// Simple page header shown on every page.
export default function Header() {
  return (
    <header className="header">
      <div className="container header-inner">
        <div className="header-brand">
          <span className="header-logo" aria-hidden="true">💊</span>
          <div>
            <h1 className="header-title">MediSync</h1>
            <p className="header-subtitle">
              Medication Dosage &amp; Interaction Scheduler
            </p>
          </div>
        </div>
      </div>
    </header>
  )
}
