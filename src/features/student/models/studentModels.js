import { DEFAULT_STUDENT_FILTERS } from "../constants/studentConstants";

/**
 * @typedef {Object} StudentRoomStatus
 * @property {string} occupancy
 * @property {string} noiseStatus
 * @property {string} wasteStatus
 * @property {string} doorStatus
 * @property {number|string} currentAmp
 * @property {string|null} updatedAt
 */

/**
 * @typedef {Object} StudentAlert
 * @property {string} id
 * @property {string} type
 * @property {string} severity
 * @property {string} message
 * @property {string|null} timestamp
 * @property {string} status
 * @property {string|null} sourceReadingId
 */

/**
 * @typedef {Object} StudentEnergyPoint
 * @property {string|null} timestamp
 * @property {number} energyKwh
 * @property {number} wastedEnergyKwh
 */

/**
 * @typedef {Object} StudentNoisePoint
 * @property {string|null} timestamp
 * @property {number} soundPeak
 * @property {string} noiseStatus
 */

/**
 * @typedef {Object} StudentOverview
 * @property {string|null} roomId
 * @property {Object} latestReading
 * @property {Object} kpis
 * @property {StudentAlert[]} recentAlerts
 * @property {Array<{id:string,title:string,message:string,priority:string,category:string}>} recommendations
 * @property {StudentRoomStatus} roomStatus
 */

/**
 * @typedef {Object} StudentFilters
 * @property {string} roomId
 * @property {string} dateRange
 * @property {string} alertType
 * @property {string} severity
 * @property {string} viewMode
 */

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toStatus(value, fallback = "Unknown") {
  return value || fallback;
}

function buildAlertSeverity(noiseStatus, wasteStatus) {
  if (wasteStatus === "Critical" || noiseStatus === "Violation") {
    return "Critical";
  }
  if (wasteStatus === "Warning" || noiseStatus === "Warning") {
    return "Warning";
  }
  return "Info";
}

function buildAlertType(noiseStatus, wasteStatus) {
  if (noiseStatus === "Warning" || noiseStatus === "Violation") {
    return "noise";
  }
  if (wasteStatus === "Warning" || wasteStatus === "Critical") {
    return "energy";
  }
  return "general";
}

function buildAlertMessage(rawAlert) {
  const noiseText = rawAlert.noise_stat || rawAlert.noiseStatus ? `Noise ${rawAlert.noise_stat || rawAlert.noiseStatus}` : null;
  const wasteText = rawAlert.waste_stat || rawAlert.wasteStatus ? `Waste ${rawAlert.waste_stat || rawAlert.wasteStatus}` : null;
  const doorText = rawAlert.door_status || rawAlert.doorStatus ? `Door ${rawAlert.door_status || rawAlert.doorStatus}` : null;

  return [noiseText, wasteText, doorText].filter(Boolean).join(" | ") || "Room status update";
}

function normalizeRecommendation(item, index) {
  if (typeof item === "string") {
    return {
      id: `tip-${index}`,
      title: "Suggested Tip",
      message: item,
      priority: "low",
      category: "general"
    };
  }

  return {
    id: item?.id || `tip-${index}`,
    title: item?.title || "Suggested Tip",
    message: item?.message || "Keep monitoring your room analytics regularly.",
    priority: item?.priority || "low",
    category: item?.category || "general"
  };
}

/**
 * @param {Object} rawStatus
 * @returns {StudentRoomStatus}
 */
function normalizeRoomStatus(rawStatus = {}) {
  return {
    occupancy: toStatus(rawStatus.occupancy_stat || rawStatus.occupancy),
    noiseStatus: toStatus(rawStatus.noise_stat || rawStatus.noiseStatus, "Normal"),
    wasteStatus: toStatus(rawStatus.waste_stat || rawStatus.wasteStatus, "Normal"),
    doorStatus: toStatus(rawStatus.door_status || rawStatus.doorStatus),
    currentAmp: rawStatus.current_amp ?? rawStatus.currentAmp ?? "--",
    updatedAt: rawStatus.captured_at || rawStatus.updatedAt || null
  };
}

/**
 * @param {Object} rawAlert
 * @param {number} index
 * @returns {StudentAlert}
 */
