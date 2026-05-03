import { useEffect, useMemo, useRef, useState } from "react";
import {
  HiOutlineBellAlert,
  HiOutlineExclamationTriangle,
  HiOutlineHomeModern,
  HiOutlineSpeakerWave,
  HiOutlineWrenchScrewdriver,
  HiOutlineEye,
  HiOutlineChartBar   // ✅ THIS IS REQUIRED
} from "react-icons/hi2";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import {
  getAvailableFloors,
  getAvailableRooms,
  getWardenRoomsStatus,
  getWardenSummary,
  getWardenFeatureImportance,
  getWardenAnomalies,
  getWardenPatterns,
  getWardenForecasts,
  getWardenHistory,
  getWardenMlAlerts,
  getWardenDataRange
} from "../api/client";
import StatCard from "../components/StatCard";
import SectionCard from "../components/SectionCard";
import StatusBadge from "../components/StatusBadge";
import DataTable from "../components/DataTable";
import LoadingState from "../components/LoadingState";
import EmptyState from "../components/EmptyState";
import { useChatbotContext } from "../context/ChatbotContext";
import { formatDate } from "../utils/format";

const ORDERED_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const chartTooltipStyle = {
  background: "#ffffff",
  border: "1px solid #dbe2ea",
  borderRadius: "12px",
  color: "#172033",
  boxShadow: "0 10px 24px rgba(15, 23, 42, 0.08)"
};

function valueOrDash(value) {
  return value === undefined || value === null || value === "" ? "-" : value;
}

function formatNumber(value, digits = 2) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number.toFixed(digits) : "0.00";
}

function renderFaults(faults = {}) {
  const active = Object.entries(faults)
    .filter(([, value]) => value)
    .map(([key]) => key.toUpperCase());

  return active.length ? active.join(", ") : "None";
}

function renderReasons(reasons = []) {
  return reasons?.length ? reasons.join(", ") : "-";
}

function getFloor(room = {}) {
  if (room.floor_id) return room.floor_id;
  const text = String(room.room_id || "").trim().toUpperCase();
  const digit = text.match(/(\d)/);
  return digit ? `Floor ${digit[1]}` : "Other";
}

function makeEmptyRoom(roomId) {
  return {
    room_id: roomId,
    occupancy_stat: "No Data",
    noise_stat: "No Data",
    waste_stat: "No Data",
    door_status: "No Data",
    current_amp: 0,
    sound_peak: 0,
    sensor_faults: {},
    needs_inspection: false,
    inspection_reasons: [],
    captured_at: null
  };
}

function statusTone(value = "") {
  const text = String(value || "").toLowerCase();
  if (text.includes("critical") || text.includes("violation") || text.includes("fault") || text.includes("abnormal") || text.includes("high")) return "danger";
  if (text.includes("warning") || text.includes("complaint") || text.includes("inspection") || text.includes("moderate")) return "warning";
  if (text.includes("normal") || text.includes("occupied") || text.includes("stable") || text.includes("valid")) return "ok";
  return "neutral";
}

function HistoryWord({ value }) {
  return <span className={`history-word ${statusTone(value)}`}>{value || "-"}</span>;
}

function roomCardTone(room = {}) {
  const combined = `${room.noise_stat || ""} ${room.waste_stat || ""} ${renderReasons(room.inspection_reasons || [])}`.toLowerCase();
  if (room.needs_inspection || combined.includes("critical") || combined.includes("violation") || combined.includes("fault")) return "critical";
  if (combined.includes("warning") || combined.includes("complaint")) return "warning";
  return "normal";
}

function WardenRoomTile({ room, onOpen }) {
  const tone = roomCardTone(room);
  return (
    <button type="button" className={`owner-room-tile ${tone} warden-room-tile warden-room-card-minimal`} title={`Open ${room.room_id} details`} onClick={() => onOpen(room)}>
      <div className="tile-top">
        <div>
          <h3>{valueOrDash(room.room_id)}</h3>
          <p className="tile-subtext">Live room status</p>
        </div>
        <span className={`tile-dot ${tone === "critical" ? "red" : tone === "warning" ? "orange" : "green"}`} />
      </div>

      <div className="warden-room-card-center">
        <StatusBadge value={friendlyOccupancy(room.occupancy_stat)} />
<strong>{friendlyNoise(room.noise_stat)}</strong>
<span>{formatNumber(room.sound_peak)} dB noise</span>
      </div>

      <div className="tile-metrics compact">
        <div className="tile-row">
  <span>Door</span>
  <strong>{friendlyDoor(room.door_status)}</strong>
</div>

<div className="tile-row">
  <span>Power Use</span>
  <strong>{formatNumber(room.current_amp, 2)} A</strong>
</div>
      </div>

      {room.needs_inspection ? 
  <div className="tile-alert-pill">Check this room</div> : 
  <div className="tile-ok-pill">Everything OK</div>}
    </button>
  );
}

function WardenAlertCard({ alert, onOpen }) {
  const severity = alert.severity || "Critical";
  const displayedAt =
    alert.display_at ||
    alert.generated_at ||
    alert.updatedAt ||
    alert.createdAt ||
    alert.captured_at;

  return (
    <button
      type="button"
      className={`warden-alert-button alert-card ${
        severity === "Critical" ? "critical" : "warning"
      }`}
      onClick={() => onOpen(alert)}
    >
      <div className="alert-card-head">
        <div className="alert-card-title">
          <HiOutlineExclamationTriangle size={18} />
          <strong>{friendlyAlertTitle(alert)}</strong>
        </div>
        <StatusBadge value={severity === "Critical" ? "Urgent" : "Check"} />
      </div>

      <p className="alert-card-message">
        {friendlyAlertReason(alert)}
      </p>

      <div className="alert-card-foot">
        <span>Room {valueOrDash(alert.room_id)}</span>
        <span>{displayedAt ? formatDate(displayedAt) : "No recent time"}</span>
      </div>

      <div className="alert-card-foot">
        <span>{friendlyConfidence(alert.confidence)}</span>
        <span>Click to see details</span>
      </div>
    </button>
  );
}

