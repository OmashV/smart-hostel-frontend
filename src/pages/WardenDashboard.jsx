import { useEffect, useMemo, useState } from "react";
import {
  HiOutlineBellAlert,
  HiOutlineExclamationTriangle,
  HiOutlineHomeModern,
  HiOutlineMoon,
  HiOutlineSpeakerWave,
  HiOutlineWifi,
  HiOutlineWrenchScrewdriver
} from "react-icons/hi2";
import {
  Bar,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  BarChart,
  LineChart,
  Line
} from "recharts";
import {
  getWardenInspectionQueue,
  getWardenNoiseIssues,
  getWardenNoiseTrend,
  getWardenRoomsStatus,
  getWardenSummary
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

function getFloor(roomId = "") {
  const match = String(roomId).match(/[A-Za-z]+|^\d+/);
  return match ? match[0] : "Other";
}

function WardenAlertCard({ alert }) {
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
    <div className={cls}>
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
        <span>{formatDate(alert.captured_at)}</span>
      </div>
    </div>
  );
}

function WardenRoomTile({ room, onSelect }) {
  const severityClass =
    room.noise_stat === "Violation" || room.waste_stat === "Critical"
      ? "critical"
      : room.needs_inspection
      ? "warning"
      : "normal";

  return (
    <div
      className={`owner-room-tile ${severityClass} warden-room-tile`}
      onClick={() => onSelect(room)}
      title="Click to view room details"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onSelect(room);
      }}
    >
      <div className="tile-top">
        <div>
          <h3>{room.room_id}</h3>
          <p className="tile-subtext">Warden room overview</p>
        </div>
        <span
          className={`tile-dot ${
            severityClass === "critical"
              ? "red"
              : severityClass === "warning"
              ? "orange"
              : "green"
          }`}
        />
      </div>

      {room.needs_inspection ? (
        <span className="tile-alert-pill">
          {room.inspection_reasons?.length || 1} Alert
        </span>
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
          <span>Waste</span>
          <strong>{room.waste_stat}</strong>
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
        Last Activity <span>{formatDate(room.captured_at)}</span>
      </div>
    </div>
  );
}

