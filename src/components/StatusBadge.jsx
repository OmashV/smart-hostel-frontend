export default function StatusBadge({ value }) {
    const cls =
      value === "Critical" || value === "Violation"
        ? "badge danger"
        : value === "Warning"
        ? "badge warning"
        : value === "Occupied"
        ? "badge info"
        : "badge ok";
  
    return <span className={cls}>{value}</span>;
  }