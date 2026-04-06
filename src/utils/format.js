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