function KpiCardButton({ children, onClick, title }) {
  return <button type="button" className="warden-kpi-button" onClick={onClick} title={title}>{children}</button>;
}
function friendlyAlertTitle(alert = {}) {
  const reason = String(alert.reason || alert.message || "").toLowerCase();

  if (reason.includes("noise")) return "Noise problem detected";
  if (reason.includes("door")) return "Door needs attention";
  if (reason.includes("inspection")) return "Room needs checking";
  if (reason.includes("current") || reason.includes("energy") || reason.includes("power")) {
    return "Unusual power use";
  }

  return "Critical Alerts";
}

function friendlyAlertReason(alert = {}) {
  return alert.reason || alert.message || "Please check this room.";
}

function friendlyConfidence(value) {
  if (value === undefined || value === null) return "System detected";
  const percent = Math.round(Number(value || 0) * 100);

  if (percent >= 80) return "High confidence";
  if (percent >= 50) return "Medium confidence";
  return "Low confidence";
}
const renderForecastLegend = ({ payload = [] }) => (
  <div className="owner-legend-row">
    {payload.map((entry) => {
      const isPredicted = String(entry.value || "").toLowerCase().includes("predicted");
      return (
        <span key={entry.value} className="owner-legend-item">
          <span className={`legend-line ${isPredicted ? "predicted" : "actual"}`} style={{ borderColor: entry.color || "#2563eb" }} />
          <span className={`legend-label ${isPredicted ? "predicted" : "actual"}`}>{entry.value}</span>
        </span>
      );
    })}
  </div>
);

function toShortLabel(dateString) {
  if (!dateString) return "";
  const d = new Date(`${dateString}T00:00:00`);
  return d.toLocaleDateString("en-US", { month: "numeric", day: "numeric" });
}

function getLastNDates(days = 7, endDateString) {
  const dates = [];
  const endDate = endDateString ? new Date(`${endDateString}T00:00:00`) : new Date();
  const safeEndDate = Number.isNaN(endDate.getTime()) ? new Date() : endDate;
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(safeEndDate);
    d.setDate(safeEndDate.getDate() - i);
    dates.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
  }
  return dates;
}
function friendlySeverity(value = "") {
  const s = String(value).toLowerCase();
  if (s.includes("critical")) return "Urgent ⚠️";
  if (s.includes("warning")) return "Needs attention";
  return "Check";
}

function friendlyModel() {
  return "System detected issue";
}

function friendlyConfidenceText(value) {
  if (value === undefined || value === null) return "System detected this issue";
  const percent = Math.round(Number(value || 0) * 100);

  if (percent >= 80) return "High certainty";
  if (percent >= 50) return "Moderate certainty";
  return "Low certainty";
}
function fillSevenDays(history = [], selectedRoom = "All", selectedRoomData = null) {
  const rows = Array.isArray(history) ? history : [];
  const byDate = new Map(rows.map((item) => [item.date, item]));
  const latestDate = rows.map((item) => item.date).filter(Boolean).sort().pop();

  const latestOccupied =
    String(selectedRoomData?.occupancy_stat || "").toLowerCase() === "occupied";

  return getLastNDates(7, latestDate).map((date) => {
    const found = byDate.get(date);

    let occupied = Number(found?.occupied_count || 0);
    let empty = Number(found?.empty_count || 0);

    if (selectedRoom !== "All" && !found) {
      occupied = latestOccupied ? 1 : 0;
      empty = latestOccupied ? 0 : 1;
    }

    const warning =
      Number(found?.warning_count || 0) +
      Number(found?.avg_warnings || 0) +
      Number(found?.complaint_count || 0);

    const violation =
      Number(found?.violation_count || 0) +
      Number(found?.critical_count || 0);

    const criticalNoiseCount = warning + violation;
    const totalBase = selectedRoom === "All" ? occupied + empty : Math.max(occupied + empty, 1);

    return {
      date,
      label: toShortLabel(date),
      occupied_count: occupied,
      empty_count: empty,
      warning_count: warning,
      violation_count: violation,
      avg_sound_peak: Number(found?.avg_sound_peak || 0),
      avg_current: Number(found?.avg_current || 0),
      inspection_count: Number(found?.inspection_count || 0),
      critical_noise_count: criticalNoiseCount,
      normal_noise_count:
        criticalNoiseCount > 0 ? Math.max(totalBase - criticalNoiseCount, 0) : totalBase
    };
  });
}
function friendlyOccupancy(status = "") {
  const s = String(status).toLowerCase();
  if (s.includes("occupied")) return "Occupied";
  if (s.includes("empty")) return "Empty room";
  if (s.includes("sleeping")) return "Resident resting";
  return "No data";
}
function friendlyDayType(type = "") {
  return type === "Weekend" ? "Weekend (busy time)" : "Weekday (normal)";
}

function friendlyPattern(pattern = "") {
  const p = String(pattern).toLowerCase();

  if (p.includes("no data")) return "No data available";
  if (p.includes("high")) return "Usually busy";
  if (p.includes("low")) return "Usually calm";
  if (p.includes("moderate")) return "Moderate activity";

  return pattern || "Normal activity";
}