function normalizeAlert(rawAlert, index) {
  const noiseStatus = rawAlert?.noise_stat || rawAlert?.noiseStatus || null;
  const wasteStatus = rawAlert?.waste_stat || rawAlert?.wasteStatus || null;
  const timestamp = rawAlert?.timestamp || rawAlert?.captured_at || null;
  const type = rawAlert?.type || buildAlertType(noiseStatus, wasteStatus);
  const severity = rawAlert?.severity || buildAlertSeverity(noiseStatus, wasteStatus);
  const message = rawAlert?.message || buildAlertMessage(rawAlert || {});

  return {
    id: rawAlert?.id || rawAlert?._id || `${timestamp || "alert"}-${index}`,
    type,
    severity,
    message,
    timestamp,
    status: rawAlert?.status || "open",
    sourceReadingId: rawAlert?.sourceReadingId || rawAlert?.source_reading_id || null,
    soundPeak: toNumber(rawAlert?.soundPeak ?? rawAlert?.sound_peak),
    noiseStatus: toStatus(noiseStatus, "Normal")
  };
}

/**
 * @param {Object} payload
 * @returns {StudentOverview}
 */
export function normalizeStudentOverviewResponse(payload = {}) {
  const roomStatus = normalizeRoomStatus(payload.latestReading || payload.current_status || {});
  const recommendationDefaults = [
    {
      id: "tip-energy-basics",
      title: "Reduce idle appliance usage",
      message: "Turn off unused devices when leaving your room.",
      priority: "medium",
      category: "energy"
    },
    {
      id: "tip-noise-basics",
      title: "Maintain low noise levels",
      message: "Keep media volume low during quiet hours.",
      priority: "medium",
      category: "noise"
    }
  ];
  const normalizedRecommendations = Array.isArray(payload.recommendations) && payload.recommendations.length
    ? payload.recommendations.map((item, index) => normalizeRecommendation(item, index))
    : recommendationDefaults;

  const recentAlerts = Array.isArray(payload.recentAlerts)
    ? payload.recentAlerts.map((item, index) => normalizeAlert(item, index))
    : [];

  const kpis = payload.kpis || {};
  const activeAlerts = toNumber(
    kpis.activeAlertsCount ??
      kpis.activeAlerts ??
      payload.active_alerts_count ??
      recentAlerts.length
  );
  const currentNoiseStatus = kpis.currentNoiseStatus || roomStatus.noiseStatus;

  return {
    roomId: payload.roomId || payload.room_id || null,
    latestReading: {
      occupancy: roomStatus.occupancy,
      noiseStatus: roomStatus.noiseStatus,
      wasteStatus: roomStatus.wasteStatus,
      doorStatus: roomStatus.doorStatus,
      updatedAt: roomStatus.updatedAt,
      timestamp: roomStatus.updatedAt,
      currentAmp: roomStatus.currentAmp,
      soundPeak: toNumber(payload.latestReading?.soundPeak ?? payload.sound_peak),
      intervalEnergyKwh: toNumber(payload.latestReading?.intervalEnergyKwh ?? payload.interval_energy_kwh),
      intervalWastedEnergyKwh: toNumber(
        payload.latestReading?.intervalWastedEnergyKwh ?? payload.interval_wasted_energy_kwh
      )
    },
    kpis: {
      todayEnergyKwh: toNumber(kpis.totalEnergyToday ?? payload.today_energy_kwh),
      todayWastedEnergyKwh: toNumber(kpis.wastedEnergyToday ?? payload.today_wasted_energy_kwh),
      currentNoiseStatus,
      activeAlerts
    },
    recentAlerts,
    recommendations: normalizedRecommendations,
    roomStatus
  };
}

/**
 * @param {Object} payload
 * @returns {{
 *   roomId: string|null,
 *   range: {from?: string, to?: string, range?: string|null}|null,
 *   groupBy: string,
 *   summary: {
 *     totalEnergy: number,
 *     totalWastedEnergy: number,
 *     averageDailyEnergy: number,
 *     peakUsageValue: number,
 *     peakUsageAt: string|null
 *   },
 *   points: StudentEnergyPoint[]
 * }}
 */
