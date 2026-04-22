import { formatTimestamp } from "../utils/overviewHelpers";

export default function StudentPageHeader({ title, description, roomId, lastUpdated, rightSlot }) {
  return (
    <header className="student-page-header">
      <div>
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
