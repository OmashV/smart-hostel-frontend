export default function StudentSectionCard({ title, description, children, action, className = "" }) {
  return (
    <section className={`student-section-card ${className}`.trim()}>
      <div className="student-section-head">
        <div>
          <h3>{title}</h3>
          {description ? <p>{description}</p> : null}
        </div>
        {action ? <div className="student-section-action">{action}</div> : null}
      </div>
      <div className="student-section-body">{children}</div>
    </section>
  );
}
