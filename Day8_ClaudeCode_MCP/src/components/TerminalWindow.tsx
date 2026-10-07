export function TerminalWindow({
  status,
  onSettings,
  children,
}: {
  status: "running" | "idle";
  onSettings?: () => void;
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="scanlines" aria-hidden />
      <main className="window">
        <header className="titlebar">
          <div className="dots" aria-hidden>
            <span className="dot red" />
            <span className="dot amber" />
            <span className="dot green" />
          </div>
          <span className="path">
            <span className="hi">council</span>@local: <span className="hi">~/ask</span>
          </span>
          <nav>
            {onSettings && (
              <button className="navlink" data-testid="settings-link" onClick={onSettings}>
                ~/settings
              </button>
            )}
            <span className={`status ${status}`}>
              <span className="blip" aria-hidden />
              <span data-testid="status">{status}</span>
            </span>
          </nav>
        </header>
        <div className="session">{children}</div>
      </main>
    </>
  );
}
