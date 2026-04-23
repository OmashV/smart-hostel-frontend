import { useEffect, useMemo, useRef, useState } from "react";
import {
  HiOutlineBellAlert,
  HiOutlineExclamationTriangle,
  HiOutlineHomeModern,
  HiOutlineSpeakerWave,
  HiOutlineWrenchScrewdriver
} from "react-icons/hi2";
import {
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  AreaChart,
  Area,
  LineChart,
  Line,
  ComposedChart,
  BarChart,
  Bar
} from "recharts";
import {
  getAvailableFloors,
  getAvailableRooms,
  getWardenInspectionQueue,
  getWardenNoiseIssues,
  getWardenNoiseTrend,
  getWardenRoomsStatus,
  getWardenSummary,
  getWardenFeatureImportance,
  getWardenAnomalies,
  getWardenPatterns,
  getWardenForecasts,
  getWardenHistory,
} from "../api/client";
import StatCard from "../components/StatCard";
import SectionCard from "../components/SectionCard";
import StatusBadge from "../components/StatusBadge";
import DataTable from "../components/DataTable";
import LoadingState from "../components/LoadingState";
import EmptyState from "../components/EmptyState";
import { formatDate } from "../utils/format";

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
    dates.push(d.toLocaleDateString("en-CA", { timeZone: "Asia/Colombo" }));
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
    const avgSoundPeak = Number(found?.avg_sound_peak || 0);

    const criticalNoiseCount = Math.max(
      warning + violation,
      avgSoundPeak >= 70 ? 1 : 0
    );

    const totalBase = selectedRoom === "All" ? occupied + empty : 1;

    return {
      date,
      label: toShortLabel(date),
      occupied_count: occupied,
      empty_count: empty,
      warning_count: warning,
      violation_count: violation,
      avg_sound_peak: avgSoundPeak,
      avg_current: Number(found?.avg_current || 0),
      inspection_count: Number(found?.inspection_count || 0),
      critical_noise_count: criticalNoiseCount,
      normal_noise_count: Math.max(totalBase - criticalNoiseCount, 0)
    };
  });
}

