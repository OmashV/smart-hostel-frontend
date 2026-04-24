export default function StudentKpiCard({ title, value, subtitle }) {
  return (
    <article className="student-kpi-card">
      <div className="student-kpi-top">
        <p className="student-kpi-title">{title}</p>
        <span className="student-kpi-accent" aria-hidden />
      </div>
      <p className="student-kpi-value">{value}</p>
      {subtitle ? <p className="student-kpi-subtitle">{subtitle}</p> : null}
    </article>
  );
}