function friendlyNoiseLevel(value = 0) {
  const v = Number(value || 0);

  if (v >= 80) return "Very loud";
  if (v >= 60) return "Noisy";
  if (v >= 40) return "Normal";
  return "Quiet";
}

function friendlyRisk(value = 0) {
  const v = Number(value || 0);

  if (v >= 50) return "High risk ⚠️";
  if (v >= 20) return "Moderate risk";
  return "Low risk";
}
function friendlyNoise(status = "") {
  const s = String(status).toLowerCase();
  if (s.includes("violation")) return "Very loud ⚠️";
  if (s.includes("warning")) return "A bit noisy";
  if (s.includes("complaint")) return "Noise complaint";
  if (s.includes("normal")) return "Quiet";
  return "No data";
}

function friendlyDoor(status = "") {
  const s = String(status).toLowerCase();
  if (s.includes("open")) return "Door open";
  if (s.includes("closed")) return "Door closed";
  return "Unknown";
}
function friendlyYesNo(value) {
  return value ? "Yes" : "No";
}

function friendlyInspection(value) {
  return value ? "Needs checking ⚠️" : "All good";
}

function friendlyReason(reasons = []) {
  if (!reasons || !reasons.length) return "No issues detected";
  return reasons.join(", ");
}

function friendlyNoiseSentence(status = "", db = 0) {
  const s = String(status).toLowerCase();

  if (s.includes("violation")) return `Very loud (${db} dB)`;
  if (s.includes("warning")) return `Slightly noisy (${db} dB)`;
  if (s.includes("complaint")) return `Noise complaint (${db} dB)`;
  return `Quiet (${db} dB)`;
}
export default function WardenDashboard() {
  const { registerChatContext, clearChatContext } = useChatbotContext();
  const registerChatContextRef = useRef(registerChatContext);
  const clearChatContextRef = useRef(clearChatContext);
  const handleChatActionsRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [error, setError] = useState("");
  const [selectedFloor, setSelectedFloor] = useState("All");
  const [floorOptions, setFloorOptions] = useState(["All"]);
  const [roomOptions, setRoomOptions] = useState(["All"]);
  const [selectedRoomFilter, setSelectedRoomFilter] = useState("All");
  const [onlyAttention, setOnlyAttention] = useState(false);
  const [selectedKpi, setSelectedKpi] = useState(null);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [selectedRoomModal, setSelectedRoomModal] = useState(null);
  const [mlAlerts, setMlAlerts] = useState([]);
  const [wardenForecasts, setWardenForecasts] = useState([]);
  const [wardenAnomalies, setWardenAnomalies] = useState([]);
  const [wardenPatterns, setWardenPatterns] = useState([]);
  const [wardenFeatureImportance, setWardenFeatureImportance] = useState([]);
  const [wardenHistory, setWardenHistory] = useState([]);
  const [wardenDataRange, setWardenDataRange] = useState(null);
  const [lastRefreshAt, setLastRefreshAt] = useState(new Date());
  const [liveHistoryLog, setLiveHistoryLog] = useState([]);
  const selectedRoomFilterRef = useRef(selectedRoomFilter);

  useEffect(() => { selectedRoomFilterRef.current = selectedRoomFilter; }, [selectedRoomFilter]);

  useEffect(() => {
    registerChatContextRef.current = registerChatContext;
    clearChatContextRef.current = clearChatContext;
  }, [registerChatContext, clearChatContext]);

  useEffect(() => {
    handleChatActionsRef.current = (actions) => {
      actions.forEach((action) => {
        if (action.type === "switch_floor") {
          setSelectedFloor(action.value === "all" ? "All" : action.value);
          setSelectedRoomFilter("All");
        }

        if (action.type === "switch_room") {
          setSelectedRoomFilter(action.value === "all" ? "All" : action.value);
        }
      });
    };

    registerChatContextRef.current({
      role: "warden",
      dashboardState: {
        dashboard: "warden",
        floorId: selectedFloor,
        roomId: selectedRoomFilter,
        selectedFilters: {
          floorId: selectedFloor,
          roomId: selectedRoomFilter,
          onlyAttention
        },
        selectedVisual: null,
        dataRange: wardenDataRange
      },
      onAction: handleChatActionsRef.current
    });

    return () => {
      clearChatContextRef.current();
    };
  }, [onlyAttention, selectedFloor, selectedRoomFilter, wardenDataRange]);

  useEffect(() => {
    async function loadFilterOptions() {
      try {
        const floorRes = await getAvailableFloors();
        setFloorOptions(["All", ...(floorRes?.floors || [])]);
      } catch (_) {
        setFloorOptions(["All"]);
      }
    }
    loadFilterOptions();
  }, []);

  useEffect(() => {
    async function loadRoomsForFloor() {
      try {
        const roomRes = await getAvailableRooms(selectedFloor);
        const next = ["All", ...(roomRes?.rooms || [])];
        setRoomOptions(next);
        if (!next.includes(selectedRoomFilterRef.current)) setSelectedRoomFilter("All");
      } catch (_) {
        setRoomOptions(["All"]);
      }
    }
    loadRoomsForFloor();
  }, [selectedFloor]);

  async function fetchAllData() {
    try {
      setError("");
      const roomId = selectedRoomFilterRef.current;
      const safe = async (request, fallback) => {
        try {
          return await request();
        } catch (requestError) {
          console.error("Warden dashboard API failed:", requestError?.response?.config?.url || requestError?.message);
          return fallback;
        }
      };

      const [summaryRes, roomsRes, alertsRes, forecastRes, anomalyRes, patternRes, featureImportanceRes, historyRes, dataRangeRes] = await Promise.all([
        safe(() => getWardenSummary(roomId), null),
        safe(() => getWardenRoomsStatus(roomId), { rooms: [] }),
        safe(() => getWardenMlAlerts(roomId), { items: [] }),
        safe(() => getWardenForecasts(roomId), { items: [] }),
        safe(() => getWardenAnomalies(roomId), { items: [] }),
        safe(() => getWardenPatterns(roomId), { items: [] }),
        safe(() => getWardenFeatureImportance(), { items: [] }),
        safe(() => getWardenHistory(roomId), { items: [] }),
        safe(() => getWardenDataRange(roomId), null)
      ]);
      setSummary(summaryRes || null);
      setRooms(roomsRes?.rooms || []);
      setMlAlerts(alertsRes?.items || []);
      setWardenForecasts(forecastRes?.items || []);
      setWardenAnomalies(anomalyRes?.items || []);
      setWardenPatterns(patternRes?.items || []);
      setWardenFeatureImportance(featureImportanceRes?.items || []);
      setWardenHistory(historyRes?.items || historyRes?.history || []);
      setWardenDataRange(dataRangeRes || null);
      const refreshTime = new Date();
      setLastRefreshAt(refreshTime);

      const realHistoryRows = (historyRes?.room_level_items || [])
        .slice()
        .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))
        .map((item, index) => ({
          id: `${item.room_id || "room"}-${item.date || "date"}-${index}`,
          room_id: item.room_id || "-",
          date: item.date || "-",
          time: item.hour !== undefined && item.hour !== null ? `${String(item.hour).padStart(2, "0")}:00` : "-",
          occupied_count: Number(item.occupied_count || 0),
          warning_count: Number(item.warning_count || 0),
          violation_count: Number(item.violation_count || 0),
          avg_sound_peak: Number(item.avg_sound_peak || 0),
          source: item.source || "MongoDB history"
        }));

      setLiveHistoryLog(realHistoryRows.slice(0, 120));
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Failed to load warden dashboard data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAllData();
    const interval = setInterval(fetchAllData, 8000);
    return () => clearInterval(interval);
  }, [selectedRoomFilter]);

  const floors = useMemo(() => {
    const derived = Array.from(new Set(rooms.map((room) => getFloor(room)))).sort();
    return Array.from(new Set(["All", ...floorOptions, ...derived]));
  }, [rooms, floorOptions]);

  const dynamicRoomOptions = useMemo(() => {
    const derived = rooms
      .filter((room) => selectedFloor === "All" || getFloor(room) === selectedFloor)
      .map((room) => room.room_id)
      .sort();
    const merged = new Set(["All", ...roomOptions, ...derived]);
    return Array.from(merged).filter((roomId) => {
      if (roomId === "All") return true;
      const room = rooms.find((entry) => entry.room_id === roomId);
      return selectedFloor === "All" || !room || getFloor(room) === selectedFloor;
    });
  }, [rooms, roomOptions, selectedFloor]);

  const selectedRoomData = useMemo(() => {
    if (selectedRoomFilter === "All") return null;
    return rooms.find((room) => room.room_id === selectedRoomFilter) || makeEmptyRoom(selectedRoomFilter);
  }, [rooms, selectedRoomFilter]);

  const filteredRooms = useMemo(() => {
    return rooms.filter((room) => {
      const matchFloor = selectedFloor === "All" || getFloor(room) === selectedFloor;
      const matchRoom = onlyAttention || selectedRoomFilter === "All" || room.room_id === selectedRoomFilter;
      const matchAttention = !onlyAttention || room.needs_inspection;
      return matchFloor && matchRoom && matchAttention;
    });
  }, [rooms, selectedFloor, selectedRoomFilter, onlyAttention]);

  const activeAlerts = useMemo(() => (mlAlerts || []).map((alert) => ({
    ...alert,
    title: "Critical Alert",
    message: alert.reason || "ML-generated critical alert",
    severity: alert.severity || "Critical"
  })), [mlAlerts]);

  const roomSpecificAlerts = useMemo(() => {
    return selectedRoomFilter === "All" || onlyAttention ? activeAlerts : activeAlerts.filter((alert) => alert.room_id === selectedRoomFilter);
  }, [activeAlerts, selectedRoomFilter, onlyAttention]);

  const occupiedRows = useMemo(() => selectedRoomFilter === "All" ? rooms.filter((room) => room.occupancy_stat === "Occupied") : [selectedRoomData].filter((room) => room?.occupancy_stat === "Occupied"), [rooms, selectedRoomFilter, selectedRoomData]);
  const emptyRows = useMemo(() => selectedRoomFilter === "All" ? rooms.filter((room) => room.occupancy_stat === "Empty") : [selectedRoomData].filter((room) => room?.occupancy_stat === "Empty"), [rooms, selectedRoomFilter, selectedRoomData]);

  const cleaningPriorityRooms = useMemo(() => {
    const source = selectedRoomFilter === "All" || onlyAttention ? rooms : [selectedRoomData].filter(Boolean);
    return source.filter((room) => room.needs_inspection || String(room.occupancy_stat || "").toLowerCase() === "empty");
  }, [rooms, selectedRoomFilter, selectedRoomData, onlyAttention]);

  const sevenDayHistory = useMemo(
  () => fillSevenDays(wardenHistory, selectedRoomFilter, selectedRoomData),
  [wardenHistory, selectedRoomFilter, selectedRoomData]
);
  const occupancyTrend = useMemo(() => sevenDayHistory.map((item) => ({ date: item.date, label: item.label, occupied: item.occupied_count, empty: item.empty_count })), [sevenDayHistory]);
  const adjustedNoiseTrend = useMemo(() => sevenDayHistory.map((item) => ({ date: item.date, label: item.label, critical: item.critical_noise_count, normal: item.normal_noise_count })), [sevenDayHistory]);

  const patternRows = useMemo(() => {
    const map = new Map((wardenPatterns || []).map((item) => [item.day, item]));
    return ORDERED_DAYS.map((day) => map.get(day) || {
      day,
      day_type: ["Saturday", "Sunday"].includes(day) ? "Weekend" : "Weekday",
      usual_pattern: "No Data",
      avg_occupancy: 0,
      avg_noise_level: 0,
      avg_warnings: 0,
      avg_critical_ratio: 0,
      cluster_id: -1
    });
  }, [wardenPatterns]);

  const forecastChartData = useMemo(() => {
  const actualRows = (wardenHistory || [])
    .filter((item) => item?.date)
    .map((item) => ({
      date: item.date,
      actual_occupancy: Number(item.occupied_count || 0),
      actual_warnings: Number(item.warning_count || 0),
      predicted_occupancy: null,
      predicted_warnings: null
    }));

  const lastActual = actualRows[actualRows.length - 1];

  const bridgeRow = lastActual
    ? [{
        date: lastActual.date,
        actual_occupancy: lastActual.actual_occupancy,
        actual_warnings: lastActual.actual_warnings,
        predicted_occupancy: lastActual.actual_occupancy,
        predicted_warnings: lastActual.actual_warnings
      }]
    : [];

  const predictedRows = (wardenForecasts || [])
    .filter((item) => item?.date)
    .map((item) => ({
      date: item.date,
      actual_occupancy: null,
      actual_warnings: null,
      predicted_occupancy: Number(item.predicted_occupied_count || 0),
      predicted_warnings: Number(item.predicted_warning_count || 0)
    }));

  return [...actualRows, ...bridgeRow, ...predictedRows].sort((a, b) =>
    String(a.date).localeCompare(String(b.date))
  );
}, [wardenHistory, wardenForecasts]);


  const recentHistoryRows = useMemo(() => {
  return liveHistoryLog;
}, [liveHistoryLog]);
  const generatedInsights = useMemo(() => {
    const highestRiskPattern = [...patternRows].sort((a, b) => Number(b.avg_critical_ratio || 0) - Number(a.avg_critical_ratio || 0))[0];
    const nextForecast = (wardenForecasts || [])[0];
    const latestAnomaly = (wardenAnomalies || [])[0];
    const topFeature = (wardenFeatureImportance || [])[0];
    const inspectionRooms = rooms.filter((room) => room.needs_inspection);
    const inspectionReason = inspectionRooms.find((room) => room.inspection_reasons?.length)?.inspection_reasons?.[0];

    return [
      {
        title: "Inspection priority",
        value: `${inspectionRooms.length} room${inspectionRooms.length === 1 ? "" : "s"}`,
        detail: inspectionReason || "Priority is generated from current room status and ML alert/anomaly evidence."
      },
      {
        title: "Highest weekly risk pattern",
        value: highestRiskPattern ? `${highestRiskPattern.day} · ${highestRiskPattern.usual_pattern}` : "No pattern",
        detail: highestRiskPattern ? `KMeans cluster ${highestRiskPattern.cluster_id} with ${formatNumber(highestRiskPattern.avg_critical_ratio)}% critical ratio and ${formatNumber(highestRiskPattern.avg_noise_level)} average noise.` : "Run the Warden ML pipeline to generate weekly patterns."
      },
      {
        title: "Next forecast signal",
        value: nextForecast ? `${nextForecast.date}` : "No forecast",
        detail: nextForecast ? `Predicted occupancy ${formatNumber(nextForecast.predicted_occupied_count)}, predicted warnings ${formatNumber(nextForecast.predicted_warning_count)} using ${nextForecast.model_name || "forecast model"}.` : "Forecast data is generated from historical MongoDB summaries."
      },
      {
        title: "Latest anomaly insight",
        value: latestAnomaly ? `${latestAnomaly.room_id || selectedRoomFilter} · score ${formatNumber(latestAnomaly.anomaly_score, 3)}` : "No anomaly",
        detail: latestAnomaly?.reason || "IsolationForest did not return a current anomaly record for this selection."
      },
      {
        title: "Strongest ML driver",
        value: topFeature ? topFeature.feature : "No feature importance",
        detail: topFeature ? `Model importance ${formatNumber(topFeature.importance, 4)} from the Warden feature-importance output.` : "Feature importance appears after the ML pipeline is run."
      }
    ];
  }, [patternRows, wardenForecasts, wardenAnomalies, wardenFeatureImportance, rooms, selectedRoomFilter]);

  const isSingleRoom = selectedRoomFilter !== "All" && !onlyAttention;
  const displayedOccupied = selectedRoomFilter === "All" || onlyAttention ? summary?.occupied_rooms ?? 0 : selectedRoomData?.occupancy_stat === "Occupied" ? 1 : 0;
  const displayedEmpty = selectedRoomFilter === "All" || onlyAttention ? summary?.empty_rooms ?? 0 : selectedRoomData?.occupancy_stat === "Empty" ? 1 : 0;
  const displayedAlerts = roomSpecificAlerts.length;
  const displayedPriority = cleaningPriorityRooms.length;

  if (loading) return <LoadingState />;

  return (
    <div className="page-grid owner-dashboard">
      <div className="filter-bar warden-filter-bar">
        <label>Floor
          <select value={selectedFloor} onChange={(e) => { setSelectedFloor(e.target.value); setSelectedRoomFilter("All"); }}>
            {floors.map((floor) => <option key={floor} value={floor}>{floor}</option>)}
          </select>
        </label>
        <label>Room
          <select value={selectedRoomFilter} onChange={(e) => { setSelectedRoomFilter(e.target.value); setOnlyAttention(false); }}>
            {dynamicRoomOptions.map((roomId) => <option key={roomId} value={roomId}>{roomId}</option>)}
          </select>
        </label>
        <label>View
          <select value={onlyAttention ? "attention" : "all"} onChange={(e) => { const attention = e.target.value === "attention"; setOnlyAttention(attention); if (attention) setSelectedRoomFilter("All"); }}>
            <option value="all">All Rooms</option>
            <option value="attention">Need Rooms Inspection</option>
          </select>
        </label>
      </div>

      {error ? <div className="warden-error-box"><strong>Dashboard error:</strong> {error}<button className="warden-retry-btn" onClick={fetchAllData}>Retry</button></div> : null}


      <div className="stats-grid">
        <KpiCardButton onClick={() => setSelectedKpi("occupied")} title="Click to drill down occupied rooms"><StatCard title="Occupied Rooms" value={displayedOccupied} subtitle="Rooms currently in use" icon={<HiOutlineHomeModern />} tone="blue" /></KpiCardButton>
        <KpiCardButton onClick={() => setSelectedKpi("empty")} title="Click to drill down empty rooms"><StatCard title="Empty Rooms" value={displayedEmpty} subtitle="Rooms available for cleaning" icon={<HiOutlineHomeModern />} tone="green" /></KpiCardButton>
        <KpiCardButton onClick={() => setSelectedKpi("alerts")} title="Click to drill down critical alerts"><StatCard title="Critical Alerts" value={displayedAlerts} subtitle="Needs immediate attention" icon={<HiOutlineSpeakerWave />} tone="orange" /></KpiCardButton>
        <KpiCardButton onClick={() => setSelectedKpi("priority")} title="Click to drill down cleaning priority"><StatCard title="Cleaning Priority" value={displayedPriority} subtitle="Rooms to check first" icon={<HiOutlineWrenchScrewdriver />} tone="red" /></KpiCardButton>
      </div>

      <div className="owner-top-grid">
        <SectionCard title="Room Monitoring">
          {filteredRooms.length ? <div className="room-tile-grid">{filteredRooms.map((room) => <WardenRoomTile key={room.room_id} room={room} onOpen={setSelectedRoomModal} />)}</div> : <EmptyState text="No rooms match the selected filters." />}
        </SectionCard>
        <SectionCard title="Critical Alerts">
          {roomSpecificAlerts.length ? <div className="alerts-list">{roomSpecificAlerts.map((alert, index) => <WardenAlertCard key={`${alert.room_id}-${alert.captured_at}-${index}`} alert={alert} onOpen={setSelectedAlert} />)}</div> : <EmptyState text="No critical alerts right now." />}
        </SectionCard>
      </div>

      <div className="owner-top-grid">
        <SectionCard title="7-Day Occupancy Trend">
          {occupancyTrend.length ? <div className="chart-shell"><ResponsiveContainer width="100%" height={320}><BarChart data={occupancyTrend}><CartesianGrid strokeDasharray="3 3" stroke="#d9e1ec" /><XAxis dataKey="label" tick={{ fill: "#64748b", fontSize: 12 }} /><YAxis tick={{ fill: "#64748b", fontSize: 12 }} /><Tooltip contentStyle={chartTooltipStyle} /><Legend /><Bar dataKey="occupied" name="Occupied" fill="#2563eb" radius={[8, 8, 0, 0]} /><Bar dataKey="empty" name="Empty" fill="#16a34a" radius={[8, 8, 0, 0]} /></BarChart></ResponsiveContainer></div> : <EmptyState text="No occupancy trend data available." />}
        </SectionCard>
        <SectionCard title="7-Day Noise Trend">
          {adjustedNoiseTrend.length ? <div className="chart-shell"><ResponsiveContainer width="100%" height={320}><BarChart data={adjustedNoiseTrend}><CartesianGrid strokeDasharray="3 3" stroke="#d9e1ec" /><XAxis dataKey="label" tick={{ fill: "#64748b", fontSize: 12 }} /><YAxis tick={{ fill: "#64748b", fontSize: 12 }} /><Tooltip contentStyle={chartTooltipStyle} /><Legend /><Bar dataKey="normal" name="Normal" fill="#16a34a" radius={[8, 8, 0, 0]} /><Bar dataKey="critical" name="Critical" fill="#ef4444" radius={[8, 8, 0, 0]} /></BarChart></ResponsiveContainer></div> : <EmptyState text="No recent noise trend data available." />}
        </SectionCard>
      </div>

      {!isSingleRoom ? (
        <SectionCard title="Recent Live History">
          <div className="warden-live-history-head security-style-history-head">
            <div>
              <strong>Recent Live History</strong>
              <p>Latest warden activity for real-time monitoring.</p>
            </div>
            <span><span className="live-dot" /> Live · every 8s · {lastRefreshAt.toLocaleTimeString()}</span>
          </div>
          {recentHistoryRows.length ? (
            <DataTable
              columns={[
                { key: "room_id", label: "Room" },
                { key: "date", label: "Date" },
                { key: "time", label: "Time" },
                { key: "occupied_count", label: "Occupancy / Occupied" },
                { key: "warning_count", label: "Noise / Warnings", render: (row) => typeof row.warning_count === "string" ? <HistoryWord value={row.warning_count} /> : row.warning_count },
                { key: "violation_count", label: "Critical / Inspection" },
                { key: "avg_sound_peak", label: "Avg / Live Noise", render: (row) => `${formatNumber(row.avg_sound_peak)} dB` },
                { key: "source", label: "Source" }
              ]}
              rows={recentHistoryRows}
            />
          ) : <EmptyState text="No recent history available yet." />}
        </SectionCard>
      ) : null}

      <SectionCard title="Insight Generation">
        <div className="warden-insight-grid">
          {generatedInsights.map((insight, index) => (
            <div className="warden-insight-card" key={insight.title}>
              <div className="warden-insight-card-top">
                <span className="warden-insight-index">{index + 1}</span>
                <span>{insight.title}</span>
              </div>
              <strong>{insight.value}</strong>
              <p>{insight.detail}</p>
            </div>
          ))}
        </div>
      </SectionCard>

      {isSingleRoom ? <>
        <SectionCard title="Historical and Forecasted Room Trend">
          {forecastChartData.length ? <div className="chart-shell owner-forecast-chart-shell"><ResponsiveContainer width="100%" height={360}><LineChart data={forecastChartData} margin={{ top: 10, right: 24, left: 6, bottom: 8 }}><CartesianGrid strokeDasharray="3 3" stroke="#d9e1ec" /><XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 11 }} minTickGap={24} /><YAxis tick={{ fill: "#64748b", fontSize: 11 }} allowDecimals={false} /><Tooltip contentStyle={chartTooltipStyle} /><Legend content={renderForecastLegend} /><Line type="monotone" dataKey="actual_occupancy" name="Actual Occupancy" stroke="#2563eb" strokeWidth={2.4} dot={false} connectNulls /><Line type="monotone" dataKey="actual_warnings" name="Actual Warnings" stroke="#f59e0b" strokeWidth={2.2} dot={false} connectNulls /><Line type="monotone" dataKey="predicted_occupancy" name="Predicted Occupancy" stroke="#2563eb" strokeWidth={2.4} strokeDasharray="7 5" dot={false} connectNulls /><Line type="monotone" dataKey="predicted_warnings" name="Predicted Warnings" stroke="#f59e0b" strokeWidth={2.2} strokeDasharray="7 5" dot={false} connectNulls /></LineChart></ResponsiveContainer></div> : <EmptyState text="No forecast or history data available for this room." />}
        </SectionCard>

       <SectionCard title="Weekly Pattern Discovery">
  <DataTable
    columns={[
      {
        key: "day",
        label: "Day"
      },
      {
        key: "day_type",
        label: "Type",
        render: (row) => row.day_type || "-"
      },
      {
        key: "usual_pattern",
        label: "Usual Pattern",
        render: (row) => <HistoryWord value={row.usual_pattern} />
      },
      {
        key: "avg_occupancy",
        label: "Average Occupancy",
        render: (row) => formatNumber(row.avg_occupancy)
      },
      {
        key: "avg_noise_level",
        label: "Average Noise",
        render: (row) => `${formatNumber(row.avg_noise_level)} dB`
      },
      {
        key: "avg_warnings",
        label: "Average Warnings",
        render: (row) => formatNumber(row.avg_warnings)
      },
      {
        key: "avg_critical_ratio",
        label: "Attention Level",
        render: (row) => {
          const value = Number(row.avg_critical_ratio || 0);

          if (value >= 20) return "High attention needed";
          if (value >= 10) return "Moderate attention";
          return "Low attention";
        }
      }
    ]}
    rows={patternRows}
  />
