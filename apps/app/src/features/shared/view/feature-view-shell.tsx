type FeatureViewShellProps = {
  title: string;
  description: string;
  status: string;
};

export function FeatureViewShell({ title, description, status }: FeatureViewShellProps) {
  return (
    <div className="page-grid">
      <section className="card">
        <h2>{title}</h2>
        <p className="muted">{description}</p>
      </section>

      <section className="card">
        <h3>Etat</h3>
        <p className="muted">{status}</p>
      </section>
    </div>
  );
}
