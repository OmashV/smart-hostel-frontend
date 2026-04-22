export function formatKwh(value) {
    return `${Number(value || 0).toFixed(2)} kWh`;
  }
  
  export function formatDate(value) {
    if (!value) return "-";
    return new Date(value).toLocaleString();
  }
  
  export function formatShortDate(value) {
    if (!value) return "-";
    return new Date(value).toLocaleDateString();
  }

  export function formatDuration(ms) {
  if (!ms || ms <= 0) return "0s";

  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes === 0) return `${seconds}s`;

  return `${minutes}m ${seconds}s`;
}