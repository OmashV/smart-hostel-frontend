export default function StudentLoadingState({ message = "Loading student data..." }) {
  return (
    <div className="student-loading-state">
      <div className="student-loading-dot" aria-hidden />
      <p>{message}</p>
    </div>
  );
}

