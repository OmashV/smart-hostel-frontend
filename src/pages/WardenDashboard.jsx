import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  HiOutlineBellAlert,
  HiOutlineExclamationTriangle,
  HiOutlineHomeModern,
  HiOutlineSpeakerWave,
  HiOutlineWrenchScrewdriver
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
import ChatAssistant from "../components/ChatAssistant";
import StatCard from "../components/StatCard";
import SectionCard from "../components/SectionCard";
import StatusBadge from "../components/StatusBadge";
import DataTable from "../components/DataTable";
import LoadingState from "../components/LoadingState";
import EmptyState from "../components/EmptyState";
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

function WardenRoomTile({ room, liveUpdatedAt }) {
  const tone = roomCardTone(room);
  return (
    <div className={`owner-room-tile ${tone} warden-room-tile`} title={`${room.room_id} current status`}>
      <div className="tile-top">
        <div>
          <h3>{valueOrDash(room.room_id)}</h3>
          <p className="tile-subtext">Owner-style room overview</p>
        </div>
        <span className={`tile-dot ${tone === "critical" ? "red" : tone === "warning" ? "orange" : "green"}`} />
      </div>

      {room.needs_inspection ? <div className="tile-alert-pill">Needs Inspection</div> : null}

      <div className="tile-metrics">
        <div className="tile-row"><span>Occupancy</span><strong>{valueOrDash(room.occupancy_stat)}</strong></div>
        <div className="tile-row"><span>Noise</span><strong>{valueOrDash(room.noise_stat)}</strong></div>
        <div className="tile-row"><span>Door</span><strong>{valueOrDash(room.door_status)}</strong></div>
        <div className="tile-row"><span>Current</span><strong>{Number(room.current_amp || 0)} A</strong></div>
      </div>

      <div className="tile-badges">
        <StatusBadge value={room.occupancy_stat || "Unknown"} />
        <StatusBadge value={room.noise_stat || "Unknown"} />
        <StatusBadge value={room.door_status || "Unknown"} />
      </div>

      <div className="tile-footer">Live Updated <span>{liveUpdatedAt ? liveUpdatedAt.toLocaleTimeString() : "No Data"}</span></div>
      <div className="tile-source-note">Evidence time: {room.captured_at ? formatDate(room.captured_at) : "No Data"}</div>
    </div>
  );
}

function WardenAlertCard({ alert, onOpen }) {
  const severity = alert.severity || "Critical";
  return (
    <button type="button" className={`warden-alert-button alert-card ${severity === "Critical" ? "critical" : "warning"}`} onClick={() => onOpen(alert)}>
      <div className="alert-card-head">
        <div className="alert-card-title">
          <HiOutlineExclamationTriangle size={18} />
          <strong>Critical Alert</strong>
        </div>
        <StatusBadge value={severity} />
      </div>
      <p className="alert-card-message">{alert.reason || alert.message || "ML-generated critical alert"}</p>
      <div className="alert-card-foot"><span>{valueOrDash(alert.room_id)}</span><span>{alert.captured_at ? formatDate(alert.captured_at) : "No Data"}</span></div>
      <div className="alert-card-foot"><span>{alert.model_name || "IsolationForest"}</span><span>{alert.confidence !== undefined ? `${Math.round(Number(alert.confidence || 0) * 100)}% confidence` : "ML confidence"}</span></div>
    </button>
  );
}

function KpiCardButton({ children, onClick, title }) {
  return <button type="button" className="warden-kpi-button" onClick={onClick} title={title}>{children}</button>;
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

function getLastNDates(days = 7) {
  const dates = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    dates.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
  }
  return dates;
}

function fillSevenDays(history = [], selectedRoom = "All") {
  const byDate = new Map((history || []).map((item) => [item.date, item]));
  return getLastNDates(7).map((date) => {
    const found = byDate.get(date);
    const occupied = Number(found?.occupied_count || 0);
    const empty = Number(found?.empty_count || 0);
    const warning = Number(found?.warning_count || 0);
    const violation = Number(found?.violation_count || 0);
    const criticalNoiseCount = warning + violation;
    const totalBase = selectedRoom === "All" ? occupied + empty : 1;
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
      normal_noise_count: Math.max(totalBase - criticalNoiseCount, 0)
    };
  });
}

