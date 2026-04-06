export default function EmptyState({ text = "No data available." }) {
    return <div className="empty-state">{text}</div>;
  }