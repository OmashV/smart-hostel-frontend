export default function SectionCard({ title, children, action, className = "" }) {
    return (
      <section className={`section-card ${className}`.trim()}>
        <div className="section-head">
          <h2>{title}</h2>
          {action}
        </div>
        {children}
      </section>
    );
  }