export default function WardenDashboard() {
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
  const [mlAlerts, setMlAlerts] = useState([]);
  const [wardenForecasts, setWardenForecasts] = useState([]);
  const [wardenAnomalies, setWardenAnomalies] = useState([]);
  const [wardenPatterns, setWardenPatterns] = useState([]);
  const [wardenFeatureImportance, setWardenFeatureImportance] = useState([]);
  const [wardenHistory, setWardenHistory] = useState([]);
  const [lastRefreshAt, setLastRefreshAt] = useState(new Date());
  const selectedRoomFilterRef = useRef(selectedRoomFilter);

  useEffect(() => { selectedRoomFilterRef.current = selectedRoomFilter; }, [selectedRoomFilter]);

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

  const fetchAllData = useCallback(async () => {
    try {
      setError("");
      const roomId = selectedRoomFilterRef.current;
      const [summaryRes, roomsRes, alertsRes, forecastRes, anomalyRes, patternRes, featureImportanceRes, historyRes] = await Promise.all([
        getWardenSummary(roomId),
        getWardenRoomsStatus(roomId),
        getWardenMlAlerts(roomId),
        getWardenForecasts(roomId),
        getWardenAnomalies(roomId),
        getWardenPatterns(roomId),
        getWardenFeatureImportance(),
        getWardenHistory(roomId),
        getWardenDataRange(roomId).catch(() => null)
      ]);

      // Owner-style live update: every poll creates a fresh dashboard refresh
      // timestamp while MongoDB evidence time is displayed separately.
      const refreshTime = new Date();

      setSummary(summaryRes || null);
      setRooms(roomsRes?.rooms || []);
      setMlAlerts(alertsRes?.items || []);
      setWardenForecasts(forecastRes?.items || []);
      setWardenAnomalies(anomalyRes?.items || []);
      setWardenPatterns(patternRes?.items || []);
      setWardenFeatureImportance(featureImportanceRes?.items || []);
      setWardenHistory(historyRes?.items || historyRes?.history || []);
      setLastRefreshAt(refreshTime);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Failed to load warden dashboard data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let timeoutId;
    let cancelled = false;

    async function loop() {
      const startedAt = Date.now();
      await fetchAllData();

      if (cancelled) return;

      const elapsed = Date.now() - startedAt;
      const delay = Math.max(8000 - elapsed, 0);
      timeoutId = setTimeout(loop, delay);
    }

    setLoading(true);
    loop();

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [fetchAllData, selectedRoomFilter]);

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

  const sevenDayHistory = useMemo(() => fillSevenDays(wardenHistory, selectedRoomFilter), [wardenHistory, selectedRoomFilter]);
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
    const actualRows = (wardenHistory || []).map((item) => ({
      date: item.date,
      actual_occupancy: Number(item.occupied_count || 0),
      actual_warnings: Number(item.warning_count || 0),
      predicted_occupancy: null,
      predicted_warnings: null
    }));
    const predictedRows = (wardenForecasts || []).map((item) => ({
      date: item.date,
      actual_occupancy: null,
      actual_warnings: null,
      predicted_occupancy: Number(item.predicted_occupied_count || 0),
      predicted_warnings: Number(item.predicted_warning_count || 0)
    }));
    return [...actualRows, ...predictedRows].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  }, [wardenHistory, wardenForecasts]);


  const recentHistoryRows = useMemo(() => {
    const refreshStamp = lastRefreshAt instanceof Date ? lastRefreshAt : new Date(lastRefreshAt);

    const toDateTimeParts = (value, fallbackTime = "23:59:59") => {
      if (!value) return { sortKey: 0, date: "-", time: "-" };
      const raw = String(value);
      const parsed = raw.includes("T") || raw.includes(":") ? new Date(raw) : new Date(`${raw}T${fallbackTime}`);
      if (Number.isNaN(parsed.getTime())) return { sortKey: 0, date: raw, time: fallbackTime };
      return {
        sortKey: parsed.getTime(),
        date: parsed.toLocaleDateString(),
        time: parsed.toLocaleTimeString()
      };
    };

    const historyRows = (wardenHistory || []).map((item) => {
      const stamp = toDateTimeParts(item.captured_at || item.timestamp || item.datetime || item.date);
      return {
        room_id: item.room_id || selectedRoomFilter || "All",
        date: stamp.date,
        time: stamp.time,
        sortKey: stamp.sortKey,
        occupied_count: Number(item.occupied_count || 0),
        empty_count: Number(item.empty_count || 0),
        warning_count: Number(item.warning_count || 0),
        violation_count: Number(item.violation_count || 0),
        inspection_count: Number(item.inspection_count || 0),
        avg_sound_peak: Number(item.avg_sound_peak || 0),
        source: item.source || item.source_type || "MongoDB summary"
      };
    });

    const liveRoomRows = (rooms || []).map((room) => {
      const evidenceStamp = room.captured_at ? toDateTimeParts(room.captured_at) : { date: "No evidence", time: "-", sortKey: 0 };
      const stamp = {
        sortKey: refreshStamp.getTime(),
        date: refreshStamp.toLocaleDateString(),
        time: refreshStamp.toLocaleTimeString()
      };
      return {
        room_id: room.room_id,
        date: stamp.date,
        time: stamp.time,
        sortKey: stamp.sortKey,
        occupied_count: room.occupancy_stat || "-",
        empty_count: String(room.occupancy_stat || "").toLowerCase() === "empty" ? 1 : 0,
        warning_count: room.noise_stat || "-",
        violation_count: room.needs_inspection ? 1 : 0,
        inspection_count: room.needs_inspection ? 1 : 0,
        avg_sound_peak: Number(room.sound_peak || 0),
        source: room.captured_at ? `Live refresh · evidence ${evidenceStamp.date} ${evidenceStamp.time}` : "Live 8-second refresh"
      };
    });

    return [...liveRoomRows, ...historyRows]
      .sort((a, b) => Number(b.sortKey || 0) - Number(a.sortKey || 0))
      .slice(0, 12);
  }, [wardenHistory, rooms, selectedRoomFilter, lastRefreshAt]);

  const generatedInsights = useMemo(() => {
    const highestRiskPattern = [...patternRows].sort((a, b) => Number(b.avg_critical_ratio || 0) - Number(a.avg_critical_ratio || 0))[0];
    const nextForecast = (wardenForecasts || [])[0];
    const latestAnomaly = (wardenAnomalies || [])[0];
    const topFeature = (wardenFeatureImportance || [])[0];
    const inspectionReason = filteredRooms.find((room) => room.needs_inspection)?.inspection_reasons?.[0];

    return [
      {
        title: "Inspection priority",
        value: `${cleaningPriorityRooms.length} room${cleaningPriorityRooms.length === 1 ? "" : "s"}`,
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
  }, [patternRows, wardenForecasts, wardenAnomalies, wardenFeatureImportance, filteredRooms, cleaningPriorityRooms, selectedRoomFilter]);

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

      <div className="warden-live-system-strip">
        <div>
          <strong>Live Warden System</strong>
          <span>KPIs, room monitoring, critical alerts, charts, recent history, and insights refresh together every 8 seconds.</span>
        </div>
        <div className="warden-live-clock"><span className="live-dot" /> Last refreshed {lastRefreshAt.toLocaleTimeString()}</div>
      </div>

      <div className="stats-grid">
        <KpiCardButton onClick={() => setSelectedKpi("occupied")} title="Click to drill down occupied rooms"><StatCard title="Occupied Rooms" value={displayedOccupied} subtitle="From summary API" icon={<HiOutlineHomeModern />} tone="blue" /></KpiCardButton>
        <KpiCardButton onClick={() => setSelectedKpi("empty")} title="Click to drill down empty rooms"><StatCard title="Empty Rooms" value={displayedEmpty} subtitle="Useful for cleaning allocation" icon={<HiOutlineHomeModern />} tone="green" /></KpiCardButton>
        <KpiCardButton onClick={() => setSelectedKpi("alerts")} title="Click to drill down critical alerts"><StatCard title="Critical Alerts" value={displayedAlerts} subtitle="From ML anomaly detection" icon={<HiOutlineSpeakerWave />} tone="orange" /></KpiCardButton>
        <KpiCardButton onClick={() => setSelectedKpi("priority")} title="Click to drill down cleaning priority"><StatCard title="Cleaning Priority" value={displayedPriority} subtitle="Rooms that need action" icon={<HiOutlineWrenchScrewdriver />} tone="red" /></KpiCardButton>
      </div>

      <div className="owner-top-grid">
        <SectionCard title="Room Monitoring">
          {filteredRooms.length ? <div className="room-tile-grid">{filteredRooms.map((room) => <WardenRoomTile key={room.room_id} room={room} liveUpdatedAt={lastRefreshAt} />)}</div> : <EmptyState text="No rooms match the selected filters." />}
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
              <p>Latest warden activity for real-time monitoring, matching the Security recent activity style.</p>
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

      {isSingleRoom ? <>
        <SectionCard title="Historical and Forecasted Room Trend">
          {forecastChartData.length ? <div className="chart-shell owner-forecast-chart-shell"><ResponsiveContainer width="100%" height={360}><LineChart data={forecastChartData} margin={{ top: 10, right: 24, left: 6, bottom: 8 }}><CartesianGrid strokeDasharray="3 3" stroke="#d9e1ec" /><XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 11 }} minTickGap={24} /><YAxis tick={{ fill: "#64748b", fontSize: 11 }} allowDecimals={false} /><Tooltip contentStyle={chartTooltipStyle} /><Legend content={renderForecastLegend} /><Line type="monotone" dataKey="actual_occupancy" name="Actual Occupancy" stroke="#2563eb" strokeWidth={2.4} dot={false} connectNulls /><Line type="monotone" dataKey="actual_warnings" name="Actual Warnings" stroke="#f59e0b" strokeWidth={2.2} dot={false} connectNulls /><Line type="monotone" dataKey="predicted_occupancy" name="Predicted Occupancy" stroke="#2563eb" strokeWidth={2.4} strokeDasharray="7 5" dot={false} connectNulls /><Line type="monotone" dataKey="predicted_warnings" name="Predicted Warnings" stroke="#f59e0b" strokeWidth={2.2} strokeDasharray="7 5" dot={false} connectNulls /></LineChart></ResponsiveContainer></div> : <EmptyState text="No forecast or history data available for this room." />}
        </SectionCard>

        <SectionCard title="Weekly Pattern Discovery">
          <DataTable columns={[{ key: "day", label: "Day" }, { key: "day_type", label: "Type" }, { key: "usual_pattern", label: "Usual Pattern", render: (row) => <HistoryWord value={row.usual_pattern} /> }, { key: "avg_occupancy", label: "Avg Occupancy", render: (row) => formatNumber(row.avg_occupancy) }, { key: "avg_noise_level", label: "Avg Noise Level", render: (row) => formatNumber(row.avg_noise_level) }, { key: "avg_warnings", label: "Avg Warnings", render: (row) => formatNumber(row.avg_warnings) }, { key: "avg_critical_ratio", label: "Avg Critical Ratio", render: (row) => `${formatNumber(row.avg_critical_ratio)}%` }, { key: "cluster_id", label: "Cluster" }]} rows={patternRows} />
        </SectionCard>

        <SectionCard title="Abnormal / Anomaly Records">
          {wardenAnomalies.length ? <DataTable columns={[{ key: "room_id", label: "Room" }, { key: "date", label: "Date" }, { key: "status", label: "Status", render: (row) => <HistoryWord value={row.status || "Abnormal"} /> }, { key: "anomaly_score", label: "Score", render: (row) => formatNumber(row.anomaly_score, 3) }, { key: "reason", label: "Reason" }]} rows={wardenAnomalies.slice(0, 12)} /> : <EmptyState text="No anomaly records available for this room." />}
        </SectionCard>

        <div className="owner-top-grid">
          <SectionCard title="Inspection Evidence and Report Support">
            {filteredRooms.length ? <DataTable columns={[{ key: "room_id", label: "Room" }, { key: "captured_at", label: "Last Evidence", render: (row) => (row.captured_at ? formatDate(row.captured_at) : "No Data") }, { key: "sound_peak", label: "Noise Evidence", render: (row) => `${formatNumber(row.sound_peak)} dB` }, { key: "motion_count", label: "Motion" }, { key: "door_status", label: "Door", render: (row) => <StatusBadge value={row.door_status} /> }, { key: "inspection_reasons", label: "Warden Reason", render: (row) => renderReasons(row.inspection_reasons) }, { key: "sensor_faults", label: "Sensor Fault Evidence", render: (row) => renderFaults(row.sensor_faults) }]} rows={filteredRooms.slice(0, 12)} /> : <EmptyState text="No evidence rows available for this room." />}
          </SectionCard>
          <SectionCard title="ML Feature Importance">
            {wardenFeatureImportance.length ? <div className="chart-shell"><ResponsiveContainer width="100%" height={320}><BarChart data={wardenFeatureImportance.slice(0, 8)} layout="vertical" margin={{ top: 8, right: 24, left: 80, bottom: 8 }}><CartesianGrid strokeDasharray="3 3" stroke="#d9e1ec" /><XAxis type="number" tick={{ fill: "#64748b", fontSize: 12 }} /><YAxis type="category" dataKey="feature" tick={{ fill: "#64748b", fontSize: 12 }} width={90} /><Tooltip contentStyle={chartTooltipStyle} /><Bar dataKey="importance" name="Model Importance" fill="#7c3aed" radius={[0, 8, 8, 0]} /></BarChart></ResponsiveContainer></div> : <EmptyState text="No feature-importance records available. Run npm run ml:warden." />}
          </SectionCard>
        </div>

        <SectionCard title="Insight Generation">
          <div className="warden-insight-stack">
            {generatedInsights.map((insight, index) => (
              <div className="warden-insight-step" key={insight.title}>
                <div className="warden-insight-index">{index + 1}</div>
                <div className="warden-insight-body">
                  <span>{insight.title}</span>
                  <strong>{insight.value}</strong>
                  <p>{insight.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </> : null}

      {selectedKpi ? <div className="warden-modal-overlay" onClick={() => setSelectedKpi(null)}><div className="warden-modal" onClick={(e) => e.stopPropagation()}><div className="warden-modal-head"><h3>{selectedKpi === "occupied" && "Occupied Rooms"}{selectedKpi === "empty" && "Empty Rooms"}{selectedKpi === "alerts" && "Critical Alerts"}{selectedKpi === "priority" && "Cleaning Priority"}</h3><button onClick={() => setSelectedKpi(null)}>Close</button></div>{selectedKpi === "occupied" ? <DataTable columns={[{ key: "room_id", label: "Room" }, { key: "occupancy_stat", label: "Occupancy", render: (row) => <StatusBadge value={row.occupancy_stat} /> }, { key: "noise_stat", label: "Noise", render: (row) => <HistoryWord value={row.noise_stat} /> }, { key: "captured_at", label: "Evidence Time", render: (row) => (row.captured_at ? formatDate(row.captured_at) : "No Data") }]} rows={occupiedRows} /> : null}{selectedKpi === "empty" ? <DataTable columns={[{ key: "room_id", label: "Room" }, { key: "occupancy_stat", label: "Occupancy", render: (row) => <StatusBadge value={row.occupancy_stat} /> }, { key: "door_status", label: "Door", render: (row) => <StatusBadge value={row.door_status} /> }, { key: "captured_at", label: "Evidence Time", render: (row) => (row.captured_at ? formatDate(row.captured_at) : "No Data") }]} rows={emptyRows.length ? emptyRows : [selectedRoomData].filter(Boolean)} /> : null}{selectedKpi === "alerts" ? roomSpecificAlerts.length ? <div className="alerts-list">{roomSpecificAlerts.map((alert, index) => <WardenAlertCard key={`${alert.room_id}-${alert.captured_at}-modal-${index}`} alert={alert} onOpen={setSelectedAlert} />)}</div> : <EmptyState text="No critical alerts right now." /> : null}{selectedKpi === "priority" ? cleaningPriorityRooms.length > 0 ? <DataTable columns={[{ key: "room_id", label: "Room" }, { key: "occupancy_stat", label: "Occupancy", render: (row) => <StatusBadge value={row.occupancy_stat} /> }, { key: "priority_type", label: "Priority Type", render: (row) => String(row.occupancy_stat || "").toLowerCase() === "empty" ? "Empty Room Cleaning" : "Inspection Required" }, { key: "inspection_reasons", label: "Reason", render: (row) => String(row.occupancy_stat || "").toLowerCase() === "empty" && !(row.inspection_reasons || []).length ? "Room is empty and ready for cleaning" : renderReasons(row.inspection_reasons) }]} rows={cleaningPriorityRooms} /> : <EmptyState text="No cleaning priority rooms." /> : null}</div></div> : null}

      {selectedAlert ? <div className="warden-modal-overlay" onClick={() => setSelectedAlert(null)}><div className="warden-modal" onClick={(e) => e.stopPropagation()}><div className="warden-modal-head"><h3>Critical Alert</h3><button onClick={() => setSelectedAlert(null)}>Close</button></div><div className="warden-single-room-grid"><div className="warden-single-room-card"><h4>Critical Alert Details</h4><p><strong>Room:</strong> {selectedAlert.room_id}</p><p><strong>Severity:</strong> {selectedAlert.severity}</p><p><strong>Model:</strong> {selectedAlert.model_name || "IsolationForest"}</p><p><strong>Confidence:</strong> {Math.round(Number(selectedAlert.confidence || 0) * 100)}%</p><p><strong>Reason:</strong> {selectedAlert.message}</p><p><strong>Detected At:</strong> {selectedAlert.captured_at ? formatDate(selectedAlert.captured_at) : "No Data"}</p></div></div></div></div> : null}

      <ChatAssistant roomId={selectedRoomFilter} />
    </div>
  );
}
