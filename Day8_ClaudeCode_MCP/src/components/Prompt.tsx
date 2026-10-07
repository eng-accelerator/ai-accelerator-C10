export function Prompt({ cmd, children }: { cmd: string; children?: React.ReactNode }) {
  return (
    <div className="prompt">
      <span className="host">council~/ask</span> <span className="dollar">$</span> <span className="cmd">{cmd}</span>
      {children ? <> {children}</> : null}
    </div>
  );
}