export default function WardenDashboard() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [noiseIssues, setNoiseIssues] = useState([]);
  const [inspectionQueue, setInspectionQueue] = useState([]);
  const [noiseTrend, setNoiseTrend] = useState([]);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);

  const [selectedFloor, setSelectedFloor] = useState("All");
  const [searchRoom, setSearchRoom] = useState("");
  const [onlyAttention, setOnlyAttention] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState(null);

  async function load() {
    try {
      setError("");

      const [summaryRes, roomsRes, noiseRes, inspectionRes, trendRes] =
        await Promise.all([
          getWardenSummary(),
          getWardenRoomsStatus(),
          getWardenNoiseIssues(),
          getWardenInspectionQueue(),
          getWardenNoiseTrend(7)
        ]);

      setSummary(summaryRes);
      setRooms(roomsRes.rooms || []);
      setNoiseIssues(noiseRes.rooms || []);
      setInspectionQueue(inspectionRes.rooms || []);
      setNoiseTrend(trendRes.trend || []);
      setLastUpdated(new Date());
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
    let intervalId;

    async function init() {
      setLoading(true);
      await load();
      intervalId = setInterval(load, 8000);
    }

    init();

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  const floors = useMemo(() => {
    const uniqueFloors = Array.from(new Set(rooms.map((room) => getFloor(room.room_id))));
    return ["All", ...uniqueFloors];
  }, [rooms]);

  const filteredRooms = useMemo(() => {
    return rooms.filter((room) => {
      const matchFloor =
        selectedFloor === "All" || getFloor(room.room_id) === selectedFloor;

      const matchSearch = room.room_id
        .toLowerCase()
        .includes(searchRoom.trim().toLowerCase());

      const matchAttention = !onlyAttention || room.needs_inspection;

      return matchFloor && matchSearch && matchAttention;
    });
  }, [rooms, selectedFloor, searchRoom, onlyAttention]);

  const activeAlerts = useMemo(() => {
    return inspectionQueue
      .slice()
      .sort(
        (a, b) =>
          new Date(b.captured_at).getTime() - new Date(a.captured_at).getTime()
      )
      .slice(0, 5)
      .map((room) => ({
        room_id: room.room_id,
        severity: room.inspection_reasons.some((r) =>
          r.toLowerCase().includes("critical") || r.toLowerCase().includes("violation")
        )
          ? "Critical"
          : "Warning",
        title: room.inspection_reasons[0] || "Needs attention",
        message: renderReasons(room.inspection_reasons),
        captured_at: room.captured_at
      }));
  }, [inspectionQueue]);

  const recentAlerts = useMemo(() => {
    return inspectionQueue
      .slice()
      .sort(
        (a, b) =>
          new Date(b.captured_at).getTime() - new Date(a.captured_at).getTime()
      )
      .slice(0, 8);
  }, [inspectionQueue]);

  if (loading) return <LoadingState />;

  return (
    <div className="page-grid owner-dashboard">
      <div className="warden-header-line">
        <div>
          <h2 className="warden-page-title">Warden Monitoring Dashboard</h2>
          <p className="warden-page-subtitle">
            Live occupancy, active alerts, inspection priorities, and room-level drill-down.
          </p>
        </div>
        <div className="warden-auto-refresh-note">
          Auto-refresh every 8 seconds · Last updated:{" "}
          {lastUpdated ? formatDate(lastUpdated) : "-"}
        </div>
      </div>

      <div className="filter-bar">
        <label>
          Floor
          <select
            value={selectedFloor}
            onChange={(e) => setSelectedFloor(e.target.value)}
          >
            {floors.map((floor) => (
              <option key={floor} value={floor}>
                {floor}
              </option>
            ))}
          </select>
        </label>

        <label>
          Search Room
          <input
            className="warden-search-input"
            type="text"
            placeholder="Type room id"
            value={searchRoom}
            onChange={(e) => setSearchRoom(e.target.value)}
          />
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
        </div>
      ) : null}

      <div className="stats-grid">
        <StatCard
          title="Occupied Rooms"
          value={summary?.occupied_rooms ?? 0}
          subtitle="Currently occupied rooms"
          icon={<HiOutlineHomeModern />}
          tone="blue"
        />
        <StatCard
          title="Empty Rooms"
          value={summary?.empty_rooms ?? 0}
          subtitle="Rooms available right now"
          icon={<HiOutlineHomeModern />}
          tone="green"
        />
        <StatCard
          title="Sleeping Rooms"
          value={summary?.sleeping_rooms ?? 0}
          subtitle="Detected sleeping state"
          icon={<HiOutlineMoon />}
          tone="purple"
        />
        <StatCard
          title="Noise Issue Rooms"
          value={summary?.noise_issue_rooms ?? 0}
          subtitle="Warning or violation rooms"
          icon={<HiOutlineSpeakerWave />}
          tone="orange"
        />
        <StatCard
          title="Needs Inspection"
          value={summary?.rooms_needing_inspection ?? 0}
          subtitle="Rooms requiring action"
          icon={<HiOutlineWrenchScrewdriver />}
          tone="red"
        />
        <StatCard
          title="Stale Rooms"
          value={summary?.stale_rooms ?? 0}
          subtitle="Rooms with delayed updates"
          icon={<HiOutlineWifi />}
          tone="purple"
        />
      </div>

      <div className="owner-top-grid">
        <SectionCard title="Room Overview">
          {filteredRooms.length ? (
            <div className="owner-room-grid">
              {filteredRooms.map((room) => (
                <WardenRoomTile
                  key={room.room_id}
                  room={room}
                  onSelect={setSelectedRoom}
                />
              ))}
            </div>
          ) : (
            <EmptyState text="No rooms match the selected filters." />
          )}
        </SectionCard>

        <SectionCard title="Active Alerts">
          {activeAlerts.length ? (
            <div className="alerts-list">
              {activeAlerts.map((alert, index) => (
                <WardenAlertCard key={`${alert.room_id}-${index}`} alert={alert} />
              ))}
            </div>
          ) : (
            <EmptyState text="No active alerts right now." />
          )}
        </SectionCard>
      </div>

      <div className="owner-top-grid">
        <SectionCard title="Noise Issues by Room">
          {noiseIssues.length ? (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={noiseIssues}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="room_id" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="warning_count" name="Warnings" />
                <Bar dataKey="violation_count" name="Violations" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState text="No active noise issues right now." />
          )}
        </SectionCard>

        <SectionCard title="7-Day Noise Trend">
          {noiseTrend.length ? (
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={noiseTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="warnings" name="Warnings" strokeWidth={2} />
                <Line type="monotone" dataKey="violations" name="Violations" strokeWidth={2} />
                <Line type="monotone" dataKey="total" name="Total Issues" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState text="No recent noise trend data available." />
          )}
        </SectionCard>
      </div>

      <SectionCard title="Recent Alerts">
        {recentAlerts.length ? (
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
                key: "waste_stat",
                label: "Waste",
                render: (row) => <StatusBadge value={row.waste_stat} />
              },
              {
                key: "inspection_reasons",
                label: "Alert Reason",
                render: (row) => renderReasons(row.inspection_reasons)
              },
              {
                key: "captured_at",
                label: "Time",
                render: (row) => formatDate(row.captured_at)
              }
            ]}
            rows={recentAlerts}
          />
        ) : (
          <EmptyState text="No recent alerts available." />
        )}
      </SectionCard>

      <SectionCard title="Inspection Queue">
        {inspectionQueue.length ? (
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
                key: "waste_stat",
                label: "Waste",
                render: (row) => <StatusBadge value={row.waste_stat} />
              },
              {
                key: "sensor_faults",
                label: "Sensor Faults",
                render: (row) => renderFaults(row.sensor_faults)
              },
              {
                key: "inspection_reasons",
                label: "Reasons",
                render: (row) => renderReasons(row.inspection_reasons)
              },
              {
                key: "captured_at",
                label: "Last Updated",
                render: (row) => formatDate(row.captured_at)
              }
            ]}
            rows={inspectionQueue}
          />
        ) : (
          <EmptyState text="No rooms currently require inspection." />
        )}
      </SectionCard>

      {selectedRoom ? (
        <div className="warden-modal-overlay" onClick={() => setSelectedRoom(null)}>
          <div className="warden-modal" onClick={(e) => e.stopPropagation()}>
            <div className="warden-modal-head">
              <h3>Room Drill-Down: {selectedRoom.room_id}</h3>
              <button onClick={() => setSelectedRoom(null)}>Close</button>
            </div>

            <div className="warden-modal-grid">
              <div className="warden-modal-card">
                <h4>Current Status</h4>
                <div className="tile-badges">
                  <StatusBadge value={selectedRoom.occupancy_stat} />
                  <StatusBadge value={selectedRoom.noise_stat} />
                  <StatusBadge value={selectedRoom.waste_stat} />
                  <StatusBadge value={selectedRoom.door_status} />
                </div>
              </div>

              <div className="warden-modal-card">
                <h4>Measurements</h4>
                <p><strong>Current:</strong> {selectedRoom.current_amp} A</p>
                <p><strong>Sound Peak:</strong> {selectedRoom.sound_peak}</p>
                <p><strong>Updated:</strong> {formatDate(selectedRoom.captured_at)}</p>
              </div>

              <div className="warden-modal-card">
                <h4>Sensor Faults</h4>
                <p>{renderFaults(selectedRoom.sensor_faults)}</p>
              </div>

              <div className="warden-modal-card">
                <h4>Inspection Reasons</h4>
                <p>{renderReasons(selectedRoom.inspection_reasons)}</p>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
