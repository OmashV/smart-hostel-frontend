import { useEffect, useMemo, useRef, useState } from "react";
import {
  HiOutlineBellAlert,
  HiOutlineExclamationTriangle,
  HiOutlineHomeModern,
  HiOutlineWrenchScrewdriver,
  HiOutlineChartBarSquare,
  HiOutlineCalendarDays,
  HiOutlineShieldCheck
} from "react-icons/hi2";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
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
  getWardenDataRange,
  askDashboardAssistant
} from "../api/client";
import StatCard from "../components/StatCard";
import SectionCard from "../components/SectionCard";
import StatusBadge from "../components/StatusBadge";
import DataTable from "../components/DataTable";
import LoadingState from "../components/LoadingState";
import EmptyState from "../components/EmptyState";
import { formatDate } from "../utils/format";

/* ── constants ─────────────────────────────────────────────────────── */
const ORDERED_DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];

const chartTooltipStyle = {
  background: "#ffffff",
  border: "1px solid #dbe2ea",
  borderRadius: "12px",
  color: "#172033",
  boxShadow: "0 10px 24px rgba(15, 23, 42, 0.08)"
};

/* ── small helpers ──────────────────────────────────────────────────── */
function formatNumber(value, digits = 2) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n.toFixed(digits) : "0.00";
}

function renderReasons(reasons = []) {
  return Array.isArray(reasons) && reasons.length ? reasons.join(", ") : "-";
}

