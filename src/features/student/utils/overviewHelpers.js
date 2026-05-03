function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatKwh(value) {
  const numeric = toNumber(value);
  return `${numeric.toFixed(2)} kWh`;
}

export function formatAmp(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "--";
  return `${numeric.toFixed(2)} A`;
}

export function formatTimestamp(value) {
  if (!value) return "--";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";

  return date.toLocaleString();
}

export function toTitleCase(value) {
  if (!value) return "--";
  const normalized = String(value)
    .replace(/[-_]/g, " ")
    .split(" ")
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1).toLowerCase() : part))
    .join(" ")
    .trim();

  return normalized || "--";
}

export function getStatusTone(value) {
  const normalized = String(value || "").toLowerCase();

  if (normalized.includes("critical") || normalized.includes("violation") || normalized.includes("high")) {
    return "critical";
  }
  if (normalized.includes("warning") || normalized.includes("elevated") || normalized.includes("medium")) {
    return "warning";
  }
  if (normalized.includes("normal") || normalized.includes("closed") || normalized.includes("occupied")) {
    return "good";
  }
  if (normalized.includes("low waste")) {
    return "good";
  }
  if (normalized.includes("low") || normalized.includes("sleeping") || normalized.includes("idle")) {
    return "info";
  }
  if (normalized === "open" || normalized.includes("active")) {
    return "warning";
  }
  return "neutral";
}

export function getSeverityTone(value) {
  const normalized = String(value || "").toLowerCase();
  if (normalized === "critical") return "critical";
  if (normalized === "warning") return "warning";
  if (normalized === "info") return "info";
  return "neutral";
}

export function buildOverviewInsight({ kpis, roomStatus, recentAlerts }) {
  const energy = toNumber(kpis?.todayEnergyKwh);
  const wasted = toNumber(kpis?.todayWastedEnergyKwh);
  const alertCount = toNumber(kpis?.activeAlerts);
  const noiseStatus = String(kpis?.currentNoiseStatus || roomStatus?.noiseStatus || "Unknown");

  const wastedRatio = energy > 0 ? wasted / energy : 0;
  const highSeverityCount = (recentAlerts || []).filter(
    (item) => item.severity === "Critical" || item.severity === "Warning"
  ).length;

  const notes = [];

  if (wastedRatio >= 0.3) {
    notes.push("Wasted energy is currently high compared with your usage.");
  } else if (energy > 0) {
    notes.push("Energy use today looks relatively stable.");
  } else {
    notes.push("No meaningful energy usage has been recorded yet today.");
  }

  if (noiseStatus.toLowerCase() === "violation" || noiseStatus.toLowerCase() === "critical") {
    notes.push("Noise condition is critical right now.");
  } else if (noiseStatus.toLowerCase() === "warning" || noiseStatus.toLowerCase() === "elevated") {
    notes.push("Noise level is elevated at the moment.");
  } else {
    notes.push("Current noise condition is normal.");
  }

  if (alertCount > 0) {
    notes.push(`You have ${alertCount} active alerts, including ${highSeverityCount} warning/critical items.`);
  } else {
    notes.push("No active alerts need attention right now.");
  }

  return notes.join(" ");
}