</SectionCard>

        <SectionCard title="Abnormal / Anomaly Detection">
  {wardenAnomalies.length ? (
    <DataTable
      columns={[
        {
          key: "room_id",
          label: "Room"
        },
        {
          key: "date",
          label: "Date"
        },
        {
          key: "status",
          label: "Situation",
          render: (row) => <HistoryWord value={row.status || "Needs Attention"} />
        },
        {
          key: "anomaly_score",
          label: "Attention Level",
          render: (row) => {
            const score = Math.abs(Number(row.anomaly_score || 0));

            if (score >= 0.7) return "High attention needed";
            if (score >= 0.4) return "Moderate attention";
            return "Low attention";
          }
        },
        {
  key: "reason",
  label: "Reason",
  render: (row) => {
    const noise = Number(row.avg_sound_peak || 0);
    const current = Number(row.avg_current || 0);

    if (noise >= 100 && current > 1) {
      return "Very loud noise + high power use";
    }

    if (noise >= 80) {
      return "Very loud noise";
    }

    if (noise >= 60) {
      return "High noise";
    }

    if (current > 1) {
      return "High power use";
    }

    return "Unusual room activity";
  }
}
      ]}
      rows={wardenAnomalies.slice(0, 12)}
    />
  ) : (
    <EmptyState text="No unusual room activity found." />
  )}
