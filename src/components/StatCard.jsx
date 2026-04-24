export default function StatCard({
  title,
  value,
  subtitle,
  icon,
  tone = "blue"
}) {
  return (
    <div className="stat-card modern">
      <div className="stat-card-top">
        <div>
          <div className="stat-title">{title}</div>
          <div className="stat-value">{value}</div>
          {subtitle && <div className="stat-subtitle">{subtitle}</div>}
        </div>

        <div className={`stat-icon-box ${tone}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}