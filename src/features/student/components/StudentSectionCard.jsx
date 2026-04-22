export default function StudentSectionCard({ title, description, children }) {
  return (
    <section className="student-section-card">
      <div className="student-section-head">
        <h3>{title}</h3>
        {description ? <p>{description}</p> : null}
      </div>
      <div className="student-section-body">{children}</div>
    </section>
  );
}

