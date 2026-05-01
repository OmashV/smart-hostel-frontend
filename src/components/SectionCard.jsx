
export default function SectionCard({ title, children, fullWidth }) {
  return (
    <div className={`section-card ${fullWidth ? "full-width" : ""}`}>
      <h3>{title}</h3>
      {children}
    </div>
  );
}