export function normalizeStudentEnergyHistoryResponse(payload = {}) {
  const source = Array.isArray(payload.points) ? payload.points : payload.history;
  const points = Array.isArray(source)
    ? source.map((item) => ({
        timestamp: item.timestamp || item.date || null,
        energyKwh: toNumber(item.energyKwh ?? item.total_energy_kwh),
        wastedEnergyKwh: toNumber(item.wastedEnergyKwh ?? item.wasted_energy_kwh)
      }))
    : [];

  const summary = payload.summary || {};

  return {
    roomId: payload.roomId || payload.room_id || null,
    range: payload.range || null,
    groupBy: payload.groupBy || "day",
    summary: {
      totalEnergy: toNumber(summary.totalEnergy),
      totalWastedEnergy: toNumber(summary.totalWastedEnergy),
      averageDailyEnergy: toNumber(summary.averageDailyEnergy),
      peakUsageValue: toNumber(summary.peakUsageValue),
      peakUsageAt: summary.peakUsageAt || null
    },
    points
  };
}

/**
 * @param {Object} payload
 * @returns {{
 *   roomId: string|null,
 *   range: {from?: string, to?: string, range?: string|null}|null,
 *   groupBy: string,
 *   summary: {
 *     averageNoisePeak: number,
 *     noisyIntervals: number,
 *     quietViolations: number,
 *     peakNoiseValue: number,
 *     peakNoiseAt: string|null
 *   },
 *   points: StudentNoisePoint[]
 * }}
 */
export function normalizeStudentNoiseHistoryResponse(payload = {}) {
  const source = Array.isArray(payload.points) ? payload.points : [];
  const points = source.map((item) => ({
    timestamp: item.timestamp || null,
    soundPeak: toNumber(item.soundPeak),
    noiseStatus: toStatus(item.noiseStatus, "Normal")
  }));

  const summary = payload.summary || {};

  return {
    roomId: payload.roomId || payload.room_id || null,
    range: payload.range || null,
    groupBy: payload.groupBy || "day",
    summary: {
      averageNoisePeak: toNumber(summary.averageNoisePeak),
      noisyIntervals: toNumber(summary.noisyIntervals),
      quietViolations: toNumber(summary.quietViolations),
      peakNoiseValue: toNumber(summary.peakNoiseValue),
      peakNoiseAt: summary.peakNoiseAt || null
    },
    points
  };
}

/**
 * @param {Object} payload
 * @returns {{ roomId: string|null, alerts: StudentAlert[] }}
 */
export function normalizeStudentAlertsResponse(payload = {}) {
  const source = Array.isArray(payload.items) ? payload.items : payload.alerts;
  const alerts = Array.isArray(source)
    ? source.map((alert, index) => normalizeAlert(alert, index))
    : [];

  return {
    roomId: payload.roomId || payload.room_id || null,
    filters: payload.filters || null,
    total: toNumber(payload.total ?? alerts.length),
    alerts
  };
}

/**
 * @param {Object} payload
 * @returns {{
 *   roomId: string|null,
 *   total: number,
 *   active: number,
 *   critical: number,
 *   warning: number,
 *   info: number,
 *   byType: Array<{type: string, count: number}>
 * }}
 */
export function normalizeStudentAlertsSummaryResponse(payload = {}) {
  const byTypeEntries =
    payload.byType && typeof payload.byType === "object" && !Array.isArray(payload.byType)
      ? Object.entries(payload.byType)
      : [];

  const byType = byTypeEntries
    .map(([type, count]) => ({
      type: String(type || "").toLowerCase(),
      count: toNumber(count)
    }))
    .filter((item) => item.type)
    .sort((left, right) => right.count - left.count);

  return {
    roomId: payload.roomId || payload.room_id || null,
    total: toNumber(payload.total),
    active: toNumber(payload.active),
    critical: toNumber(payload.critical),
    warning: toNumber(payload.warning),
    info: toNumber(payload.info),
    byType
  };
}

/**
 * @param {StudentAlert[]} alerts
 * @returns {StudentNoisePoint[]}
 */
export function mapAlertsToNoisePoints(alerts = []) {
  return alerts
    .filter((alert) => alert.type === "noise")
    .map((alert) => ({
      timestamp: alert.timestamp,
      soundPeak: toNumber(alert.soundPeak),
      noiseStatus: alert.noiseStatus || alert.severity
    }));
}

/**
 * @param {Partial<StudentFilters>} overrides
 * @returns {StudentFilters}
 */
export function createStudentFilters(overrides = {}) {
  return {
    ...DEFAULT_STUDENT_FILTERS,
    ...overrides
  };
}
