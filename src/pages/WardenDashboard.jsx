import { useEffect, useMemo, useRef, useState } from "react";
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

const ORDERED_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday"
];

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
  return reasons.length ? reasons.join(", ") : "-";
}

function getLastNDates(days = 7) {
  const dates = [];
  const today = new Date();

  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);

    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");

    dates.push(`${yyyy}-${mm}-${dd}`);
  }

  return dates;
}

function toShortLabel(dateString) {
  if (!dateString) return "";
  const d = new Date(`${dateString}T00:00:00`);
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

function historyTone(value = "") {
  const text = String(value || "").toLowerCase();

  if (
    text.includes("critical") ||
    text.includes("violation") ||
    text.includes("fault") ||
    text.includes("alert") ||
    text.includes("abnormal") ||
    text.includes("high")
  ) {
    return "danger";
  }

  if (
    text.includes("warning") ||
    text.includes("complaint") ||
    text.includes("attention") ||
    text.includes("empty") ||
    text.includes("moderate") ||
    text.includes("inspection")
  ) {
    return "warning";
  }

  if (
    text.includes("occupied") ||
    text.includes("normal") ||
    text.includes("stable") ||
    text.includes("valid")
  ) {
    return "ok";
  }

  return "neutral";
}

function HistoryWord({ value }) {
  return <span className={`history-word ${historyTone(value)}`}>{value || "-"}</span>;
}

const renderForecastLegend = ({ payload = [] }) => (
  <div className="owner-legend-row">
    {payload.map((entry) => {
      const isPredicted = String(entry.value || "").toLowerCase().includes("predicted");

      return (
        <span key={entry.value} className="owner-legend-item">
          <span
            className={`legend-line ${isPredicted ? "predicted" : "actual"}`}
            style={{ borderColor: entry.color || "#2563eb" }}
          />
          <span className={`legend-label ${isPredicted ? "predicted" : "actual"}`}>
            {entry.value}
          </span>
        </span>
      );
    })}
  </div>
);

function WardenAlertCard({ alert, onOpen }) {
  const severity = alert.severity || "Info";
  const cls =
    severity === "Critical"
      ? "alert-card critical"
      : severity === "Warning"
      ? "alert-card warning"
      : "alert-card info";

  const icon =
    severity === "Critical" ? (
      <HiOutlineExclamationTriangle size={18} />
    ) : (
      <HiOutlineBellAlert size={18} />
    );

  return (
    <button
      type="button"
      className={`warden-alert-button ${cls}`}
      onClick={() => onOpen(alert)}
      title="Click to view alert details"
    >
      <div className="alert-card-head">
        <div className="alert-card-title">
          {icon}
          <strong>{alert.title || alert.alert_type || "ML Alert"}</strong>
        </div>
        <StatusBadge value={severity} />
      </div>

      <p className="alert-card-message">{alert.message || alert.reason || "ML-generated alert"}</p>

      <div className="alert-card-foot">
        <span>{valueOrDash(alert.room_id)}</span>
        <span>{alert.captured_at ? formatDate(alert.captured_at) : "No Data"}</span>
      </div>

      <div className="alert-card-foot">
        <span>{alert.model_name || "IsolationForest"}</span>
        <span>
          {alert.confidence !== undefined
            ? `${Math.round(Number(alert.confidence || 0) * 100)}% confidence`
            : "ML confidence"}
        </span>
      </div>
    </button>
  );
}

function WardenRoomTile({ room }) {
  return (
    <div
      className={`owner-room-tile ${room.needs_inspection ? "warning" : "normal"} warden-room-tile`}
      title={`${room.room_id} current status`}
    >
      <div className="tile-top">
        <div>
          <h3>{valueOrDash(room.room_id)}</h3>
          <p className="tile-subtext">Room monitoring</p>
        </div>
        <span className={`tile-dot ${room.needs_inspection ? "orange" : "green"}`} />
      </div>

      {room.needs_inspection ? (
        <div className="tile-alert-pill">{room.inspection_reasons?.length || 1} Alert</div>
      ) : null}

      <div className="tile-metrics">
        <div className="tile-row">
          <span>Occupancy</span>
          <strong>{valueOrDash(room.occupancy_stat)}</strong>
        </div>
        <div className="tile-row">
          <span>Noise</span>
          <strong>{valueOrDash(room.noise_stat)}</strong>
        </div>
        <div className="tile-row">
          <span>Door</span>
          <strong>{valueOrDash(room.door_status)}</strong>
        </div>
        <div className="tile-row">
          <span>Current</span>
          <strong>{Number(room.current_amp || 0)} A</strong>
        </div>
      </div>

      <div className="tile-badges">
        <StatusBadge value={room.occupancy_stat || "Unknown"} />
        <StatusBadge value={room.noise_stat || "Unknown"} />
        <StatusBadge value={room.door_status || "Unknown"} />
      </div>

      <div className="tile-footer">
        Last Activity <span>{room.captured_at ? formatDate(room.captured_at) : "No Data"}</span>
      </div>
    </div>
  );
}

function KpiCardButton({ children, onClick, title }) {
  return (
    <button type="button" className="warden-kpi-button" onClick={onClick} title={title}>
      {children}
    </button>
  );
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
  const [dataRange, setDataRange] = useState(null);

  const selectedRoomFilterRef = useRef(selectedRoomFilter);

  useEffect(() => {
    selectedRoomFilterRef.current = selectedRoomFilter;
  }, [selectedRoomFilter]);

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

        if (!next.includes(selectedRoomFilterRef.current)) {
          setSelectedRoomFilter("All");
        }
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

      const [
        summaryRes,
        roomsRes,
        alertsRes,
        forecastRes,
        anomalyRes,
        patternRes,
        featureImportanceRes,
        historyRes,
        dataRangeRes
      ] = await Promise.all([
        getWardenSummary(roomId),
        getWardenRoomsStatus(roomId),
        getWardenMlAlerts(roomId),
        getWardenForecasts(roomId),
        getWardenAnomalies(roomId),
        getWardenPatterns(roomId),
        getWardenFeatureImportance(),
        getWardenHistory(roomId),
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
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to load warden dashboard data."
      );
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
    const merged = new Set(["All", ...floorOptions, ...derived]);
    return Array.from(merged);
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
      const matchRoom = selectedRoomFilter === "All" || room.room_id === selectedRoomFilter;
      const matchAttention = !onlyAttention || room.needs_inspection;
      return matchFloor && matchRoom && matchAttention;
    });
  }, [rooms, selectedFloor, selectedRoomFilter, onlyAttention]);

  const activeAlerts = useMemo(() => {
    return (mlAlerts || []).map((alert) => ({
      ...alert,
      title: alert.alert_type || "ML Alert",
      message: alert.reason || "ML-generated alert",
      severity: alert.severity || "Info",
      inspection_reasons: [
        alert.model_name || "IsolationForest",
        `${Math.round(Number(alert.confidence || 0) * 100)}% confidence`
      ]
    }));
  }, [mlAlerts]);

  const occupiedRows = useMemo(
    () =>
      selectedRoomFilter === "All"
        ? rooms.filter((room) => room.occupancy_stat === "Occupied")
        : [selectedRoomData].filter((room) => room && room.occupancy_stat === "Occupied"),
    [rooms, selectedRoomFilter, selectedRoomData]
  );

  const emptyRows = useMemo(
    () =>
      selectedRoomFilter === "All"
        ? rooms.filter((room) => room.occupancy_stat === "Empty")
        : [selectedRoomData].filter((room) => room && room.occupancy_stat === "Empty"),
    [rooms, selectedRoomFilter, selectedRoomData]
  );

  const roomSpecificAlerts = useMemo(() => {
    return selectedRoomFilter === "All"
      ? activeAlerts
      : activeAlerts.filter((alert) => alert.room_id === selectedRoomFilter);
  }, [activeAlerts, selectedRoomFilter]);

  const sevenDayHistory = useMemo(
    () => fillSevenDays(wardenHistory, selectedRoomFilter),
    [wardenHistory, selectedRoomFilter]
  );

  const occupancyTrend = useMemo(() => {
    return sevenDayHistory.map((item) => ({
      date: item.date,
      label: item.label,
      occupied: item.occupied_count,
      empty: item.empty_count
    }));
  }, [sevenDayHistory]);

  const adjustedNoiseTrend = useMemo(() => {
    return sevenDayHistory.map((item) => ({
      date: item.date,
      label: item.label,
      critical: item.critical_noise_count,
      normal: item.normal_noise_count
    }));
  }, [sevenDayHistory]);

  const displayedOccupied =
    selectedRoomFilter === "All"
      ? summary?.occupied_rooms ?? 0
      : selectedRoomData?.occupancy_stat === "Occupied"
      ? 1
      : 0;

  const displayedEmpty =
    selectedRoomFilter === "All"
      ? summary?.empty_rooms ?? 0
      : selectedRoomData?.occupancy_stat === "Empty"
      ? 1
      : 0;

  const displayedAlerts =
    selectedRoomFilter === "All" ? activeAlerts.length : roomSpecificAlerts.length;

  const cleaningPriorityRooms = useMemo(() => {
    const source = selectedRoomFilter === "All" ? rooms : [selectedRoomData].filter(Boolean);

    return source.filter((room) => {
      const occupancy = String(room.occupancy_stat || "").toLowerCase();
      return room.needs_inspection || occupancy === "empty";
    });
  }, [rooms, selectedRoomFilter, selectedRoomData]);

  const displayedPriority = cleaningPriorityRooms.length;

  const patternRows = useMemo(() => {
    const map = new Map((wardenPatterns || []).map((item) => [item.day, item]));

    return ORDERED_DAYS.map((day) => {
      return (
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

    return [...actualRows, ...predictedRows].sort((a, b) =>
      String(a.date).localeCompare(String(b.date))
    );
  }, [wardenHistory, wardenForecasts]);

  if (loading) return <LoadingState />;

  return (
    <div className="page-grid owner-dashboard">
      <div className="filter-bar warden-filter-bar">
        <label>
          Floor
          <select
            value={selectedFloor}
            onChange={(e) => {
              setSelectedFloor(e.target.value);
              setSelectedRoomFilter("All");
            }}
          >
            {floors.map((floor) => (
              <option key={floor} value={floor}>
                {floor}
              </option>
            ))}
          </select>
        </label>

        <label>
          Room
          <select value={selectedRoomFilter} onChange={(e) => setSelectedRoomFilter(e.target.value)}>
            {dynamicRoomOptions.map((roomId) => (
              <option key={roomId} value={roomId}>
                {roomId}
              </option>
            ))}
          </select>
        </label>

        <label>
          View
          <select
            value={onlyAttention ? "attention" : "all"}
            onChange={(e) => setOnlyAttention(e.target.value === "attention")}
          >
            <option value="all">All Rooms</option>
            <option value="attention">Needs Action Only</option>
          </select>
        </label>
      </div>

      {error ? (
        <div className="warden-error-box">
          <strong>Dashboard error:</strong> {error}
          <button className="warden-retry-btn" onClick={fetchAllData}>
            Retry
          </button>
        </div>
      ) : null}

      <div className="stats-grid">
        <KpiCardButton onClick={() => setSelectedKpi("occupied")} title="Click to drill down occupied rooms">
          <StatCard title="Occupied Rooms" value={displayedOccupied} subtitle="From summary API" icon={<HiOutlineHomeModern />} tone="blue" />
        </KpiCardButton>

        <KpiCardButton onClick={() => setSelectedKpi("empty")} title="Click to drill down empty rooms">
          <StatCard title="Empty Rooms" value={displayedEmpty} subtitle="Useful for cleaning allocation" icon={<HiOutlineHomeModern />} tone="green" />
        </KpiCardButton>

        <KpiCardButton onClick={() => setSelectedKpi("alerts")} title="Click to drill down active alerts">
          <StatCard title="ML Active Alerts" value={displayedAlerts} subtitle="From IsolationForest alerts" icon={<HiOutlineSpeakerWave />} tone="orange" />
        </KpiCardButton>

        <KpiCardButton onClick={() => setSelectedKpi("priority")} title="Click to drill down cleaning priority">
          <StatCard title="Cleaning Priority" value={displayedPriority} subtitle="Rooms that need action" icon={<HiOutlineWrenchScrewdriver />} tone="red" />
        </KpiCardButton>
      </div>

      <div className="stats-grid">
        <StatCard
          title="Data Range"
          value={`${formatNumber(dataRange?.total_days_covered || 0, 1)} days`}
          subtitle={dataRange?.is_valid_5_to_7_days_or_more ? "Valid 5–7+ days" : "Not enough data"}
          icon={<HiOutlineWrenchScrewdriver />}
          tone="blue"
        />
      </div>

      <div className="owner-top-grid">
        <SectionCard title="Room Monitoring">
          {filteredRooms.length ? (
            <div className="room-tile-grid">
              {filteredRooms.map((room) => (
                <WardenRoomTile key={room.room_id} room={room} />
              ))}
            </div>
          ) : (
            <EmptyState text="No rooms match the selected filters." />
          )}
        </SectionCard>

        <SectionCard title="Active Alerts">
          {roomSpecificAlerts.length ? (
            <div className="alerts-list">
              {roomSpecificAlerts.map((alert, index) => (
                <WardenAlertCard
                  key={`${alert.room_id}-${alert.captured_at}-${index}`}
                  alert={alert}
                  onOpen={setSelectedAlert}
                />
              ))}
            </div>
          ) : (
            <EmptyState text="No ML alerts right now." />
          )}
        </SectionCard>
      </div>

      <div className="owner-top-grid">
        <SectionCard title="7-Day Occupancy Trend">
          {occupancyTrend.length ? (
            <div className="chart-shell">
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={occupancyTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#d9e1ec" />
                  <XAxis dataKey="label" tick={{ fill: "#64748b", fontSize: 12 }} />
                  <YAxis tick={{ fill: "#64748b", fontSize: 12 }} />
                  <Tooltip contentStyle={chartTooltipStyle} />
                  <Legend />
                  <Bar dataKey="occupied" name="Occupied" fill="#2563eb" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="empty" name="Empty" fill="#16a34a" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState text="No occupancy trend data available." />
          )}
        </SectionCard>

        <SectionCard title="7-Day Noise Trend">
          {adjustedNoiseTrend.length ? (
            <div className="chart-shell">
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={adjustedNoiseTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#d9e1ec" />
                  <XAxis dataKey="label" tick={{ fill: "#64748b", fontSize: 12 }} />
                  <YAxis tick={{ fill: "#64748b", fontSize: 12 }} />
                  <Tooltip contentStyle={chartTooltipStyle} />
                  <Legend />
                  <Bar dataKey="normal" name="Normal" fill="#16a34a" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="critical" name="Critical" fill="#ef4444" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState text="No recent noise trend data available." />
          )}
        </SectionCard>
      </div>

      <SectionCard title="Historical and Forecasted Room Trend">
        {forecastChartData.length ? (
          <div className="chart-shell owner-forecast-chart-shell">
            <ResponsiveContainer width="100%" height={360}>
              <LineChart data={forecastChartData} margin={{ top: 10, right: 24, left: 6, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#d9e1ec" />
                <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 11 }} minTickGap={24} />
                <YAxis tick={{ fill: "#64748b", fontSize: 11 }} allowDecimals={false} />
                <Tooltip contentStyle={chartTooltipStyle} />
                <Legend content={renderForecastLegend} />
                <Line type="monotone" dataKey="actual_occupancy" name="Actual Occupancy" stroke="#2563eb" strokeWidth={2.4} dot={false} connectNulls />
                <Line type="monotone" dataKey="actual_warnings" name="Actual Warnings" stroke="#f59e0b" strokeWidth={2.2} dot={false} connectNulls />
                <Line type="monotone" dataKey="predicted_occupancy" name="Predicted Occupancy" stroke="#2563eb" strokeWidth={2.4} strokeDasharray="7 5" dot={false} connectNulls />
                <Line type="monotone" dataKey="predicted_warnings" name="Predicted Warnings" stroke="#f59e0b" strokeWidth={2.2} strokeDasharray="7 5" dot={false} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyState text="No forecast or history data available." />
        )}
      </SectionCard>

      <SectionCard title="Weekly Pattern Discovery">
        <DataTable
          columns={[
            { key: "day", label: "Day" },
            { key: "day_type", label: "Type" },
            { key: "usual_pattern", label: "Usual Pattern", render: (row) => <HistoryWord value={row.usual_pattern} /> },
            { key: "avg_occupancy", label: "Avg Occupancy", render: (row) => formatNumber(row.avg_occupancy) },
            { key: "avg_noise_level", label: "Avg Noise Level", render: (row) => formatNumber(row.avg_noise_level) },
            { key: "avg_warnings", label: "Avg Warnings", render: (row) => formatNumber(row.avg_warnings) },
            { key: "avg_critical_ratio", label: "Avg Critical Ratio", render: (row) => `${formatNumber(row.avg_critical_ratio)}%` },
            { key: "cluster_id", label: "Cluster" }
          ]}
          rows={patternRows}
        />
      </SectionCard>

      <SectionCard title="Abnormal / Anomaly Records">
        {wardenAnomalies.length ? (
          <DataTable
            columns={[
              { key: "room_id", label: "Room" },
              { key: "date", label: "Date" },
              { key: "status", label: "Status", render: (row) => <HistoryWord value={row.status || "Abnormal"} /> },
              { key: "anomaly_score", label: "Score", render: (row) => formatNumber(row.anomaly_score, 3) },
              { key: "reason", label: "Reason" }
            ]}
            rows={wardenAnomalies.slice(0, 12)}
          />
        ) : (
          <EmptyState text="No anomaly records available." />
        )}
      </SectionCard>

      {selectedKpi ? (
        <div className="warden-modal-overlay" onClick={() => setSelectedKpi(null)}>
          <div className="warden-modal" onClick={(e) => e.stopPropagation()}>
            <div className="warden-modal-head">
              <h3>
                {selectedKpi === "occupied" && "Occupied Rooms"}
                {selectedKpi === "empty" && "Empty Rooms"}
                {selectedKpi === "alerts" && "Active Alerts"}
                {selectedKpi === "priority" && "Cleaning Priority"}
              </h3>
              <button onClick={() => setSelectedKpi(null)}>Close</button>
            </div>

            {selectedKpi === "occupied" ? (
              <DataTable
                columns={[
                  { key: "room_id", label: "Room" },
                  { key: "occupancy_stat", label: "Occupancy", render: (row) => <StatusBadge value={row.occupancy_stat} /> },
                  { key: "noise_stat", label: "Noise", render: (row) => <HistoryWord value={row.noise_stat} /> },
                  { key: "captured_at", label: "Updated", render: (row) => (row.captured_at ? formatDate(row.captured_at) : "No Data") }
                ]}
                rows={occupiedRows}
              />
            ) : null}

            {selectedKpi === "empty" ? (
              <DataTable
                columns={[
                  { key: "room_id", label: "Room" },
                  { key: "occupancy_stat", label: "Occupancy", render: (row) => <StatusBadge value={row.occupancy_stat} /> },
                  { key: "door_status", label: "Door", render: (row) => <StatusBadge value={row.door_status} /> },
                  { key: "captured_at", label: "Updated", render: (row) => (row.captured_at ? formatDate(row.captured_at) : "No Data") }
                ]}
                rows={emptyRows.length ? emptyRows : [selectedRoomData].filter(Boolean)}
              />
            ) : null}

            {selectedKpi === "alerts" ? (
              roomSpecificAlerts.length ? (
                <div className="alerts-list">
                  {roomSpecificAlerts.map((alert, index) => (
                    <WardenAlertCard
                      key={`${alert.room_id}-${alert.captured_at}-modal-${index}`}
                      alert={alert}
                      onOpen={setSelectedAlert}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState text="No active ML alerts right now." />
              )
            ) : null}

            {selectedKpi === "priority" ? (
              cleaningPriorityRooms.length > 0 ? (
                <DataTable
                  columns={[
                    { key: "room_id", label: "Room" },
                    { key: "occupancy_stat", label: "Occupancy", render: (row) => <StatusBadge value={row.occupancy_stat} /> },
                    {
                      key: "priority_type",
                      label: "Priority Type",
                      render: (row) =>
                        String(row.occupancy_stat || "").toLowerCase() === "empty"
                          ? "Empty Room Cleaning"
                          : "Inspection Required"
                    },
                    {
                      key: "inspection_reasons",
                      label: "Reason",
                      render: (row) =>
                        String(row.occupancy_stat || "").toLowerCase() === "empty" &&
                        !(row.inspection_reasons || []).length
                          ? "Room is empty and ready for cleaning"
                          : renderReasons(row.inspection_reasons)
                    }
                  ]}
                  rows={cleaningPriorityRooms}
                />
              ) : (
                <EmptyState text="No cleaning priority rooms." />
              )
            ) : null}
          </div>
        </div>
      ) : null}

      {selectedAlert ? (
        <div className="warden-modal-overlay" onClick={() => setSelectedAlert(null)}>
          <div className="warden-modal" onClick={(e) => e.stopPropagation()}>
            <div className="warden-modal-head">
              <h3>{selectedAlert.title}</h3>
              <button onClick={() => setSelectedAlert(null)}>Close</button>
            </div>

            <div className="warden-single-room-grid">
              <div className="warden-single-room-card">
                <h4>ML Alert Details</h4>
                <p><strong>Room:</strong> {selectedAlert.room_id}</p>
                <p><strong>Severity:</strong> {selectedAlert.severity}</p>
                <p><strong>Model:</strong> {selectedAlert.model_name || "IsolationForest"}</p>
                <p><strong>Confidence:</strong> {Math.round(Number(selectedAlert.confidence || 0) * 100)}%</p>
                <p><strong>Reason:</strong> {selectedAlert.message}</p>
                <p>
                  <strong>Detected At:</strong>{" "}
                  {selectedAlert.captured_at ? formatDate(selectedAlert.captured_at) : "No Data"}
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <ChatAssistant roomId={selectedRoomFilter} />
    </div>
  );
}