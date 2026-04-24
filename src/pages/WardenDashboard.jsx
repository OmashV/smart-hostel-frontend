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
  Line
} from "recharts";
import {
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

const STATIC_ROOM_OPTIONS = ["All", "A101", "A102", "A103", "A201", "A202", "A203"];

function renderFaults(faults = {}) {
  const active = Object.entries(faults)
    .filter(([, value]) => value)
    .map(([key]) => key.toUpperCase());

  return active.length ? active.join(", ") : "None";
}

function renderReasons(reasons = []) {
  return reasons.length ? reasons.join(", ") : "-";
}

function getFloor(roomId = "") {
  const text = String(roomId).trim();
  if (!text) return "Other";
  const match = text.match(/^[A-Za-z]+|^\d+/);
  return match ? match[0].toUpperCase() : "Other";
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

      const criticalCount = scopedInspection.flatMap((room) => getAlertMeta(room)).filter(
        (alert) => alert.severity === "Critical"
      ).length;

      const warningCount = scopedInspection.flatMap((room) => getAlertMeta(room)).filter(
        (alert) => alert.severity === "Warning"
      ).length;

      const historyEntry =
        currentRoomFilter === "All"
          ? {
              history_id: `snapshot-${snapshotTime.toISOString()}`,
              snapshot_time: snapshotTime.toISOString(),
              room_id: "All Rooms",
              occupancy_stat: `${summaryRes?.occupied_rooms ?? 0} Occupied`,
              noise_stat: `${criticalCount} Critical`,
              waste_stat: `${warningCount} Warning`,
              inspection_reasons: [
                `${scopedInspection.length} active rooms`,
                `${criticalCount} critical`,
                `${warningCount} warning`
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
                noise_stat: roomData.noise_stat,
                waste_stat: roomData.waste_stat,
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
    const uniqueFloors = Array.from(new Set(rooms.map((room) => getFloor(room.room_id))));
    return ["All", ...uniqueFloors];
  }, [rooms]);

  const selectedRoomData = useMemo(() => {
    if (selectedRoomFilter === "All") return null;
    return rooms.find((room) => room.room_id === selectedRoomFilter) || makeEmptyRoom(selectedRoomFilter);
  }, [rooms, selectedRoomFilter]);

  const filteredRooms = useMemo(() => {
    return rooms.filter((room) => {
      const matchFloor =
        selectedFloor === "All" || getFloor(room.room_id) === selectedFloor;

      const matchRoom =
        selectedRoomFilter === "All" || room.room_id === selectedRoomFilter;

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
      .sort(
        (a, b) =>
          new Date(b.captured_at).getTime() - new Date(a.captured_at).getTime()
      )
      .flatMap((room) => getAlertMeta(room))
      .slice(0, 8);
  }, [inspectionQueue, selectedRoomFilter]);

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

  const roomSpecificNoiseIssues = useMemo(() => {
    const source =
      selectedRoomFilter === "All"
        ? inspectionQueue
        : inspectionQueue.filter((r) => r.room_id === selectedRoomFilter);

    const grouped = {};

    source.forEach((room) => {
      const id = room.room_id;
      if (!grouped[id]) {
        grouped[id] = { room_id: id, warning_count: 0, violation_count: 0 };
      }

      const noiseState = String(room.noise_stat || "").toLowerCase();
      if (noiseState.includes("violation")) {
        grouped[id].violation_count += 1;
      } else if (
        noiseState.includes("complaint") ||
        noiseState.includes("warning")
      ) {
        grouped[id].warning_count += 1;
      }

      (room.inspection_reasons || []).forEach((reason) => {
        const text = reason.toLowerCase();
        if (text.includes("noise")) {
          if (text.includes("violation")) {
            grouped[id].violation_count += 1;
          } else {
            grouped[id].warning_count += 1;
          }
        }
      });
    });

    const result = Object.values(grouped).map((row) => ({
      room_id: row.room_id,
      warning_count: row.warning_count,
      violation_count: row.violation_count
    }));

    if (selectedRoomFilter !== "All" && !result.length) {
      return [{ room_id: selectedRoomFilter, warning_count: 0, violation_count: 0 }];
    }

    return result;
  }, [inspectionQueue, selectedRoomFilter]);

  const adjustedNoiseTrend = useMemo(() => {
  return wardenHistory.map((item) => ({
    date: item.date,
    warnings: item.warning_count || 0,
    violations: item.violation_count || 0
  }));
}, [wardenHistory]);
  const occupancyTrend = useMemo(() => {
  return wardenHistory.map((item) => ({
    date: item.date,
    occupied: item.occupied_count || 0,
    empty: item.empty_count || 0
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

  const displayedAlerts =
    selectedRoomFilter === "All" ? activeAlerts.length : roomSpecificAlerts.length;

  const cleaningPriorityRooms = useMemo(() => {
  const source =
    selectedRoomFilter === "All"
      ? rooms
      : [selectedRoomData].filter(Boolean);

  return source.filter((room) => {
    const occupancy = String(room.occupancy_stat || "").toLowerCase();
    return room.needs_inspection || occupancy === "empty";
  });
}, [rooms, selectedRoomFilter, selectedRoomData]);

const displayedPriority = cleaningPriorityRooms.length;

  const filteredForecasts = useMemo(() => {
  if (selectedRoomFilter === "All") return wardenForecasts;
  return wardenForecasts.filter((item) => item.room_id === selectedRoomFilter);
}, [wardenForecasts, selectedRoomFilter]);

const filteredAnomalies = useMemo(() => {
  if (selectedRoomFilter === "All") return wardenAnomalies;
  return wardenAnomalies.filter((item) => item.room_id === selectedRoomFilter);
}, [wardenAnomalies, selectedRoomFilter]);

const filteredPatterns = useMemo(() => {
  if (selectedRoomFilter === "All") return wardenPatterns;
  return wardenPatterns.filter((item) => item.room_id === selectedRoomFilter);
}, [wardenPatterns, selectedRoomFilter]);



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
          <select
            value={selectedRoomFilter}
            onChange={(e) => setSelectedRoomFilter(e.target.value)}
          >
            {STATIC_ROOM_OPTIONS.map((roomId) => (
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
        <KpiCardButton
          onClick={() => setSelectedKpi("occupied")}
          title="Click to drill down occupied rooms"
        >
          <StatCard
            title="Occupied Rooms"
            value={displayedOccupied}
            subtitle="Current occupied rooms"
            icon={<HiOutlineHomeModern />}
            tone="blue"
          />
        </KpiCardButton>

        <KpiCardButton
          onClick={() => setSelectedKpi("empty")}
          title="Click to drill down empty rooms"
        >
          <StatCard
            title="Empty Rooms"
            value={displayedEmpty}
            subtitle="Useful for cleaning allocation"
            icon={<HiOutlineHomeModern />}
            tone="green"
          />
        </KpiCardButton>

        <KpiCardButton
          onClick={() => setSelectedKpi("alerts")}
          title="Click to drill down active alerts"
        >
          <StatCard
            title="Active Alerts"
            value={displayedAlerts}
            subtitle="Critical waste and critical noise"
            icon={<HiOutlineSpeakerWave />}
            tone="orange"
          />
        </KpiCardButton>

        <KpiCardButton
          onClick={() => setSelectedKpi("priority")}
          title="Click to drill down cleaning priority"
        >
          <StatCard
            title="Cleaning Priority"
            value={displayedPriority}
            subtitle="Rooms that need action"
            icon={<HiOutlineWrenchScrewdriver />}
            tone="red"
          />
        </KpiCardButton>
      </div>


      {selectedRoomFilter === "All" ? (
        <>
          <div className="owner-top-grid">
            <SectionCard title="Room Occupancy Monitoring">
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

            <SectionCard title="Active Alerts" className="primary-section">
              {activeAlerts.length ? (
                <div className="alerts-list">
                  {activeAlerts.map((alert, index) => (
                    <WardenAlertCard
                      key={`${alert.room_id}-${alert.title}-${index}`}
                      alert={alert}
                      onOpen={setSelectedAlert}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState text="No active alerts right now." />
              )}
            </SectionCard>
          </div>

          <div className="owner-top-grid">
            <SectionCard title="7-Day Occupancy Trend">
  {occupancyTrend.length ? (
    <div className="chart-shell">
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={occupancyTrend}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Line
          type="monotone"
          dataKey="occupied"
          name="Occupied"
          stroke="#2563eb"
          strokeWidth={3}
        />
        <Line
          type="monotone"
          dataKey="empty"
          name="Empty"
          stroke="#16a34a"
          strokeWidth={3}
        />
      </LineChart>
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
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="warnings"
                      name="Warnings"
                      stroke="#f59e0b"
                      fill="url(#warningFill)"
                      strokeWidth={2}
                    />
                    <Area
                      type="monotone"
                      dataKey="violations"
                      name="Violations"
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
              <div className="warden-single-room-panel">
                <div className="warden-single-room-top">
                  <div>
                    <h3>{selectedRoomData.room_id}</h3>
                    <p className="tile-subtext">Detailed room monitoring</p>
                  </div>
                  <div className="tile-badges">
                    <StatusBadge value={selectedRoomData.occupancy_stat} />
                    <StatusBadge value={selectedRoomData.noise_stat} />
                    <StatusBadge value={selectedRoomData.waste_stat} />
                    <StatusBadge value={selectedRoomData.door_status} />
                  </div>
                </div>

                <div className="warden-single-room-grid">
                  <div className="warden-single-room-card">
                    <h4>Current Measurements</h4>
                    <p><strong>Current:</strong> {selectedRoomData.current_amp} A</p>
                    <p><strong>Sound Peak:</strong> {selectedRoomData.sound_peak}</p>
                    <p>
                      <strong>Last Activity:</strong>{" "}
                      {selectedRoomData.captured_at ? formatDate(selectedRoomData.captured_at) : "No Data"}
                    </p>
                  </div>

                  <div className="warden-single-room-card">
                    <h4>Operational Notes</h4>
                    <p><strong>Faults:</strong> {renderFaults(selectedRoomData.sensor_faults)}</p>
                    <p><strong>Needs Action:</strong> {selectedRoomData.needs_inspection ? "Yes" : "No"}</p>
                    <p><strong>Reasons:</strong> {renderReasons(selectedRoomData.inspection_reasons)}</p>
                  </div>
                </div>
              </div>
            </SectionCard>

            <SectionCard title={`Active Alerts - ${selectedRoomFilter}`}>
              {roomSpecificAlerts.length ? (
                <div className="alerts-list">
                  {roomSpecificAlerts.map((alert, index) => (
                    <WardenAlertCard
                      key={`${alert.room_id}-${alert.title}-single-${index}`}
                      alert={alert}
                      onOpen={setSelectedAlert}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState text="No active alerts for this room right now." />
              )}
            </SectionCard>
          </div>

          <div className="owner-top-grid">
  <SectionCard title={`7-Day Occupancy Trend - ${selectedRoomFilter}`}>
    <p className="section-note">
  View room occupancy movement for the last 7 days to identify room availability patterns.
</p>
<div className="chart-shell">
    <ResponsiveContainer width="100%" height={320}>
      <LineChart
        data={occupancyTrend.map((entry) => ({
          ...entry,
          occupied:
            String(selectedRoomData?.occupancy_stat || "").toLowerCase() === "occupied" &&
            entry.date === occupancyTrend[occupancyTrend.length - 1]?.date
              ? 1
              : 0,
          empty:
            String(selectedRoomData?.occupancy_stat || "").toLowerCase() === "empty" &&
            entry.date === occupancyTrend[occupancyTrend.length - 1]?.date
              ? 1
              : 0
        }))}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Line
          type="monotone"
          dataKey="occupied"
          name="Occupied"
          stroke="#2563eb"
          strokeWidth={3}
        />
        <Line
          type="monotone"
          dataKey="empty"
          name="Empty"
          stroke="#16a34a"
          strokeWidth={3}
        />
      </LineChart>
    </ResponsiveContainer>
    </div>
  </SectionCard>

  <SectionCard title={`7-Day Noise Trend - ${selectedRoomFilter}`}>
    <p className="section-note">
  View noise trends for the last 7 days to identify noise patterns.
</p>
    {adjustedNoiseTrend.length ? (
      <div className="chart-shell">
      <ResponsiveContainer width="100%" height={320}>
        <AreaChart
          data={adjustedNoiseTrend.map((entry) => ({
            ...entry,
            warnings:
              entry.date === adjustedNoiseTrend[adjustedNoiseTrend.length - 1]?.date
                ? roomSpecificNoiseIssues[0]?.warning_count || 0
                : entry.warnings || 0,
            violations:
              entry.date === adjustedNoiseTrend[adjustedNoiseTrend.length - 1]?.date
                ? roomSpecificNoiseIssues[0]?.violation_count || 0
                : entry.violations || 0
          }))}
        >
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
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Area
            type="monotone"
            dataKey="warnings"
            name="Warnings"
            stroke="#f59e0b"
            fill="url(#singleRoomWarningFill)"
            strokeWidth={2}
          />
          <Area
            type="monotone"
            dataKey="violations"
            name="Violations"
            stroke="#ef4444"
            fill="url(#singleRoomViolationFill)"
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
              { key: "occupancy_stat", label: "Occupancy / Count" },
              { key: "noise_stat", label: "Noise / Critical" },
              { key: "waste_stat", label: "Waste / Warning" },
              {
                key: "inspection_reasons",
                label: "Summary",
                render: (row) => renderReasons(row.inspection_reasons)
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
        <p className="section-note">
  These machine learning visualizations highlight forecasted behavior, unusual activity, learned patterns, and key influencing factors.
</p>
  <div className="owner-top-grid">
    <SectionCard title="Temporal Trend Forecast">
      {filteredForecasts.length ? (
        <div className="chart-shell">
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={filteredForecasts.slice(0, 10)}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip
              formatter={(value, name) => {
                if (name === "Predicted Warnings") return [Number(value).toFixed(2), name];
                if (name === "Predicted Violations") return [Number(value).toFixed(2), name];
                if (name === "Predicted Occupancy") return [Number(value).toFixed(2), name];
                return [value, name];
              }}
              labelFormatter={(label) => `Forecast Time: ${label}`}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="predicted_warning_count"
              name="Predicted Warnings"
              stroke="#f59e0b"
              strokeWidth={3}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
            />
            <Line
              type="monotone"
              dataKey="predicted_violation_count"
              name="Predicted Violations"
              stroke="#ef4444"
              strokeWidth={3}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
            />
            <Line
              type="monotone"
              dataKey="predicted_occupied_count"
              name="Predicted Occupancy"
              stroke="#2563eb"
              strokeWidth={3}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
        </div>
      ) : (
        <EmptyState text="No forecast data available." />
      )}
    </SectionCard>
    

    <SectionCard title="Anomaly Detection">
      {filteredAnomalies.length ? (
        <div className="chart-shell">
        <ResponsiveContainer width="100%" height={320}>
          <AreaChart data={filteredAnomalies.slice(0, 10)}>
            <defs>
              <linearGradient id="anomalyFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip
              formatter={(value, name, payload) => {
                if (name === "Anomaly Score") {
                  return [
                    `${Number(value).toFixed(4)} | ${payload?.payload?.reason || "No reason"}`,
                    name
                  ];
                }
                return [value, name];
              }}
              labelFormatter={(label) => `Detected At: ${label}`}
            />
            <Legend />
            <Area
              type="monotone"
              dataKey="anomaly_score"
              name="Anomaly Score"
              stroke="#ef4444"
              fill="url(#anomalyFill)"
              strokeWidth={3}
            />
          </AreaChart>
        </ResponsiveContainer>
        </div>
      ) : (
        <EmptyState text="No anomaly data available." />
      )}
    </SectionCard>
    
  </div>

  <div className="owner-top-grid">
    <SectionCard title="Usage / Behavior Pattern Analysis">
      {filteredPatterns.length ? (
        <div className="chart-shell">
        <ResponsiveContainer width="100%" height={320}>
          <AreaChart
            data={Object.values(
              filteredPatterns.reduce((acc, item) => {
                const key = item.pattern_name || "Unknown";
                if (!acc[key]) {
                  acc[key] = { pattern_name: key, count: 0 };
                }
                acc[key].count += 1;
                return acc;
              }, {})
            )}
          >
            <defs>
              <linearGradient id="patternFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="pattern_name" />
            <YAxis allowDecimals={false} />
            <Tooltip
              formatter={(value, name, payload) => [
                `${value} records`,
                payload?.payload?.pattern_name || name
              ]}
            />
            <Legend />
            <Area
              type="monotone"
              dataKey="count"
              name="Pattern Frequency"
              stroke="#6366f1"
              fill="url(#patternFill)"
              strokeWidth={3}
            />
          </AreaChart>
        </ResponsiveContainer>
        </div>
      ) : (
        <EmptyState text="No pattern analysis data available." />
      )}
    </SectionCard>

    <SectionCard title="Correlation / Feature Importance">
    
      {wardenFeatureImportance.length ? (
        <div className="chart-shell">
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={wardenFeatureImportance}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="feature" />
            <YAxis />
            <Tooltip
              formatter={(value, name, payload) => [
                Number(value).toFixed(4),
                payload?.payload?.feature || name
              ]}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="importance"
              name="Importance"
              stroke="#22c55e"
              strokeWidth={3}
              dot={{ r: 5 }}
              activeDot={{ r: 7 }}
            />
          </LineChart>
        </ResponsiveContainer>
        </div>
      ) : (
        <EmptyState text="No feature importance data available." />
      )}
    </SectionCard>
  </div>
</SectionCard></div>) : null}

      {selectedKpi ? (
        <div className="warden-modal-overlay" onClick={() => setSelectedKpi(null)}>
          <div className="warden-modal" onClick={(e) => e.stopPropagation()}>
            <div className="warden-modal-head">
              <h3>
                {selectedKpi === "occupied" && "Occupied Rooms"}
                {selectedKpi === "empty" && "Empty Rooms"}
                {selectedKpi === "alerts" && "Active Alerts"}
                
              </h3>
              <button onClick={() => setSelectedKpi(null)}>Close</button>
            </div>

            {selectedKpi === "occupied" ? (
              <DataTable
                columns={[
                  { key: "room_id", label: "Room" },
                  {
                    key: "occupancy_stat",
                    label: "Occupancy",
                    render: (row) => <StatusBadge value={row.occupancy_stat} />
                  },
                  {
                    key: "noise_stat",
                    label: "Noise",
                    render: (row) => <StatusBadge value={row.noise_stat} />
                  },
                  {
                    key: "captured_at",
                    label: "Updated",
                    render: (row) => (row.captured_at ? formatDate(row.captured_at) : "No Data")
                  }
                ]}
                rows={occupiedRows}
              />
            ) : null}

            {selectedKpi === "empty" ? (
              <DataTable
                columns={[
                  { key: "room_id", label: "Room" },
                  {
                    key: "occupancy_stat",
                    label: "Occupancy",
                    render: (row) => <StatusBadge value={row.occupancy_stat} />
                  },
                  {
                    key: "door_status",
                    label: "Door",
                    render: (row) => <StatusBadge value={row.door_status} />
                  },
                  {
                    key: "captured_at",
                    label: "Updated",
                    render: (row) => (row.captured_at ? formatDate(row.captured_at) : "No Data")
                  }
                ]}
                rows={emptyRows.length ? emptyRows : [selectedRoomData].filter(Boolean)}
              />
            ) : null}

            {selectedKpi === "alerts" ? (
              roomSpecificAlerts.length ? (
                <div className="alerts-list">
                  {roomSpecificAlerts.map((alert, index) => (
                    <WardenAlertCard
                      key={`${alert.room_id}-${alert.title}-modal-${index}`}
                      alert={alert}
                      onOpen={setSelectedAlert}
                    />
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
        {
          key: "occupancy_stat",
          label: "Occupancy",
          render: (row) => <StatusBadge value={row.occupancy_stat} />
        },
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
        },
        {
          key: "captured_at",
          label: "Updated",
          render: (row) =>
            row.captured_at ? formatDate(row.captured_at) : "No Data"
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
