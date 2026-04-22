export default function StudentInsightCard({ message }) {
  return (
    <div className="student-insight-card">
      <p className="student-insight-label">
        <span aria-hidden>+</span>
        Quick Insight
      </p>
      <p className="student-insight-message">{message}</p>
    </div>
  );
}
