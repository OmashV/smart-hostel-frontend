export default function StudentErrorState({ message, onRetry }) {
  return (
    <div className="student-error-state">
      <p className="student-error-title">Unable to load this section</p>
      <p>{message || "Please try again in a moment."}</p>
      {onRetry ? (
        <button type="button" className="student-button" onClick={onRetry}>
          Retry
        </button>
      ) : null}
    </div>
  );
}