function historyTone(text = "") {
  const lower = String(text).toLowerCase();

  if (lower.includes("critical")) return "danger";
  if (lower.includes("warning")) return "warning";
  if (lower.includes("normal")) return "ok";
  return "neutral";
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

function isNoiseProblem(room) {
  const reasons = room.inspection_reasons || [];
  const noiseStat = String(room.noise_stat || "").toLowerCase();

  return (
    noiseStat.includes("violation") ||
    noiseStat.includes("complaint") ||
    noiseStat.includes("warning") ||
    reasons.some((r) => {
      const text = r.toLowerCase();
      return text.includes("noise") || text.includes("complaint") || text.includes("violation");
    })
  );
}

function isWasteProblem(room) {
  const reasons = room.inspection_reasons || [];
  const wasteStat = String(room.waste_stat || "").toLowerCase();

  return (
    wasteStat.includes("critical") ||
    wasteStat.includes("warning") ||
    reasons.some((r) => {
      const text = r.toLowerCase();
      return text.includes("waste") || text.includes("energy");
    })
  );
}

function getAlertMeta(room) {
  const reasons = room.inspection_reasons || [];
  const alerts = [];

  const criticalWaste = isWasteProblem(room);
  const criticalNoise = isNoiseProblem(room);

  if (criticalWaste) {
    alerts.push({
      room_id: room.room_id,
      severity: "Critical",
      title: "Critical Waste",
      message: "Energy usage detected in an empty or idle room.",
      captured_at: room.captured_at,
      occupancy_stat: room.occupancy_stat,
      waste_stat: room.waste_stat,
      current_amp: room.current_amp,
      door_status: room.door_status,
      sensor_faults: room.sensor_faults,
      inspection_reasons: reasons
    });
  }

  if (criticalNoise) {
    alerts.push({
      room_id: room.room_id,
      severity: "Critical",
      title: "Critical Noise",
      message: "High noise level or complaint detected.",
      captured_at: room.captured_at,
      occupancy_stat: room.occupancy_stat,
      noise_stat: room.noise_stat,
      sound_peak: room.sound_peak,
      door_status: room.door_status,
      sensor_faults: room.sensor_faults,
      inspection_reasons: reasons
    });
  }

  if (!alerts.length && reasons.length) {
    alerts.push({
      room_id: room.room_id,
      severity: "Warning",
      title: reasons[0],
      message: renderReasons(reasons),
      captured_at: room.captured_at,
      occupancy_stat: room.occupancy_stat,
      noise_stat: room.noise_stat,
      waste_stat: room.waste_stat,
      current_amp: room.current_amp,
      sound_peak: room.sound_peak,
      door_status: room.door_status,
      sensor_faults: room.sensor_faults,
      inspection_reasons: reasons
    });
  }

  return alerts;
}

function historyTone(value = "") {
  const text = String(value || "").toLowerCase();
  if (
    text.includes("critical") ||
    text.includes("violation") ||
    text.includes("fault") ||
    text.includes("alert")
  ) return "danger";
  if (
    text.includes("warning") ||
    text.includes("complaint") ||
    text.includes("attention") ||
    text.includes("empty")
  ) return "warning";
  if (text.includes("occupied") || text.includes("normal") || text.includes("stable")) return "ok";
  return "info";
}

function HistoryWord({ value }) {
  return <span className={`history-word ${historyTone(value)}`}>{value || "-"}</span>;
}

function HistoryTags({ reasons = [] }) {
  if (!reasons.length) return <span className="history-word neutral">No issues</span>;

  return (
    <div className="history-tags">
      {reasons.slice(0, 3).map((reason, index) => (
        <span key={`${reason}-${index}`} className={`history-word ${historyTone(reason)}`}>
          {reason}
        </span>
      ))}
    </div>
  );
}

const chartTooltipStyle = {
  background: "#ffffff",
  border: "1px solid #dbe2ea",
  borderRadius: "12px",
  color: "#172033",
  boxShadow: "0 10px 24px rgba(15, 23, 42, 0.08)"
};

function renderForecastLegend({ payload = [] }) {
  return (
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
}
function AlertSummaryTile({ title, count, tone, subtitle }) {
  return (
    <div className={`warden-alert-summary ${tone}`}>
      <div className="warden-alert-summary-head">
        <span>{title}</span>
        <strong>{count}</strong>
      </div>
      <p>{subtitle}</p>
    </div>
  );
}

function WardenAlertCard({ alert, onOpen }) {
  const cls =
    alert.severity === "Critical"
      ? "alert-card critical"
      : alert.severity === "Warning"
      ? "alert-card warning"
      : "alert-card info";

  const icon =
    alert.severity === "Critical" ? (
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

function WardenRoomTile({ room }) {
  const tileClass =
    String(room.noise_stat || "").toLowerCase().includes("violation") ||
    String(room.waste_stat || "").toLowerCase().includes("critical")
      ? "owner-room-tile critical"
      : room.needs_inspection
      ? "owner-room-tile warning"
      : "owner-room-tile normal";

  return (
    <div className={`${tileClass} warden-room-tile`} title={`${room.room_id} current status`}>
      <div className="tile-top">
        <div>
          <h3>{room.room_id}</h3>
          <p className="tile-subtext">Room monitoring</p>
        </div>
        <span
          className={`tile-dot ${
            String(room.noise_stat || "").toLowerCase().includes("violation") ||
            String(room.waste_stat || "").toLowerCase().includes("critical")
              ? "red"
              : room.needs_inspection
              ? "orange"
              : "green"
          }`}
        />
      </div>

      {room.needs_inspection ? (
        <div className="tile-alert-pill">
          {room.inspection_reasons?.length || 1} Alert
        </div>
      ) : null}

      <div className="tile-metrics">
        <div className="tile-row">
          <span>Occupancy</span>
          <strong>{room.occupancy_stat}</strong>
        </div>
        <div className="tile-row">
          <span>Noise</span>
          <strong>{room.noise_stat}</strong>
        </div>
        <div className="tile-row">
          <span>Door</span>
          <strong>{room.door_status}</strong>
        </div>
        <div className="tile-row">
          <span>Current</span>
          <strong>{room.current_amp} A</strong>
        </div>
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

function KpiCardButton({ children, onClick, title }) {
  return (
    <button
      type="button"
      className="warden-kpi-button"
      onClick={onClick}
      title={title}
    >
      {children}
    </button>
  );
}

export default function WardenDashboard() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [inspectionQueue, setInspectionQueue] = useState([]);
  const [noiseTrend, setNoiseTrend] = useState([]);
  const [wardenHistory, setWardenHistory] = useState([]);
  const [error, setError] = useState("");

  const [selectedFloor, setSelectedFloor] = useState("All");
  const [floorOptions, setFloorOptions] = useState(["All"]);
  const [roomOptions, setRoomOptions] = useState(["All"]);
  const [selectedRoomFilter, setSelectedRoomFilter] = useState("All");
  const [onlyAttention, setOnlyAttention] = useState(false);

  const [selectedKpi, setSelectedKpi] = useState(null);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [alertHistory, setAlertHistory] = useState([]);
  const [wardenForecasts, setWardenForecasts] = useState([]);
  const [wardenAnomalies, setWardenAnomalies] = useState([]);
  const [wardenPatterns, setWardenPatterns] = useState([]);
  const [wardenFeatureImportance, setWardenFeatureImportance] = useState([]);

  const selectedRoomFilterRef = useRef(selectedRoomFilter);
  useEffect(() => {
    selectedRoomFilterRef.current = selectedRoomFilter;
  }, [selectedRoomFilter]);

  useEffect(() => {
    async function loadFilterOptions() {
      try {
        const floorRes = await getAvailableFloors();
        setFloorOptions(["All", ...(floorRes?.floors || [])]);
      } catch (_) {}
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
      } catch (_) {}
    }
    loadRoomsForFloor();
  }, [selectedFloor]);

  async function load() {
    try {
      setError("");

      const [
        summaryRes,
        roomsRes,
        _noiseRes,
        inspectionRes,
        trendRes,
        forecastRes,
        anomalyRes,
        patternRes,
        featureImportanceRes,
        historyRes
      ] = await Promise.all([
        getWardenSummary(),
        getWardenRoomsStatus(),
        getWardenNoiseIssues(),
        getWardenInspectionQueue(),
        getWardenNoiseTrend(7),
        getWardenForecasts(),
        getWardenAnomalies(),
        getWardenPatterns(),
        getWardenFeatureImportance(),
        getWardenHistory(7, selectedRoomFilterRef.current)
      ]);

      const latestRooms = roomsRes.rooms || [];
      const latestInspection = inspectionRes.rooms || [];
      const latestNoiseTrend = trendRes.trend || [];

      setSummary(summaryRes);
      setRooms(latestRooms);
      setInspectionQueue(latestInspection);
      setNoiseTrend(latestNoiseTrend);
      setWardenForecasts(forecastRes.items || []);
      setWardenAnomalies(anomalyRes.items || []);
      setWardenPatterns(patternRes.items || []);
      setWardenFeatureImportance(featureImportanceRes.items || []);
      setWardenHistory(historyRes.items || []);

      const currentRoomFilter = selectedRoomFilterRef.current;
      const scopedInspection =
        currentRoomFilter === "All"
          ? latestInspection
          : latestInspection.filter((row) => row.room_id === currentRoomFilter);

      const snapshotTime = new Date();

      const noiseCriticalCount = scopedInspection
  .flatMap((room) => getAlertMeta(room))
  .filter((alert) => alert.title === "Critical Noise").length;

const wasteCriticalCount = scopedInspection
  .flatMap((room) => getAlertMeta(room))
  .filter((alert) => alert.title === "Critical Waste").length;

      const historyEntry =
        currentRoomFilter === "All"
          ? {
              history_id: `snapshot-${snapshotTime.toISOString()}`,
              snapshot_time: snapshotTime.toISOString(),
              room_id: "All Rooms",
              occupancy_stat: `${summaryRes?.occupied_rooms ?? 0} Occupied`,
noise_stat: noiseCriticalCount > 0 ? `${noiseCriticalCount} Critical` : "Normal",
waste_stat: wasteCriticalCount > 0 ? `${wasteCriticalCount} Critical` : "Normal",
inspection_reasons: [
  `${scopedInspection.length} active rooms`,
  `${noiseCriticalCount} noise critical`,
  `${wasteCriticalCount} waste critical`
]
            }
          : (() => {
              const roomData =
                latestRooms.find((room) => room.room_id === currentRoomFilter) ||
                makeEmptyRoom(currentRoomFilter);

              return {
                history_id: `snapshot-${currentRoomFilter}-${snapshotTime.toISOString()}`,
                snapshot_time: snapshotTime.toISOString(),
                room_id: roomData.room_id,
                occupancy_stat: roomData.occupancy_stat,
                noise_stat:
  Number(roomData.sound_peak || 0) >= 70 ||
  String(roomData.noise_stat || "").toLowerCase().includes("violation") ||
  String(roomData.noise_stat || "").toLowerCase().includes("warning")
    ? "Critical"
    : "Normal",
waste_stat:
  String(roomData.waste_stat || "").toLowerCase().includes("critical")
    ? "Critical"
    : "Normal",
                inspection_reasons: roomData.inspection_reasons || []
              };
            })();

      setAlertHistory((prev) => {
        if (!prev.length) return [historyEntry];
        const last = new Date(prev[0].snapshot_time).getTime();
        const current = snapshotTime.getTime();
        if (current - last < 7900) return prev;
        return [historyEntry, ...prev].slice(0, 60);
      });
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
    let timeoutId;
    let cancelled = false;

    async function loop() {
      const start = Date.now();
      await load();
      if (cancelled) return;
      const elapsed = Date.now() - start;
      const delay = Math.max(8000 - elapsed, 0);
      timeoutId = setTimeout(loop, delay);
    }

    setLoading(true);
    setAlertHistory([]);
    loop();

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
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
    const scoped =
      selectedRoomFilter === "All"
        ? inspectionQueue
        : inspectionQueue.filter((row) => row.room_id === selectedRoomFilter);

    return scoped
      .slice()
      .sort((a, b) => new Date(b.captured_at).getTime() - new Date(a.captured_at).getTime())
      .flatMap((room) => getAlertMeta(room))
      .slice(0, 8);
  }, [inspectionQueue, selectedRoomFilter]);
  const alertSummary = useMemo(() => {
  const source =
    selectedRoomFilter === "All"
      ? activeAlerts
      : activeAlerts.filter((alert) => alert.room_id === selectedRoomFilter);

  const criticalWaste = source.filter((alert) => alert.title === "Critical Waste").length;
  const criticalNoise = source.filter((alert) => alert.title === "Critical Noise").length;

  return { criticalWaste, criticalNoise };
}, [activeAlerts, selectedRoomFilter]);

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

  const adjustedNoiseTrend = useMemo(() => {
    if (wardenHistory.length) {
      return wardenHistory.map((item) => ({
        date: item.date,
        warnings: Number(item.warning_count || 0),
        violations: Number(item.violation_count || 0)
      }));
    }

    return noiseTrend.map((item) => ({
      date: item.date,
      warnings: Number(item.warning_count || 0),
      violations: Number(item.violation_count || 0)
    }));
  }, [wardenHistory, noiseTrend]);

  const occupancyTrend = useMemo(() => {
    return wardenHistory.map((item) => ({
      date: item.date,
      occupied: Number(item.occupied_count || 0),
      empty: Number(item.empty_count || 0)
    }));
  }, [wardenHistory]);

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

  const displayedAlerts = selectedRoomFilter === "All" ? activeAlerts.length : roomSpecificAlerts.length;

  const cleaningPriorityRooms = useMemo(() => {
    const source = selectedRoomFilter === "All" ? rooms : [selectedRoomData].filter(Boolean);
    return source.filter((room) => {
      const occupancy = String(room.occupancy_stat || "").toLowerCase();
      return room.needs_inspection || occupancy === "empty";
    });
  }, [rooms, selectedRoomFilter, selectedRoomData]);

  const displayedPriority = cleaningPriorityRooms.length;

  const filteredForecasts = useMemo(() => {
    if (selectedRoomFilter === "All") return [];
    return wardenForecasts.filter((item) => item.room_id === selectedRoomFilter);
  }, [wardenForecasts, selectedRoomFilter]);

  const filteredAnomalies = useMemo(() => {
    if (selectedRoomFilter === "All") return [];
    return wardenAnomalies.filter((item) => item.room_id === selectedRoomFilter);
  }, [wardenAnomalies, selectedRoomFilter]);

  const filteredPatterns = useMemo(() => {
    if (selectedRoomFilter === "All") return [];
    return wardenPatterns.filter((item) => item.room_id === selectedRoomFilter);
  }, [wardenPatterns, selectedRoomFilter]);

  const filteredFeatureImportance = useMemo(() => {
    if (selectedRoomFilter === "All") return [];
    return wardenFeatureImportance
      .filter((item) => !item.room_id || item.room_id === selectedRoomFilter)
      .slice()
      .sort((a, b) => Number(b.importance || 0) - Number(a.importance || 0));
  }, [wardenFeatureImportance, selectedRoomFilter]);

  const roomForecastChartData = useMemo(() => {
    if (selectedRoomFilter === "All") return [];

    const actualMap = new Map();
    wardenHistory.forEach((item) => {
      actualMap.set(item.date, {
        date: item.date,
        warning_count: Number(item.warning_count || 0),
        violation_count: Number(item.violation_count || 0),
        occupied_count: Number(item.occupied_count || 0)
      });
    });

    filteredForecasts.forEach((item) => {
      const current = actualMap.get(item.date) || { date: item.date };
      current.predicted_warning_count = Number(item.predicted_warning_count || 0);
      current.predicted_violation_count = Number(item.predicted_violation_count || 0);
      current.predicted_occupied_count = Number(item.predicted_occupied_count || 0);
      actualMap.set(item.date, current);
    });

    return Array.from(actualMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [selectedRoomFilter, wardenHistory, filteredForecasts]);

  const forecastSplitDate = useMemo(() => {
    if (!filteredForecasts.length) return null;
    return filteredForecasts[0]?.date || null;
  }, [filteredForecasts]);

  const patternRows = useMemo(() => {
    return filteredPatterns.map((item, index) => ({
      id: `${item.pattern_name || item.weekday_name || index}-${index}`,
      weekday_name: item.weekday_name || item.day || item.pattern_name || "Unknown",
      day_type: item.day_type || "Monitoring",
      usual_pattern: item.usual_pattern || item.pattern_name || "Pattern Detected",
      avg_warning_count: Number(item.avg_warning_count ?? item.warning_count ?? 0),
      avg_violation_count: Number(item.avg_violation_count ?? item.violation_count ?? 0),
      avg_occupied_count: Number(item.avg_occupied_count ?? item.predicted_occupied_count ?? 0)
    }));
  }, [filteredPatterns]);

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
          <div>
            <strong>Dashboard error:</strong> {error}
          </div>
          <button className="warden-retry-btn" onClick={load}>
            Retry
          </button>
        </div>
      ) : null}

      <div className="stats-grid">
        <KpiCardButton onClick={() => setSelectedKpi("occupied")} title="Click to drill down occupied rooms">
          <StatCard title="Occupied Rooms" value={displayedOccupied} subtitle="Current occupied rooms" icon={<HiOutlineHomeModern />} tone="blue" />
        </KpiCardButton>
        <KpiCardButton onClick={() => setSelectedKpi("empty")} title="Click to drill down empty rooms">
          <StatCard title="Empty Rooms" value={displayedEmpty} subtitle="Useful for cleaning allocation" icon={<HiOutlineHomeModern />} tone="green" />
        </KpiCardButton>
        <KpiCardButton onClick={() => setSelectedKpi("alerts")} title="Click to drill down active alerts">
          <StatCard title="Active Alerts" value={displayedAlerts} subtitle="Critical waste and critical noise" icon={<HiOutlineSpeakerWave />} tone="orange" />
        </KpiCardButton>
        <KpiCardButton onClick={() => setSelectedKpi("priority")} title="Click to drill down cleaning priority">
          <StatCard title="Cleaning Priority" value={displayedPriority} subtitle="Rooms that need action" icon={<HiOutlineWrenchScrewdriver />} tone="red" />
        </KpiCardButton>
      </div>

      {selectedRoomFilter === "All" ? (
        <>
          <div className="warden-analysis-stack">
  <SectionCard title="Historical and Forecasted Room Trend">
    {forecastChartData.length || sevenDayHistory.length ? (
      <div className="chart-shell">
        <ResponsiveContainer width="100%" height={360}>
          <ComposedChart
            data={sevenDayHistory.map((item) => {
              const forecastRow = forecastChartData.find((f) => f.date === item.date) || {};
              return {
                ...item,
                predicted_occupied_count: Number(forecastRow.predicted_occupied_count || 0),
                predicted_warning_count: Number(forecastRow.predicted_warning_count || 0),
                predicted_violation_count: Number(forecastRow.predicted_violation_count || 0)
              };
            })}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#d9e1ec" />
            <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: "#e2e8f0" }} />
            <YAxis tickLine={false} axisLine={{ stroke: "#e2e8f0" }} />
            <Tooltip />
            <Legend />
            <Bar
              dataKey="occupied_count"
              name="Actual Occupied"
              radius={[6, 6, 0, 0]}
              fill="#2563eb"
            />
            <Line
              type="monotone"
              dataKey="predicted_occupied_count"
              name="Predicted Occupied"
              stroke="#2563eb"
              strokeWidth={2.5}
              strokeDasharray="8 6"
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="critical_noise_count"
              name="Actual Critical Noise"
              stroke="#ef4444"
              strokeWidth={2.5}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="predicted_violation_count"
              name="Predicted Critical Noise"
              stroke="#ef4444"
              strokeWidth={2.5}
              strokeDasharray="8 6"
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    ) : (
      <EmptyState text="No forecast data available." />
    )}
  </SectionCard>

  <SectionCard title="Anomaly Detection">
    {anomalyChartData.length ? (
      <div className="chart-shell">
        <ResponsiveContainer width="100%" height={340}>
          <BarChart data={anomalyChartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip
              formatter={(value, name, payload) => [
                `${Number(value).toFixed(3)} | ${payload?.payload?.reason || "No reason"}`,
                name
              ]}
            />
            <Legend />
            <Bar
              dataKey="anomaly_score"
              name="Anomaly Score"
              radius={[6, 6, 0, 0]}
              fill="#ef4444"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    ) : (
      <EmptyState text="No anomaly data available." />
    )}
  </SectionCard>

  <SectionCard title="Usage / Behavior Pattern Analysis">
    {patternChartData.length ? (
      <div className="chart-shell">
        <ResponsiveContainer width="100%" height={340}>
          <BarChart data={patternChartData} layout="vertical" margin={{ left: 30 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" allowDecimals={false} />
            <YAxis dataKey="pattern_name" type="category" width={140} />
            <Tooltip formatter={(value) => [`${value} records`, "Pattern Frequency"]} />
            <Legend />
            <Bar
              dataKey="count"
              name="Pattern Frequency"
              radius={[0, 6, 6, 0]}
              fill="#6366f1"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    ) : (
      <EmptyState text="No pattern analysis data available." />
    )}
  </SectionCard>

  <SectionCard title="Correlation / Feature Importance">
    {wardenFeatureImportance.length ? (
      <div className="chart-shell">
        <ResponsiveContainer width="100%" height={340}>
          <BarChart data={wardenFeatureImportance} layout="vertical" margin={{ left: 50 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" />
            <YAxis dataKey="feature" type="category" width={140} />
            <Tooltip formatter={(value) => [Number(value).toFixed(4), "Importance"]} />
            <Legend />
            <Bar
              dataKey="importance"
              name="Importance"
              radius={[0, 6, 6, 0]}
              fill="#22c55e"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    ) : (
      <EmptyState text="No feature importance data available." />
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
                      <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 12 }} tickLine={false} axisLine={{ stroke: "#e2e8f0" }} />
                      <YAxis tick={{ fill: "#64748b", fontSize: 12 }} tickLine={false} axisLine={{ stroke: "#e2e8f0" }} />
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
                    <AreaChart data={adjustedNoiseTrend}>
                      <defs>
                        <linearGradient id="warningFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.05} />
                        </linearGradient>
                        <linearGradient id="violationFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ef4444" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#ef4444" stopOpacity={0.05} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#d9e1ec" />
                      <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 12 }} tickLine={false} axisLine={{ stroke: "#e2e8f0" }} />
                      <YAxis tick={{ fill: "#64748b", fontSize: 12 }} tickLine={false} axisLine={{ stroke: "#e2e8f0" }} />
                      <Tooltip contentStyle={chartTooltipStyle} />
                      <Legend />
                      <Area
  type="monotone"
  dataKey="normal"
  name="Normal"
  stroke="#16a34a"
  fill="#16a34a"
  fillOpacity={0.18}
  strokeWidth={2}
/>
<Area
  type="monotone"
  dataKey="critical"
  name="Critical"
  stroke="#ef4444"
  fill="url(#violationFill)"
  strokeWidth={2}
/>
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyState text="No recent noise trend data available." />
              )}
            </SectionCard>
          </div>
        </>
      ) : (
        <>
          <div className="owner-top-grid">
            <SectionCard title={`Room Overview - ${selectedRoomFilter}`}>
  <div className="warden-room-hero">
    <div className="warden-room-hero-top">
      <div>
        <p className="warden-room-eyebrow">Detailed room monitoring</p>
        <h3>{selectedRoomData.room_id}</h3>
        <p className="warden-room-meta">
          Last activity{" "}
          {selectedRoomData.captured_at ? formatDate(selectedRoomData.captured_at) : "No Data"}
        </p>
      </div>

      <div className="tile-badges">
        <StatusBadge value={selectedRoomData.occupancy_stat} />
        <StatusBadge value={selectedRoomData.noise_stat} />
        <StatusBadge value={selectedRoomData.waste_stat} />
        <StatusBadge value={selectedRoomData.door_status} />
      </div>
    </div>

    <div className="warden-room-hero-grid">
      <div className="warden-room-info-card">
        <span>Current</span>
        <strong>{selectedRoomData.current_amp} A</strong>
      </div>
      <div className="warden-room-info-card">
        <span>Sound Peak</span>
        <strong>{selectedRoomData.sound_peak}</strong>
      </div>
      <div className="warden-room-info-card">
        <span>Needs Action</span>
        <strong>{selectedRoomData.needs_inspection ? "Yes" : "No"}</strong>
      </div>
      <div className="warden-room-info-card">
        <span>Sensor Faults</span>
        <strong>{renderFaults(selectedRoomData.sensor_faults)}</strong>
      </div>
    </div>

    <div className="warden-room-notes">
      <span className="history-word neutral">Reasons</span>
      <p>{renderReasons(selectedRoomData.inspection_reasons)}</p>
    </div>
  </div>
</SectionCard>

            <SectionCard title={`Active Alerts - ${selectedRoomFilter}`}>
              {roomSpecificAlerts.length ? (
                <div className="alerts-list">
                  {roomSpecificAlerts.map((alert, index) => (
                    <WardenAlertCard key={`${alert.room_id}-${alert.title}-single-${index}`} alert={alert} onOpen={setSelectedAlert} />
                  ))}
                </div>
              ) : (
                <EmptyState text="No active alerts for this room right now." />
              )}
            </SectionCard>
          </div>

          <div className="owner-top-grid">
            <SectionCard title={`7-Day Occupancy Trend - ${selectedRoomFilter}`}>
              {occupancyTrend.length ? (
                <div className="chart-shell">
                  <ResponsiveContainer width="100%" height={320}>
                    <BarChart data={occupancyTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#d9e1ec" />
                      <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 12 }} tickLine={false} axisLine={{ stroke: "#e2e8f0" }} />
                      <YAxis tick={{ fill: "#64748b", fontSize: 12 }} tickLine={false} axisLine={{ stroke: "#e2e8f0" }} />
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

            <SectionCard title={`7-Day Noise Trend - ${selectedRoomFilter}`}>
              {adjustedNoiseTrend.length ? (
                <div className="chart-shell">
                  <ResponsiveContainer width="100%" height={320}>
                    <AreaChart data={adjustedNoiseTrend}>
                      <defs>
                        <linearGradient id="singleRoomWarningFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.05} />
                        </linearGradient>
                        <linearGradient id="singleRoomViolationFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ef4444" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#ef4444" stopOpacity={0.05} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#d9e1ec" />
                      <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 12 }} tickLine={false} axisLine={{ stroke: "#e2e8f0" }} />
                      <YAxis tick={{ fill: "#64748b", fontSize: 12 }} tickLine={false} axisLine={{ stroke: "#e2e8f0" }} />
                      <Tooltip contentStyle={chartTooltipStyle} />
                      <Legend />
                      <Area type="monotone" dataKey="warnings" name="Warnings" stroke="#f59e0b" fill="url(#singleRoomWarningFill)" strokeWidth={2.2} />
                      <Area type="monotone" dataKey="violations" name="Violations" stroke="#ef4444" fill="url(#singleRoomViolationFill)" strokeWidth={2.2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyState text="No recent noise trend data available." />
              )}
            </SectionCard>
          </div>
        </>
      )}

      <SectionCard title={`Recent Alerts History - ${selectedRoomFilter}`}>
        {alertHistory.length ? (
          <DataTable
            columns={[
              {
                key: "snapshot_time",
                label: "Recorded At",
                render: (row) => formatDate(row.snapshot_time)
              },
              { key: "room_id", label: "Room" },
              {
                key: "occupancy_stat",
                label: "Occupancy / Count",
                render: (row) => <HistoryWord value={row.occupancy_stat} />
              },
              {
                key: "noise_stat",
                label: "Noise / Critical",
                render: (row) => <HistoryWord value={row.noise_stat} />
              },
              {
                key: "waste_stat",
                label: "Waste / Warning",
                render: (row) => <HistoryWord value={row.waste_stat} />
              },
              {
                key: "inspection_reasons",
                label: "Summary",
                render: (row) => <HistoryTags reasons={row.inspection_reasons} />
              }
            ]}
            rows={alertHistory}
          />
        ) : (
          <EmptyState text="No alert history recorded yet." />
        )}
      </SectionCard>

      {selectedRoomFilter !== "All" ? (
        <div className="warden-analysis-zone">
          <SectionCard title={`Data Analysis & Insights - ${selectedRoomFilter}`}>
            <div className="owner-top-grid single-column-mobile">
              <SectionCard title="Historical and Forecasted Warden Trend">
                {roomForecastChartData.length ? (
                  <ResponsiveContainer width="100%" height={360}>
                    <ComposedChart data={roomForecastChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#d9e1ec" />
                      <XAxis dataKey="label" tick={{ fill: "#64748b", fontSize: 12 }} tickLine={false} axisLine={{ stroke: "#e2e8f0" }} />
                      <YAxis tick={{ fill: "#64748b", fontSize: 12 }} tickLine={false} axisLine={{ stroke: "#e2e8f0" }} />
                      <Tooltip contentStyle={chartTooltipStyle} />
                      {forecastSplitDate ? (
                        <ReferenceLine
                          x={forecastSplitDate}
                          stroke="#94a3b8"
                          strokeDasharray="4 4"
                          ifOverflow="visible"
                          label={{ value: "forecast", position: "insideTopLeft", fill: "#0f172a", fontSize: 13 }}
                        />
                      ) : null}
                      <Legend content={renderForecastLegend} />
                      <Line type="monotone" dataKey="warning_count" name="Actual Warnings" stroke="#f59e0b" strokeWidth={2.6} dot={false} connectNulls />
                      <Line type="monotone" dataKey="violation_count" name="Actual Violations" stroke="#ef4444" strokeWidth={2.2} dot={false} connectNulls />
                      <Line type="monotone" dataKey="occupied_count" name="Actual Occupancy" stroke="#2563eb" strokeWidth={2.6} dot={false} connectNulls />
                      <Line type="monotone" dataKey="predicted_warning_count" name="Predicted Warnings" stroke="#f59e0b" strokeWidth={2.6} strokeDasharray="10 6" dot={false} connectNulls />
                      <Line type="monotone" dataKey="predicted_violation_count" name="Predicted Violations" stroke="#ef4444" strokeWidth={2.2} strokeDasharray="10 6" dot={false} connectNulls />
                      <Line type="monotone" dataKey="predicted_occupied_count" name="Predicted Occupancy" stroke="#2563eb" strokeWidth={2.6} strokeDasharray="10 6" dot={false} connectNulls />
                    </ComposedChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyState text="No room-level forecast data available." />
                )}
              </SectionCard>

              <SectionCard title="Abnormal Noise / Action Days">
                {filteredAnomalies.length ? (
                  <div className="table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Room</th>
                          <th>Date</th>
                          <th>Anomaly Score</th>
                          <th>Status</th>
                          <th>Reason</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredAnomalies.map((item, idx) => (
                          <tr key={`${item.date}-${idx}`}>
                            <td>{item.room_id}</td>
                            <td>{item.date}</td>
                            <td>{Number(item.anomaly_score || 0).toFixed(4)}</td>
                            <td><span className="badge danger">Abnormal</span></td>
                            <td>{item.reason || "Unusual warden activity detected"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p>No abnormal room days detected yet.</p>
                )}
              </SectionCard>
            </div>

            <div className="owner-top-grid single-column-mobile">
              <SectionCard title="Weekly Pattern Discovery">
                {patternRows.length ? (
                  <div className="table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Day / Pattern</th>
                          <th>Type</th>
                          <th>Usual Pattern</th>
                          <th>Avg Warnings</th>
                          <th>Avg Violations</th>
                          <th>Avg Occupancy</th>
                        </tr>
                      </thead>
                      <tbody>
                        {patternRows.map((item) => (
                          <tr key={item.id}>
                            <td>{item.weekday_name}</td>
                            <td>{item.day_type}</td>
                            <td>
                              <span
                                className={
                                  String(item.usual_pattern).toLowerCase().includes("stable") ||
                                  String(item.usual_pattern).toLowerCase().includes("normal")
                                    ? "badge ok"
                                    : String(item.usual_pattern).toLowerCase().includes("watch") ||
                                      String(item.usual_pattern).toLowerCase().includes("warning")
                                    ? "badge warning"
                                    : "badge danger"
                                }
                              >
                                {item.usual_pattern}
                              </span>
                            </td>
                            <td>{item.avg_warning_count.toFixed(2)}</td>
                            <td>{item.avg_violation_count.toFixed(2)}</td>
                            <td>{item.avg_occupied_count.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p>No weekday pattern discovery available yet.</p>
                )}
              </SectionCard>

              <SectionCard title="Correlation / Feature Importance">
                {filteredFeatureImportance.length ? (
                  <div className="table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Feature</th>
                          <th>Importance</th>
                          <th>Priority</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredFeatureImportance.map((item, idx) => (
                          <tr key={`${item.feature}-${idx}`}>
                            <td>{item.feature}</td>
                            <td>{Number(item.importance || 0).toFixed(4)}</td>
                            <td>
                              <span className={Number(item.importance || 0) >= 0.5 ? "badge danger" : Number(item.importance || 0) >= 0.2 ? "badge warning" : "badge ok"}>
                                {Number(item.importance || 0) >= 0.5 ? "High impact" : Number(item.importance || 0) >= 0.2 ? "Medium impact" : "Low impact"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p>No feature importance data available yet.</p>
                )}
              </SectionCard>
            </div>
          </SectionCard>
        </div>
      ) : null}

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
                  {
  key: "noise_stat",
  label: "Noise / Critical",
  render: (row) => (
    <span className={`history-word ${historyTone(row.noise_stat)}`}>
      {row.noise_stat}
    </span>
  )
},
{
  key: "waste_stat",
  label: "Waste / Critical",
  render: (row) => (
    <span className={`history-word ${historyTone(row.waste_stat)}`}>
      {row.waste_stat}
    </span>
  )
},
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
                    <WardenAlertCard key={`${alert.room_id}-${alert.title}-modal-${index}`} alert={alert} onOpen={setSelectedAlert} />
                  ))}
                </div>
              ) : (
                <EmptyState text="No active alerts right now." />
              )
            ) : null}

            {selectedKpi === "priority" ? (
              cleaningPriorityRooms.length > 0 ? (
                <DataTable
                  columns={[
                    { key: "room_id", label: "Room" },
                    { key: "occupancy_stat", label: "Occupancy", render: (row) => <StatusBadge value={row.occupancy_stat} /> },
                    { key: "priority_type", label: "Priority Type", render: (row) => String(row.occupancy_stat || "").toLowerCase() === "empty" ? "Empty Room Cleaning" : "Inspection Required" },
                    { key: "inspection_reasons", label: "Reason", render: (row) => String(row.occupancy_stat || "").toLowerCase() === "empty" && !(row.inspection_reasons || []).length ? "Room is empty and ready for cleaning" : renderReasons(row.inspection_reasons) },
                    { key: "captured_at", label: "Updated", render: (row) => row.captured_at ? formatDate(row.captured_at) : "No Data" }
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
                <h4>Alert Details</h4>
                <p><strong>Room:</strong> {selectedAlert.room_id}</p>
                <p><strong>Severity:</strong> {selectedAlert.severity}</p>
                <p><strong>Reasons:</strong> {renderReasons(selectedAlert.inspection_reasons)}</p>
                <p><strong>Detected At:</strong> {selectedAlert.captured_at ? formatDate(selectedAlert.captured_at) : "No Data"}</p>
              </div>

              <div className="warden-single-room-card">
                <h4>Current Room State</h4>
                <p><strong>Occupancy:</strong> {selectedAlert.occupancy_stat}</p>
                <p><strong>Door:</strong> {selectedAlert.door_status}</p>
                <p><strong>Faults:</strong> {renderFaults(selectedAlert.sensor_faults)}</p>

                {selectedAlert.title !== "Critical Waste" ? (
                  <>
                    <p><strong>Noise:</strong> {selectedAlert.noise_stat}</p>
                    <p><strong>Sound Peak:</strong> {selectedAlert.sound_peak}</p>
                  </>
                ) : null}

                {selectedAlert.title !== "Critical Noise" ? (
                  <>
                    <p><strong>Waste:</strong> {selectedAlert.waste_stat}</p>
                    <p><strong>Current:</strong> {selectedAlert.current_amp} A</p>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
