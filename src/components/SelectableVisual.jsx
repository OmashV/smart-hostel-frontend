export default function SelectableVisual({
  isSelected,
  onSelect,
  className = "",
  children
}) {
  return (
    <div
      className={`selectable-visual ${isSelected ? "selected" : ""} ${className}`}
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.();
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.stopPropagation();
          onSelect?.();
        }
      }}
    >
      {children}
    </div>
  );
}