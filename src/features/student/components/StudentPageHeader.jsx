import { formatTimestamp } from "../utils/overviewHelpers";

export default function StudentPageHeader({
  title,
  description,
  roomId,
  lastUpdated,
  rightSlot,
  variant = "default",
  kicker = "Student Analytics"
}) {
  return (
    <header className={`student-page-header ${variant === "hero" ? "hero" : ""}`}>
      <div className="student-page-header-main">
        <p className="student-page-kicker">{kicker}</p>
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>

      {roomId || lastUpdated || rightSlot ? (
        <div className="student-page-header-meta">
          {roomId ? <p className="student-room-pill">Room {roomId}</p> : null}
          {lastUpdated ? (
            <p className="student-last-updated">Last updated: {formatTimestamp(lastUpdated)}</p>
          ) : null}
          {rightSlot}
        </div>
      ) : null}
    </header>
  );
}
