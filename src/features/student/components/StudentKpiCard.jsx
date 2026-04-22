export default function StudentKpiCard({ title, value, subtitle }) {
  return (
    <article className="student-kpi-card">
      <p className="student-kpi-title">{title}</p>
      <p className="student-kpi-value">{value}</p>
      {subtitle ? <p className="student-kpi-subtitle">{subtitle}</p> : null}
    </article>
  );
}

