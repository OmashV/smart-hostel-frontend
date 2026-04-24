import { formatKwh, formatTimestamp } from "./overviewHelpers";

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatEnergyTick(value, groupBy) {
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

export function formatEnergyTooltipLabel(value, groupBy) {
  if (!value) return "--";
  if (groupBy === "week" && /^\d{4}-W\d{2}$/.test(value)) {
    return `Week ${value.split("-W")[1]}, ${value.split("-W")[0]}`;
  }
  return formatTimestamp(value);
}

export function getWasteLevel(totalEnergy, wastedEnergy) {
  const total = toNumber(totalEnergy);
  const wasted = toNumber(wastedEnergy);
  const ratio = total > 0 ? wasted / total : 0;

  if (total <= 0) {
    return {
      label: "No usage data",
      tone: "neutral",
      message: "Waste level will be available once energy readings are recorded."
    };
  }

  if (ratio >= 0.3) {
    return {
      label: "High waste",
      tone: "critical",
      message: "A high share of energy is currently classified as wasted."
    };
  }

  if (ratio >= 0.15) {
    return {
      label: "Moderate waste",
      tone: "warning",
      message: "Wasted energy is noticeable and can be reduced with small behavior changes."
    };
  }

  return {
    label: "Low waste",
    tone: "good",
    message: "Most energy usage is within normal efficiency limits."
  };
}

export function buildEnergyInsights({ history, comparison, forecast }) {
  const summary = history?.summary || {};
  const totalEnergy = toNumber(summary.totalEnergy);
  const totalWasted = toNumber(summary.totalWastedEnergy);
  const wasteLevel = getWasteLevel(totalEnergy, totalWasted);

  const insights = [];
  insights.push(
    `Total usage in the selected window is ${formatKwh(totalEnergy)}, with ${formatKwh(totalWasted)} marked as waste (${wasteLevel.label.toLowerCase()}).`
  );

  if (comparison && Number.isFinite(Number(comparison.roomAverage)) && Number.isFinite(Number(comparison.hostelAverage))) {
    const roomAvg = toNumber(comparison.roomAverage);
    const hostelAvg = toNumber(comparison.hostelAverage);
    if (hostelAvg > 0) {
      if (roomAvg > hostelAvg) {
        insights.push("Your room average is above the hostel average in this period.");
      } else if (roomAvg < hostelAvg) {
        insights.push("Your room average is below the hostel average in this period.");
      } else {
        insights.push("Your room average is aligned with the hostel average.");
      }
    }
  }

  const historical = forecast?.historicalPoints || [];
  const projected = forecast?.forecastPoints || [];
  if (historical.length && projected.length) {
    const recentAvg =
      historical.slice(-3).reduce((sum, item) => sum + toNumber(item.energyKwh), 0) /
      Math.min(3, historical.length);
    const projectedAvg =
      projected.slice(0, 3).reduce((sum, item) => sum + toNumber(item.energyKwh), 0) /
      Math.min(3, projected.length);

    if (projectedAvg > recentAvg * 1.05) {
      insights.push("Short-term forecast suggests usage may increase slightly.");
    } else if (projectedAvg < recentAvg * 0.95) {
      insights.push("Short-term forecast suggests usage may decrease slightly.");
    } else {
      insights.push("Short-term forecast suggests relatively stable usage.");
    }
  }

  return insights;
}

export function buildForecastSummary(forecast) {
  const score = Number(forecast?.confidence?.score);
  const confidenceText = Number.isFinite(score) ? `${Math.round(score * 100)}% confidence` : "confidence unavailable";
  return `Estimated upcoming usage based on recent trends (${confidenceText}).`;
}

export function buildComparisonBars(comparison) {
  if (!comparison) return [];

  const bars = [
    { label: "Your Room", value: toNumber(comparison.roomAverage), key: "roomAverage" },
    comparison.peerAverage === null || comparison.peerAverage === undefined
      ? null
      : { label: "Peer Average", value: toNumber(comparison.peerAverage), key: "peerAverage" },
    { label: "Hostel Average", value: toNumber(comparison.hostelAverage), key: "hostelAverage" }
  ].filter(Boolean);

  return bars;
}
