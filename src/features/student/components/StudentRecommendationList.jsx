import StudentEmptyState from "./StudentEmptyState";
import StudentStatusBadge from "./StudentStatusBadge";

export default function StudentRecommendationList({ items = [], maxItems = 4 }) {
  if (!items.length) {
    return (
      <StudentEmptyState
        title="No immediate action needed"
        message="Your room looks stable right now. Keep monitoring your usage trends."
      />
    );
  }

  return (
    <div className="student-recommendation-list">
      {items.slice(0, maxItems).map((item) => (
        <article key={item.id} className="student-recommendation-item">
          <div className="student-recommendation-top">
            <strong>{item.title}</strong>
            <div className="student-preview-badges">
              <StudentStatusBadge value={item.priority} />
              <StudentStatusBadge value={item.category} />
            </div>
          </div>
          <p>{item.message}</p>
        </article>
      ))}
    </div>
  );
}

