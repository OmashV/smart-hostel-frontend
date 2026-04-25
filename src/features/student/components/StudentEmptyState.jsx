export default function StudentEmptyState({ title = "No data yet", message }) {
  return (
    <div className="student-empty-state">
      <p className="student-state-icon" aria-hidden>
        ○
      </p>
      <p className="student-empty-title">{title}</p>
      <p>{message || "Data will appear here once records are available."}</p>
    </div>
  );
}