</SectionCard>

        <div className="owner-top-grid">
          <SectionCard title="Inspection Evidence and Report Support" fullWidth>
            {filteredRooms.length ? <DataTable columns={[{ key: "room_id", label: "Room" }, { key: "captured_at", label: "Last Evidence", render: (row) => (row.captured_at ? formatDate(row.captured_at) : "No Data") }, { key: "sound_peak", label: "Noise Evidence", render: (row) => `${formatNumber(row.sound_peak)} dB` }, { key: "motion_count", label: "Motion" }, { key: "door_status", label: "Door", render: (row) => <StatusBadge value={row.door_status} /> }, { key: "inspection_reasons", label: "Warden Reason", render: (row) => renderReasons(row.inspection_reasons) }]} rows={filteredRooms.slice(0, 12)} /> : <EmptyState text="No evidence rows available for this room." />}
          </SectionCard>
          
        </div>

      </> : null}

     

      {selectedKpi ? <div className="warden-modal-overlay" onClick={() => setSelectedKpi(null)}><div className="warden-modal" onClick={(e) => e.stopPropagation()}><div className="warden-modal-head"><h3>{selectedKpi === "occupied" && "Occupied Rooms"}{selectedKpi === "empty" && "Empty Rooms"}{selectedKpi === "alerts" && "Critical Alerts"}{selectedKpi === "priority" && "Cleaning Priority"}</h3><button onClick={() => setSelectedKpi(null)}>Close</button></div>{selectedKpi === "occupied" ? <DataTable columns={[{ key: "room_id", label: "Room" }, { key: "occupancy_stat", label: "Occupancy", render: (row) => <StatusBadge value={row.occupancy_stat} /> }, { key: "noise_stat", label: "Noise", render: (row) => <HistoryWord value={row.noise_stat} /> }, { key: "captured_at", label: "Evidence Time", render: (row) => (row.captured_at ? formatDate(row.captured_at) : "No Data") }]} rows={occupiedRows} /> : null}{selectedKpi === "empty" ? <DataTable columns={[{ key: "room_id", label: "Room" }, { key: "occupancy_stat", label: "Occupancy", render: (row) => <StatusBadge value={row.occupancy_stat} /> }, { key: "door_status", label: "Door", render: (row) => <StatusBadge value={row.door_status} /> }, { key: "captured_at", label: "Evidence Time", render: (row) => (row.captured_at ? formatDate(row.captured_at) : "No Data") }]} rows={emptyRows.length ? emptyRows : [selectedRoomData].filter(Boolean)} /> : null}{selectedKpi === "alerts" ? roomSpecificAlerts.length ? <div className="alerts-list">{roomSpecificAlerts.map((alert, index) => <WardenAlertCard key={`${alert.room_id}-${alert.captured_at}-modal-${index}`} alert={alert} onOpen={setSelectedAlert} />)}</div> : <EmptyState text="No critical alerts right now." /> : null}{selectedKpi === "priority" ? cleaningPriorityRooms.length > 0 ? <DataTable columns={[{ key: "room_id", label: "Room" }, { key: "occupancy_stat", label: "Occupancy", render: (row) => <StatusBadge value={row.occupancy_stat} /> }, { key: "priority_type", label: "Priority Type", render: (row) => String(row.occupancy_stat || "").toLowerCase() === "empty" ? "Empty Room Cleaning" : "Inspection Required" }, { key: "inspection_reasons", label: "Reason", render: (row) => String(row.occupancy_stat || "").toLowerCase() === "empty" && !(row.inspection_reasons || []).length ? "Room is empty and ready for cleaning" : renderReasons(row.inspection_reasons) }]} rows={cleaningPriorityRooms} /> : <EmptyState text="No cleaning priority rooms." /> : null}</div></div> : null}

      {selectedRoomModal ? <div className="warden-modal-overlay" onClick={() => setSelectedRoomModal(null)}><div className="warden-modal warden-room-detail-modal" onClick={(e) => e.stopPropagation()}><div className="warden-modal-head"><h3>{selectedRoomModal.room_id} Room Drill-down</h3><button onClick={() => setSelectedRoomModal(null)}>Close</button></div><div className="warden-room-detail-grid"><div className="warden-single-room-card"><h4>Room Situation</h4>

<p><strong>Occupancy:</strong> {friendlyOccupancy(selectedRoomModal.occupancy_stat)}</p>

<p><strong>Noise Level:</strong> {friendlyNoiseSentence(
  selectedRoomModal.noise_stat,
  formatNumber(selectedRoomModal.sound_peak)
)}</p>

<p><strong>Door Status:</strong> {friendlyDoor(selectedRoomModal.door_status)}</p>

<p><strong>Electric Usage:</strong> {formatNumber(selectedRoomModal.current_amp, 2)} A</p>

<p><strong>Last Checked:</strong> {selectedRoomModal.captured_at ? formatDate(selectedRoomModal.captured_at) : "No recent data"}</p></div><div className="warden-single-room-card"><h4>Action Needed</h4>

<p><strong>Check Required:</strong> {friendlyInspection(selectedRoomModal.needs_inspection)}</p>

<p><strong>Reason:</strong> {friendlyReason(selectedRoomModal.inspection_reasons)}</p>

<p><strong>Movement Detected:</strong> {valueOrDash(selectedRoomModal.motion_count)} times</p>

</div></div></div></div> : null}

      {selectedAlert ? <div className="warden-modal-overlay" onClick={() => setSelectedAlert(null)}><div className="warden-modal" onClick={(e) => e.stopPropagation()}><div className="warden-modal-head"><h3>Critical Alert</h3><button onClick={() => setSelectedAlert(null)}>Close</button></div><div className="warden-single-room-grid"><div className="warden-single-room-card"><h4>Critical Alert Information</h4>

<p><strong>Room:</strong> {selectedAlert.room_id}</p>

<p><strong>Urgency:</strong> {friendlySeverity(selectedAlert.severity)}</p>

<p><strong>Issue:</strong> {friendlyAlertReason(selectedAlert)}</p>

<p><strong>System Note:</strong> {friendlyModel()}</p>


<p><strong>Time Detected:</strong>
  {(selectedAlert.display_at ||
    selectedAlert.generated_at ||
    selectedAlert.updatedAt ||
    selectedAlert.createdAt ||
    selectedAlert.captured_at)
      ? formatDate(
          selectedAlert.display_at ||
          selectedAlert.generated_at ||
          selectedAlert.updatedAt ||
          selectedAlert.createdAt ||
          selectedAlert.captured_at
        )
      : "No recent time"}
</p></div></div></div></div> : null}
    </div>
  );
}
