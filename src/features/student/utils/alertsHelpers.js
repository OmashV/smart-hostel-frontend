import { toTitleCase } from "./overviewHelpers";

const ALERT_TYPE_LABELS = {
  noise: "Noise",
  energy: "Energy",
  security: "Security",
  occupancy: "Occupancy",
  general: "General"
};

const BASE_TYPE_OPTIONS = [
  { value: "all", label: "All Types" },
  { value: "noise", label: "Noise" },
  { value: "energy", label: "Energy" },
  { value: "security", label: "Security" },
  { value: "occupancy", label: "Occupancy" },
  { value: "general", label: "General" }
];

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatAlertTypeLabel(type) {
  const normalized = String(type || "").toLowerCase();
  return ALERT_TYPE_LABELS[normalized] || toTitleCase(type);
}

export function sortAlertsNewestFirst(alerts = []) {
  return [...alerts].sort((left, right) => {
    const leftTime = Date.parse(left?.timestamp || "") || 0;
    const rightTime = Date.parse(right?.timestamp || "") || 0;
    return rightTime - leftTime;
  });
}

export function buildAlertsSummaryFallback(alerts = []) {
  const byTypeMap = alerts.reduce((acc, item) => {
    const key = String(item?.type || "general").toLowerCase();
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const byType = Object.entries(byTypeMap)
    .map(([type, count]) => ({
      type,
      count
    }))
    .sort((a, b) => b.count - a.count);

  const critical = alerts.filter((item) => String(item?.severity || "").toLowerCase() === "critical").length;
  const warning = alerts.filter((item) => String(item?.severity || "").toLowerCase() === "warning").length;
  const info = alerts.filter((item) => String(item?.severity || "").toLowerCase() === "info").length;
  const active = alerts.filter(
    (item) => !["resolved", "closed"].includes(String(item?.status || "").toLowerCase())
  ).length;

  return {
    total: alerts.length,
    active,
    critical,
    warning,
    info,
    byType
  };
}

export function buildAlertTypeOptions(summaryByType = [], alerts = []) {
  const dynamicTypeSet = new Set();

  summaryByType.forEach((item) => {
    const value = String(item?.type || "").toLowerCase();
    if (value) dynamicTypeSet.add(value);
  });

  alerts.forEach((item) => {
    const value = String(item?.type || "").toLowerCase();
    if (value) dynamicTypeSet.add(value);
  });

  if (!dynamicTypeSet.size) {
    return BASE_TYPE_OPTIONS;
  }

  const staticValues = new Set(BASE_TYPE_OPTIONS.map((item) => item.value));
  const options = [...BASE_TYPE_OPTIONS];

  [...dynamicTypeSet]
    .filter((value) => !staticValues.has(value))
    .sort()
    .forEach((value) => {
      options.push({
        value,
        label: formatAlertTypeLabel(value)
      });
    });

  return options;
}

export function formatAlertPercentage(count, total) {
  const numerator = toNumber(count);
  const denominator = toNumber(total);
  if (!denominator) return "0%";
  return `${Math.round((numerator / denominator) * 100)}%`;
}

export function buildAlertPriorityGuidance(summary = {}, alerts = []) {
  const total = toNumber(summary.total);
  const critical = toNumber(summary.critical);
  const warning = toNumber(summary.warning);

  if (!total) {
    return {
      title: "No alert pressure right now",
      message: "No alerts match your current filters. Keep monitoring periodically."
    };
  }

  const topType = (summary.byType || [])[0]?.type || alerts[0]?.type || "general";
  const topTypeLabel = formatAlertTypeLabel(topType);

  if (critical > 0) {
    return {
      title: "Critical alerts need immediate attention",
      message: `${critical} critical alert(s) are active. Start with recent ${topTypeLabel.toLowerCase()} issues first.`
    };
  }

  if (warning > 0) {
    return {
      title: "Warning alerts should be addressed soon",
      message: `${warning} warning alert(s) are currently visible, mainly in ${topTypeLabel.toLowerCase()}-related events.`
    };
  }

  return {
    title: "Alert levels are currently low risk",
    message: "Recent alerts are informational. Continue following room best practices."
  };
}
