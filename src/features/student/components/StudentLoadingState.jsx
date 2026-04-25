export default function StudentLoadingState({ message = "Loading student data..." }) {
  return (
    <div className="student-loading-state">
      <div className="student-loading-orb" aria-hidden>
        <div className="student-loading-dot" />
      </div>
      <div>
        <p className="student-empty-title">Loading Dashboard</p>
        <p>{message}</p>
      </div>
    </div>
  );
}