function getLastNDates(days = 7) {
  const dates = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    dates.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`);
  }
  return dates;
}

function toShortLabel(dateStr) {
  if (!dateStr) return "";
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString("en-US", { month: "numeric", day: "numeric" });
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

/* ── pattern tone helper ────────────────────────────────────────────── */
function patternToneClass(value = "") {
  const t = String(value || "").toLowerCase();
  if (t.includes("high") || t.includes("critical") || t.includes("violation") || t.includes("abnormal")) return "history-word danger";
  if (t.includes("inspection") || t.includes("moderate") || t.includes("warning")) return "history-word warning";
  if (t.includes("normal") || t.includes("stable") || t.includes("valid")) return "history-word ok";
  return "history-word neutral";
}

function PatternWord({ value }) {
  return <span className={patternToneClass(value)}>{value || "-"}</span>;
}

/* ── forecast legend ────────────────────────────────────────────────── */
const LEGEND_ITEMS = [
  { key: "actual_occupancy",    color: "#2563eb", dash: false, label: "Actual Occupancy"    },
  { key: "actual_warnings",     color: "#f59e0b", dash: false, label: "Actual Warnings"     },
  { key: "predicted_occupancy", color: "#2563eb", dash: true,  label: "Predicted Occupancy" },
  { key: "predicted_warnings",  color: "#f59e0b", dash: true,  label: "Predicted Warnings"  },
];

function ForecastLegend() {
  return (
    <div style={{ display:"flex", flexWrap:"wrap", gap:"18px", justifyContent:"center", marginTop:8, fontSize:13 }}>
      {LEGEND_ITEMS.map((item) => (
        <span key={item.key} style={{ display:"flex", alignItems:"center", gap:6 }}>
          <svg width="28" height="12">
            <line
              x1="0" y1="6" x2="28" y2="6"
              stroke={item.color}
              strokeWidth="2.4"
              strokeDasharray={item.dash ? "6 4" : "none"}
            />
          </svg>
          <span style={{ color: item.color, fontWeight: 600 }}>{item.label}</span>
        </span>
      ))}
    </div>
  );
}

/* ── Room tile ──────────────────────────────────────────────────────── */
function WardenRoomTile({ room }) {
  const isViolation = String(room.noise_stat || "").toLowerCase().includes("violation");
  const isCritical = String(room.waste_stat || "").toLowerCase().includes("critical");
  const tileClass = (isViolation || isCritical)
    ? "owner-room-tile critical"
    : room.needs_inspection
    ? "owner-room-tile warning"
    : "owner-room-tile normal";
  const dotClass = (isViolation || isCritical) ? "red" : room.needs_inspection ? "orange" : "green";

  return (
    <div className={`${tileClass} warden-room-tile`}>
      <div className="tile-top">
        <div>
          <h3>{room.room_id}</h3>
          <p className="tile-subtext">Room monitoring</p>
        </div>
        <span className={`tile-dot ${dotClass}`} />
      </div>
      {room.needs_inspection && (
        <div className="tile-alert-pill">{(room.inspection_reasons || []).length || 1} Alert</div>
      )}
      <div className="tile-metrics">
        <div className="tile-row"><span>Occupancy</span><strong>{room.occupancy_stat}</strong></div>
        <div className="tile-row"><span>Noise</span><strong>{room.noise_stat}</strong></div>
        <div className="tile-row"><span>Door</span><strong>{room.door_status}</strong></div>
        <div className="tile-row"><span>Current</span><strong>{room.current_amp} A</strong></div>
      </div>
      <div className="tile-badges">
        <StatusBadge value={room.occupancy_stat} />
        <StatusBadge value={room.noise_stat} />
        <StatusBadge value={room.waste_stat} />
      </div>
      <div className="tile-footer">
        Last Activity <span>{room.captured_at ? formatDate(room.captured_at) : "No Data"}</span>
      </div>
    </div>
  );
}

/* ── ML Alert card ──────────────────────────────────────────────────── */
function WardenAlertCard({ alert, onOpen }) {
  const cls = alert.severity === "Critical"
    ? "alert-card critical warden-alert-button"
    : "alert-card warning warden-alert-button";
  return (
    <button type="button" className={cls} onClick={() => onOpen(alert)}>
      <div className="alert-card-head">
        <div className="alert-card-title">
          {alert.severity === "Critical"
            ? <HiOutlineExclamationTriangle size={18} />
            : <HiOutlineBellAlert size={18} />}
          <strong>{alert.title}</strong>
        </div>
        <StatusBadge value={alert.severity} />
      </div>
      <p className="alert-card-message">{alert.message}</p>
      <div className="alert-card-foot">
        <span>{alert.room_id}</span>
        <span>{alert.captured_at ? formatDate(alert.captured_at) : "No Data"}</span>
      </div>
    </button>
  );
}

/* ── KPI button wrapper ─────────────────────────────────────────────── */
function KpiBtn({ onClick, title, children }) {
  return (
    <button type="button" className="warden-kpi-button" onClick={onClick} title={title}>
      {children}
    </button>
  );
}

/* ── Floating Chatbot ───────────────────────────────────────────────── */
function FloatingChatbot({ roomId = "All" }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: "assistant", text: "Hi! Ask me about alerts, anomalies, weekly patterns, forecasts, or inspection rooms." }
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef(null);

  const QUICK = [
    "Which rooms have active alerts?",
    "Which rooms need inspection?",
    "What is the weekly pattern?",
    "Show anomalies",
    "What is the forecast?"
  ];

  async function ask(question) {
    const q = String(question || input).trim();
    if (!q) return;
    setMessages((m) => [...m, { role: "user", text: q }]);
    setInput("");
    setBusy(true);
    try {
      const res = await askDashboardAssistant(q, "warden");
      setMessages((m) => [...m, { role: "assistant", text: res.answer || "No answer returned." }]);
    } catch (err) {
      setMessages((m) => [...m, { role: "assistant", text: err?.message || "Error contacting assistant." }]);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <>
      <button className="floating-chatbot-bubble" onClick={() => setOpen((v) => !v)} title="Warden Assistant">
        {open ? "✕" : "💬"}
      </button>
      {open && (
        <div className="floating-chatbot-panel">
          <div className="floating-chatbot-header">
            <div className="floating-chatbot-title-wrap">
              <div className="floating-chatbot-status-dot" />
              <div>
                <strong>Warden Assistant</strong>
                <div className="floating-chatbot-subtitle">
                  Powered by live API data · Room: {roomId}
                </div>
              </div>
            </div>
            <button className="floating-chatbot-close" onClick={() => setOpen(false)}>✕</button>
          </div>

          <div className="floating-chatbot-messages">
            {messages.map((m, i) => (
              <div key={i} className={`floating-chatbot-msg ${m.role}`}>{m.text}</div>
            ))}
            {busy && <div className="floating-chatbot-msg assistant">Thinking…</div>}
            <div ref={bottomRef} />
          </div>

          <div style={{ padding: "0 16px 4px", display:"flex", flexDirection:"column", gap:6 }}>
            {QUICK.map((q) => (
              <button
                key={q}
                className="floating-chatbot-quick-btn"
                onClick={() => ask(q)}
                disabled={busy}
              >
                {q}
              </button>
            ))}
          </div>

          <div className="floating-chatbot-input-row">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !busy && ask()}
              placeholder="Ask about alerts, anomalies, patterns…"
              disabled={busy}
            />
            <button onClick={() => ask()} disabled={busy || !input.trim()}>
              {busy ? "…" : "Ask"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   MAIN DASHBOARD COMPONENT
══════════════════════════════════════════════════════════════════════ */
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
  const [dataRange, setDataRange] = useState(null);

  const selectedRoomFilterRef = useRef(selectedRoomFilter);
  useEffect(() => { selectedRoomFilterRef.current = selectedRoomFilter; }, [selectedRoomFilter]);

  /* ── load floor / room options ──────────────────────────────────── */
  useEffect(() => {
    (async () => {
      try {
        const r = await getAvailableFloors();
        setFloorOptions(["All", ...(r?.floors || [])]);
      } catch (_) { setFloorOptions(["All"]); }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const r = await getAvailableRooms(selectedFloor);
        const next = ["All", ...(r?.rooms || [])];
        setRoomOptions(next);
        if (!next.includes(selectedRoomFilterRef.current)) setSelectedRoomFilter("All");
      } catch (_) { setRoomOptions(["All"]); }
    })();
  }, [selectedFloor]);

  /* ── main data fetch ────────────────────────────────────────────── */
  async function fetchAllData() {
    try {
      setError("");
      const roomId = selectedRoomFilterRef.current;

      const [
        summaryRes, roomsRes, alertsRes, forecastRes,
        anomalyRes, patternRes, featureImportanceRes, historyRes, dataRangeRes
      ] = await Promise.all([
        getWardenSummary(roomId),
        getWardenRoomsStatus(roomId),
        getWardenMlAlerts(roomId, 30),
        getWardenForecasts(roomId),
        getWardenAnomalies(roomId),
        getWardenPatterns(roomId),
        getWardenFeatureImportance(),
        getWardenHistory(roomId, 7),
        getWardenDataRange(roomId)
      ]);

      setSummary(summaryRes || null);
      setRooms(roomsRes?.rooms || []);
      setMlAlerts(alertsRes?.items || []);
      setWardenForecasts(forecastRes?.items || []);
      setWardenAnomalies(anomalyRes?.items || []);
      setWardenPatterns(patternRes?.items || []);
      setWardenFeatureImportance(featureImportanceRes?.items || []);
      setWardenHistory(historyRes?.items || historyRes?.history || []);
      setDataRange(dataRangeRes || null);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Failed to load warden dashboard data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    fetchAllData();
    const interval = setInterval(fetchAllData, 8000);
    return () => clearInterval(interval);
  }, [selectedRoomFilter]); // eslint-disable-line

  /* ── derived options ────────────────────────────────────────────── */
  const floors = useMemo(() => {
    const derived = Array.from(new Set(rooms.map(getFloor))).sort();
    return Array.from(new Set(["All", ...floorOptions, ...derived]));
  }, [rooms, floorOptions]);

  const dynamicRoomOptions = useMemo(() => {
    const derived = rooms
      .filter((r) => selectedFloor === "All" || getFloor(r) === selectedFloor)
      .map((r) => r.room_id).sort();
    return Array.from(new Set(["All", ...roomOptions, ...derived]));
  }, [rooms, roomOptions, selectedFloor]);

  const selectedRoomData = useMemo(() => {
    if (selectedRoomFilter === "All") return null;
    return rooms.find((r) => r.room_id === selectedRoomFilter) || makeEmptyRoom(selectedRoomFilter);
  }, [rooms, selectedRoomFilter]);

  const filteredRooms = useMemo(() => {
    return rooms.filter((r) => {
      const matchFloor = selectedFloor === "All" || getFloor(r) === selectedFloor;
      const matchRoom = selectedRoomFilter === "All" || r.room_id === selectedRoomFilter;
      const matchAttn = !onlyAttention || r.needs_inspection;
      return matchFloor && matchRoom && matchAttn;
    });
  }, [rooms, selectedFloor, selectedRoomFilter, onlyAttention]);

  /* ── alert data from ML API ─────────────────────────────────────── */
  const activeAlerts = useMemo(() => {
    return (mlAlerts || []).map((alert) => ({
      ...alert,
      title: alert.alert_type || "ML Alert",
      message: alert.reason || "ML-generated alert from IsolationForest",
      severity: alert.severity || "Warning",
    }));
  }, [mlAlerts]);

  const roomSpecificAlerts = useMemo(() => {
    return selectedRoomFilter === "All"
      ? activeAlerts
      : activeAlerts.filter((a) => a.room_id === selectedRoomFilter);
  }, [activeAlerts, selectedRoomFilter]);

  /* ── KPI counts ─────────────────────────────────────────────────── */
  const occupiedRows = useMemo(() =>
    selectedRoomFilter === "All"
      ? rooms.filter((r) => r.occupancy_stat === "Occupied")
      : [selectedRoomData].filter((r) => r && r.occupancy_stat === "Occupied"),
    [rooms, selectedRoomFilter, selectedRoomData]);

  const emptyRows = useMemo(() =>
    selectedRoomFilter === "All"
      ? rooms.filter((r) => r.occupancy_stat === "Empty")
      : [selectedRoomData].filter((r) => r && r.occupancy_stat === "Empty"),
    [rooms, selectedRoomFilter, selectedRoomData]);

  const cleaningPriorityRooms = useMemo(() => {
    const source = selectedRoomFilter === "All" ? rooms : [selectedRoomData].filter(Boolean);
    return source.filter((r) => {
      const occ = String(r.occupancy_stat || "").toLowerCase();
      return r.needs_inspection || occ === "empty";
    });
  }, [rooms, selectedRoomFilter, selectedRoomData]);

  const displayedOccupied = selectedRoomFilter === "All"
    ? summary?.occupied_rooms ?? 0
    : selectedRoomData?.occupancy_stat === "Occupied" ? 1 : 0;

  const displayedEmpty = selectedRoomFilter === "All"
    ? summary?.empty_rooms ?? 0
    : selectedRoomData?.occupancy_stat === "Empty" ? 1 : 0;

  const displayedAlerts = selectedRoomFilter === "All" ? activeAlerts.length : roomSpecificAlerts.length;
  const displayedPriority = cleaningPriorityRooms.length;

  /* ── ML stats for second KPI row ───────────────────────────────── */
  const forecastCount = wardenForecasts.length;
  const anomalyCount = wardenAnomalies.length;
  const patternCount = wardenPatterns.filter((p) => p.usual_pattern && p.usual_pattern !== "No Data").length;
  const topFeature = wardenFeatureImportance.length > 0
    ? wardenFeatureImportance[0].feature
    : "N/A";

  /* ── chart data ─────────────────────────────────────────────────── */
  const sevenDayHistory = useMemo(
    () => fillSevenDays(wardenHistory, selectedRoomFilter),
    [wardenHistory, selectedRoomFilter]
  );

  const occupancyTrend = useMemo(() =>
    sevenDayHistory.map((item) => ({ label: item.label, occupied: item.occupied_count, empty: item.empty_count })),
    [sevenDayHistory]);

  const noiseTrend = useMemo(() =>
    sevenDayHistory.map((item) => ({ label: item.label, warnings: item.warning_count, violations: item.violation_count })),
    [sevenDayHistory]);

  /* merged history + forecast for the main trend chart */
  const forecastChartData = useMemo(() => {
    const historyRows = (wardenHistory || []).map((item) => ({
      date: item.date,
      label: toShortLabel(item.date),
      actual_occupancy: Number(item.occupied_count || 0),
      actual_warnings: Number(item.warning_count || 0),
      predicted_occupancy: null,
      predicted_warnings: null,
      is_forecast: false
    }));

    const forecastRows = (wardenForecasts || []).map((item) => ({
      date: item.date,
      label: toShortLabel(item.date),
      actual_occupancy: null,
      actual_warnings: null,
      predicted_occupancy: Number(item.predicted_occupied_count || 0),
      predicted_warnings: Number(item.predicted_warning_count || 0),
      is_forecast: true
    }));

    // merge, dedupe by date, sort
    const map = new Map();
    [...historyRows, ...forecastRows].forEach((row) => {
      if (!map.has(row.date)) {
        map.set(row.date, row);
      } else {
        map.set(row.date, { ...map.get(row.date), ...row });
      }
    });

    return Array.from(map.values()).sort((a, b) => String(a.date).localeCompare(String(b.date)));
  }, [wardenHistory, wardenForecasts]);

  // find the boundary date between actual and forecast
  const forecastStartDate = useMemo(() => {
    const firstForecast = forecastChartData.find((d) => d.is_forecast);
    return firstForecast?.date || null;
  }, [forecastChartData]);

  /* ── weekly pattern rows ordered Mon–Sun ───────────────────────── */
  const patternRows = useMemo(() => {
    const map = new Map((wardenPatterns || []).map((item) => [item.day, item]));
    return ORDERED_DAYS.map((day) =>
      map.get(day) || {
        day,
        day_type: ["Saturday", "Sunday"].includes(day) ? "Weekend" : "Weekday",
        usual_pattern: "No Data",
        avg_occupancy: 0,
        avg_noise_level: 0,
        avg_warnings: 0,
        avg_critical_ratio: 0,
        cluster_id: -1
      }
    );
  }, [wardenPatterns]);

  if (loading) return <LoadingState />;

  /* ══════════════════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════════════════ */
  return (
    <div className="page-grid owner-dashboard">

      {/* ── Filter Bar ──────────────────────────────────────────────── */}
      <div className="filter-bar warden-filter-bar">
        <label>
          Floor
          <select value={selectedFloor} onChange={(e) => { setSelectedFloor(e.target.value); setSelectedRoomFilter("All"); }}>
            {floors.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </label>
        <label>
          Room
          <select value={selectedRoomFilter} onChange={(e) => setSelectedRoomFilter(e.target.value)}>
            {dynamicRoomOptions.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>
        <label>
          View
          <select value={onlyAttention ? "attention" : "all"} onChange={(e) => setOnlyAttention(e.target.value === "attention")}>
            <option value="all">All Rooms</option>
            <option value="attention">Needs Action Only</option>
          </select>
        </label>
      </div>

      {/* ── Error Banner ─────────────────────────────────────────────── */}
      {error && (
        <div className="warden-error-box">
          <strong>Dashboard error:</strong> {error}
          <button className="warden-retry-btn" onClick={fetchAllData}>Retry</button>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 1 — KPI Cards from /summary
      ═══════════════════════════════════════════════════════════════ */}
      <div className="stats-grid">
        <KpiBtn onClick={() => setSelectedKpi("occupied")} title="View occupied rooms">
          <StatCard title="Occupied Rooms" value={displayedOccupied} subtitle="Real-time from /summary" icon={<HiOutlineHomeModern />} tone="blue" />
        </KpiBtn>
        <KpiBtn onClick={() => setSelectedKpi("empty")} title="View empty rooms">
          <StatCard title="Empty Rooms" value={displayedEmpty} subtitle="For cleaning allocation" icon={<HiOutlineHomeModern />} tone="green" />
        </KpiBtn>
        <KpiBtn onClick={() => setSelectedKpi("alerts")} title="View ML alerts">
          <StatCard title="ML Active Alerts" value={displayedAlerts} subtitle="IsolationForest alerts" icon={<HiOutlineBellAlert />} tone="orange" />
        </KpiBtn>
        <KpiBtn onClick={() => setSelectedKpi("priority")} title="View cleaning priority">
          <StatCard title="Cleaning Priority" value={displayedPriority} subtitle="Empty + inspection rooms" icon={<HiOutlineWrenchScrewdriver />} tone="red" />
        </KpiBtn>
      </div>

      {/* ── ML model stats row ──────────────────────────────────────── */}
      <div className="stats-grid">
        <StatCard title="Forecast Records" value={forecastCount} subtitle="Prophet / RF temporal trend" icon={<HiOutlineChartBarSquare />} tone="blue" />
        <StatCard title="Detected Anomalies" value={anomalyCount} subtitle="IsolationForest ML detections" icon={<HiOutlineExclamationTriangle />} tone="red" />
        <StatCard title="Pattern Days" value={patternCount} subtitle="KMeans weekly patterns" icon={<HiOutlineCalendarDays />} tone="green" />
        <StatCard title="Top Feature" value={topFeature} subtitle="Highest importance variable" icon={<HiOutlineShieldCheck />} tone="orange" />
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 2 — Room Monitoring + Active Alerts (side by side)
      ═══════════════════════════════════════════════════════════════ */}
      <div className="owner-top-grid">
        <SectionCard title="Room Monitoring">
          {filteredRooms.length ? (
            <div className="owner-room-grid">
              {filteredRooms.map((room) => (
                <WardenRoomTile key={room.room_id} room={room} />
              ))}
            </div>
          ) : (
            <EmptyState text="No rooms match the selected filters." />
          )}
        </SectionCard>

        {/* SECTION 3 — Active Alerts from /ml-alerts */}
        <SectionCard title="Active ML Alerts">
          {roomSpecificAlerts.length ? (
            <div className="alerts-list">
              {roomSpecificAlerts.slice(0, 8).map((alert, i) => (
                <WardenAlertCard
                  key={`${alert.room_id}-${alert.captured_at}-${i}`}
                  alert={alert}
                  onOpen={setSelectedAlert}
                />
              ))}
            </div>
          ) : (
            <EmptyState text="No ML alerts currently active." />
          )}
        </SectionCard>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 4 — Historical and Forecasted Room Trend (7-day charts)
      ═══════════════════════════════════════════════════════════════ */}
      <div className="owner-top-grid">
        <SectionCard title="7-Day Occupancy Trend">
          {occupancyTrend.length ? (
            <div className="chart-shell">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={occupancyTrend} margin={{ top:8, right:16, left:0, bottom:4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#d9e1ec" />
                  <XAxis dataKey="label" tick={{ fill:"#64748b", fontSize:12 }} />
                  <YAxis tick={{ fill:"#64748b", fontSize:12 }} allowDecimals={false} />
                  <Tooltip contentStyle={chartTooltipStyle} />
                  <Legend />
                  <Bar dataKey="occupied" name="Occupied" fill="#2563eb" radius={[6,6,0,0]} />
                  <Bar dataKey="empty" name="Empty" fill="#16a34a" radius={[6,6,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState text="No occupancy trend data available." />
          )}
        </SectionCard>

        <SectionCard title="7-Day Noise Trend">
          {noiseTrend.length ? (
            <div className="chart-shell">
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={noiseTrend} margin={{ top:8, right:16, left:0, bottom:4 }}>
                  <defs>
                    <linearGradient id="warnGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.05} />
                    </linearGradient>
                    <linearGradient id="violGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#d9e1ec" />
                  <XAxis dataKey="label" tick={{ fill:"#64748b", fontSize:12 }} />
                  <YAxis tick={{ fill:"#64748b", fontSize:12 }} allowDecimals={false} />
                  <Tooltip contentStyle={chartTooltipStyle} />
                  <Legend />
                  <Area type="monotone" dataKey="warnings" name="Warnings" stroke="#f59e0b" fill="url(#warnGrad)" strokeWidth={2} />
                  <Area type="monotone" dataKey="violations" name="Violations" stroke="#ef4444" fill="url(#violGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState text="No noise trend data available." />
          )}
        </SectionCard>
      </div>

      {/* ── Combined Historical + Forecasted Trend (matching owner style) */}
      <SectionCard title="Historical and Forecasted Room Trend">
        {forecastChartData.length ? (
          <div className="chart-shell owner-forecast-chart-shell">
            <ResponsiveContainer width="100%" height={360}>
              <ComposedChart data={forecastChartData} margin={{ top:10, right:28, left:6, bottom:8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#d9e1ec" />
                <XAxis
                  dataKey="label"
                  tick={{ fill:"#64748b", fontSize:11 }}
                  minTickGap={20}
                />
                <YAxis tick={{ fill:"#64748b", fontSize:11 }} allowDecimals={false} />
                <Tooltip contentStyle={chartTooltipStyle} />
                <Legend content={<ForecastLegend />} />
                {forecastStartDate && (
                  <ReferenceLine
                    x={toShortLabel(forecastStartDate)}
                    stroke="#94a3b8"
                    strokeDasharray="4 3"
                    label={{ value:"Forecast →", position:"top", fill:"#64748b", fontSize:11 }}
                  />
                )}
                <Line type="monotone" dataKey="actual_occupancy" name="Actual Occupancy"
                  stroke="#2563eb" strokeWidth={2.4} dot={false} connectNulls />
                <Line type="monotone" dataKey="actual_warnings" name="Actual Warnings"
                  stroke="#f59e0b" strokeWidth={2.2} dot={false} connectNulls />
                <Line type="monotone" dataKey="predicted_occupancy" name="Predicted Occupancy"
                  stroke="#2563eb" strokeWidth={2.4} strokeDasharray="7 5" dot={false} connectNulls />
                <Line type="monotone" dataKey="predicted_warnings" name="Predicted Warnings"
                  stroke="#f59e0b" strokeWidth={2.2} strokeDasharray="7 5" dot={false} connectNulls />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyState text="No forecast or history data available. Run the Warden ML script." />
        )}
      </SectionCard>

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 5 — Abnormal / Action Days from /anomalies
      ═══════════════════════════════════════════════════════════════ */}
      <SectionCard title="Abnormal / Action Days">
        {wardenAnomalies.length ? (
          <DataTable
            columns={[
              { key: "room_id", label: "Room" },
              { key: "date", label: "Detected At", render: (row) => row.date || "-" },
              { key: "status", label: "Status", render: (row) => <PatternWord value={row.status || "Abnormal"} /> },
              { key: "anomaly_score", label: "Score (IsolationForest)", render: (row) => formatNumber(row.anomaly_score, 4) },
              { key: "avg_sound_peak", label: "Avg Sound Peak", render: (row) => formatNumber(row.avg_sound_peak) },
              { key: "avg_current", label: "Avg Current (A)", render: (row) => formatNumber(row.avg_current, 4) },
              { key: "violation_count", label: "Violations", render: (row) => row.violation_count || 0 },
              { key: "reason", label: "Reason" }
            ]}
            rows={wardenAnomalies.slice(0, 15)}
          />
        ) : (
          <EmptyState text="No anomaly records found. Run: python ml/warden_analysis.py" />
        )}
      </SectionCard>

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 6 — Weekly Pattern Discovery from /patterns
      ═══════════════════════════════════════════════════════════════ */}
      <SectionCard title="Weekly Pattern Discovery (KMeans)">
        <div style={{ marginBottom: 10, color:"#64748b", fontSize:13 }}>
          Patterns discovered using KMeans unsupervised clustering on multi-sensor room behavior data.
        </div>
        <DataTable
          columns={[
            { key: "day", label: "Day" },
            { key: "day_type", label: "Type" },
            { key: "usual_pattern", label: "Usual Pattern", render: (row) => <PatternWord value={row.usual_pattern} /> },
            { key: "avg_occupancy", label: "Avg Occupancy", render: (row) => formatNumber(row.avg_occupancy) },
            { key: "avg_noise_level", label: "Avg Noise Level", render: (row) => formatNumber(row.avg_noise_level) },
            { key: "avg_warnings", label: "Avg Warnings", render: (row) => formatNumber(row.avg_warnings) },
            {
              key: "avg_critical_ratio",
              label: "Avg Critical %",
              render: (row) => `${formatNumber(row.avg_critical_ratio)}%`
            },
            { key: "cluster_id", label: "Cluster ID" }
          ]}
          rows={patternRows}
        />
      </SectionCard>

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 7 — Data Range / Validity from /data-range
      ═══════════════════════════════════════════════════════════════ */}
      <SectionCard title="Data Range &amp; Validity">
        {dataRange ? (
          <div className="warden-data-range-grid">
            <div className="warden-data-range-item">
              <span className="warden-data-range-label">Room Filter</span>
              <strong>{dataRange.room_id || "All"}</strong>
            </div>
            <div className="warden-data-range-item">
              <span className="warden-data-range-label">Total Records</span>
              <strong>{(dataRange.total_records || 0).toLocaleString()}</strong>
            </div>
            <div className="warden-data-range-item">
              <span className="warden-data-range-label">First Timestamp</span>
              <strong>{dataRange.first_timestamp ? formatDate(dataRange.first_timestamp) : "N/A"}</strong>
            </div>
            <div className="warden-data-range-item">
              <span className="warden-data-range-label">Last Timestamp</span>
              <strong>{dataRange.last_timestamp ? formatDate(dataRange.last_timestamp) : "N/A"}</strong>
            </div>
            <div className="warden-data-range-item">
              <span className="warden-data-range-label">Total Days Covered</span>
              <strong>{formatNumber(dataRange.total_days_covered || 0, 1)} days</strong>
            </div>
            <div className="warden-data-range-item">
              <span className="warden-data-range-label">Validity (≥5 days)</span>
              <strong>
                <span className={dataRange.is_valid_5_to_7_days_or_more ? "history-word ok" : "history-word danger"}>
                  {dataRange.is_valid_5_to_7_days_or_more ? "Valid ✓" : "Not enough data ✗"}
                </span>
              </strong>
            </div>
          </div>
        ) : (
          <EmptyState text="Data range info unavailable." />
        )}
      </SectionCard>

      {/* ── Feature Importance ─────────────────────────────────────── */}
      {wardenFeatureImportance.length > 0 && (
        <SectionCard title="Feature Importance (RandomForest explanation)">
          <div style={{ marginBottom: 10, color:"#64748b", fontSize:13 }}>
            Features ranked by their influence on IsolationForest anomaly detection results.
          </div>
          <DataTable
            columns={[
              { key: "feature", label: "Feature" },
              {
                key: "importance",
                label: "Importance Score",
                render: (row) => (
                  <span style={{ display:"flex", alignItems:"center", gap:10 }}>
                    <span style={{
                      display:"inline-block",
                      width: `${Math.round(Number(row.importance || 0) * 200)}px`,
                      maxWidth:160,
                      height:10,
                      borderRadius:999,
                      background:"#2563eb",
                      opacity:0.75
                    }} />
                    {formatNumber(row.importance, 4)}
                  </span>
                )
              },
              { key: "model_name", label: "Model" }
            ]}
            rows={wardenFeatureImportance}
          />
        </SectionCard>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          KPI Drill-down Modals
      ═══════════════════════════════════════════════════════════════ */}
      {selectedKpi && (
        <div className="warden-modal-overlay" onClick={() => setSelectedKpi(null)}>
          <div className="warden-modal" onClick={(e) => e.stopPropagation()}>
            <div className="warden-modal-head">
              <h3>
                {selectedKpi === "occupied" && "Occupied Rooms"}
                {selectedKpi === "empty" && "Empty Rooms"}
                {selectedKpi === "alerts" && "Active ML Alerts"}
                {selectedKpi === "priority" && "Cleaning Priority"}
              </h3>
              <button onClick={() => setSelectedKpi(null)}>Close</button>
            </div>

            {selectedKpi === "occupied" && (
              <DataTable
                columns={[
                  { key: "room_id", label: "Room" },
                  { key: "occupancy_stat", label: "Occupancy", render: (row) => <StatusBadge value={row.occupancy_stat} /> },
                  { key: "noise_stat", label: "Noise", render: (row) => <StatusBadge value={row.noise_stat} /> },
                  { key: "captured_at", label: "Updated", render: (row) => row.captured_at ? formatDate(row.captured_at) : "No Data" }
                ]}
                rows={occupiedRows}
              />
            )}

            {selectedKpi === "empty" && (
              <DataTable
                columns={[
                  { key: "room_id", label: "Room" },
                  { key: "occupancy_stat", label: "Occupancy", render: (row) => <StatusBadge value={row.occupancy_stat} /> },
                  { key: "door_status", label: "Door", render: (row) => <StatusBadge value={row.door_status} /> },
                  { key: "captured_at", label: "Updated", render: (row) => row.captured_at ? formatDate(row.captured_at) : "No Data" }
                ]}
                rows={emptyRows.length ? emptyRows : [selectedRoomData].filter(Boolean)}
              />
            )}

            {selectedKpi === "alerts" && (
              roomSpecificAlerts.length ? (
                <div className="alerts-list">
                  {roomSpecificAlerts.map((alert, i) => (
                    <WardenAlertCard
                      key={`${alert.room_id}-modal-${i}`}
                      alert={alert}
                      onOpen={setSelectedAlert}
                    />
                  ))}
                </div>
              ) : <EmptyState text="No active ML alerts." />
            )}

            {selectedKpi === "priority" && (
              cleaningPriorityRooms.length > 0 ? (
                <DataTable
                  columns={[
                    { key: "room_id", label: "Room" },
                    { key: "occupancy_stat", label: "Occupancy", render: (row) => <StatusBadge value={row.occupancy_stat} /> },
                    {
                      key: "priority_type", label: "Priority Type",
                      render: (row) => String(row.occupancy_stat || "").toLowerCase() === "empty"
                        ? "Empty Room Cleaning"
                        : "Inspection Required"
                    },
                    {
                      key: "inspection_reasons", label: "Reason",
                      render: (row) => (row.inspection_reasons || []).length
                        ? renderReasons(row.inspection_reasons)
                        : "Room is empty — ready for cleaning"
                    }
                  ]}
                  rows={cleaningPriorityRooms}
                />
              ) : <EmptyState text="No cleaning priority rooms." />
            )}
          </div>
        </div>
      )}

      {/* ── Alert detail modal ───────────────────────────────────────── */}
      {selectedAlert && (
        <div className="warden-modal-overlay" onClick={() => setSelectedAlert(null)}>
          <div className="warden-modal" onClick={(e) => e.stopPropagation()}>
            <div className="warden-modal-head">
              <h3>{selectedAlert.title || "ML Alert"}</h3>
              <button onClick={() => setSelectedAlert(null)}>Close</button>
            </div>
            <div className="warden-single-room-grid">
              <div className="warden-single-room-card">
                <h4>ML Alert Details</h4>
                <p><strong>Room:</strong> {selectedAlert.room_id}</p>
                <p><strong>Severity:</strong> {selectedAlert.severity}</p>
                <p><strong>Model:</strong> {selectedAlert.model_name || "IsolationForest"}</p>
                <p><strong>Confidence:</strong> {Math.round(Number(selectedAlert.confidence || 0) * 100)}%</p>
                <p><strong>Reason:</strong> {selectedAlert.message || selectedAlert.reason}</p>
                <p>
                  <strong>Detected At:</strong>{" "}
                  {selectedAlert.captured_at ? formatDate(selectedAlert.captured_at) : "No Data"}
                </p>
              </div>
              <div className="warden-single-room-card">
                <h4>Anomaly Scores</h4>
                <p><strong>Source Anomaly Score:</strong> {formatNumber(selectedAlert.source_anomaly_score, 4)}</p>
                <p><strong>Alert Probability:</strong> {formatNumber(selectedAlert.source_alert_probability, 4)}</p>
                <p style={{ color:"#64748b", fontSize:13, marginTop:12 }}>
                  Alerts are generated exclusively from the IsolationForest ML model.
                  No hardcoded sensor thresholds are used.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 8 — Warden Chatbot (floating, matching owner style)
      ═══════════════════════════════════════════════════════════════ */}
      <FloatingChatbot roomId={selectedRoomFilter} />
    </div>
  );
}
