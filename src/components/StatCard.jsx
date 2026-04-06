export default function StatCard({ title, value, subtitle }) {
    return (
      <div className="stat-card">
        <div className="stat-title">{title}</div>
        <div className="stat-value">{value}</div>
        {subtitle && <div className="stat-subtitle">{subtitle}</div>}
      </div>
    );
  }