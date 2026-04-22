export default function StudentInsightCard({ message }) {
  return (
    <div className="student-insight-card">
      <p className="student-insight-label">Quick Insight</p>
      <p className="student-insight-message">{message}</p>
    </div>
  );
}

