import { formatTimestamp } from "./overviewHelpers";

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatNoisePeak(value) {
  const numeric = toNumber(value);
  return `${numeric.toFixed(1)} peak`;
}

export function formatNoiseTick(value, groupBy) {
  if (!value) return "--";

  if (groupBy === "week" && /^\d{4}-W\d{2}$/.test(value)) {
    return value;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  if (groupBy === "hour") {
    return date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric" });
  }

  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function formatNoiseTooltipLabel(value, groupBy) {
  if (!value) return "--";
  if (groupBy === "week" && /^\d{4}-W\d{2}$/.test(value)) {
    return `Week ${value.split("-W")[1]}, ${value.split("-W")[0]}`;
  }
  return formatTimestamp(value);
}

export function getNoiseStatusLabel(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "violation" || normalized === "critical") return "Critical";
  if (normalized === "warning" || normalized === "elevated") return "Elevated";
  if (normalized === "normal") return "Normal";
  return "Unknown";
}

export function buildNoiseInterpretation({ summary, latestPoint, alertCount }) {
  const latestStatus = getNoiseStatusLabel(latestPoint?.noiseStatus);
  const quietViolations = toNumber(summary?.quietViolations);
  const noisyIntervals = toNumber(summary?.noisyIntervals);

  const notes = [];

  if (latestStatus === "Critical") {
    notes.push("Recent noise condition is critical and needs immediate attention.");
  } else if (latestStatus === "Elevated") {
    notes.push("Recent noise condition is elevated.");
  } else if (latestStatus === "Normal") {
    notes.push("Recent noise condition is normal.");
  } else {
    notes.push("Recent noise condition is unavailable.");
  }

  if (quietViolations > 0) {
    notes.push(`${quietViolations} quiet-hour violation events were detected in this period.`);
  } else {
    notes.push("No quiet-hour violations were detected in this period.");
  }

  if (noisyIntervals > 0) {
    notes.push(`${noisyIntervals} intervals were flagged as noisy.`);
  }

  if (alertCount > 0) {
    notes.push(`${alertCount} recent noise-related alerts are available for review.`);
  } else {
    notes.push("No recent noise-specific alerts were found.");
  }

  return notes.join(" ");
}

export function buildPeakPeriodSummary(points = [], groupBy) {
  if (!points.length) {
    return {
      topPoints: [],
      summaryText: "No peak-period pattern is available for the selected filters."
    };
  }

  const sorted = [...points]
    .sort((a, b) => toNumber(b.soundPeak) - toNumber(a.soundPeak))
    .slice(0, 6);

  const top = sorted[0];
  const topLabel = formatNoiseTick(top.timestamp, groupBy);

  const elevatedCount = sorted.filter((item) =>
    ["warning", "violation", "critical", "elevated"].includes(String(item.noiseStatus || "").toLowerCase())
  ).length;

  const summaryText =
    elevatedCount > 1
      ? `Highest noise occurred around ${topLabel}, and elevated peaks appeared across multiple intervals.`
      : `Highest noise occurred around ${topLabel}, with fewer repeated elevated periods.`;

  return {
    topPoints: sorted,
    summaryText
  };
}

