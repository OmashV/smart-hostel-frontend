import { useEffect, useState } from "react";
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

export default function WardenDashboard() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [noiseIssues, setNoiseIssues] = useState([]);
  const [inspectionQueue, setInspectionQueue] = useState([]);
  const [noiseTrend, setNoiseTrend] = useState([]);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);

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
      intervalId = setInterval(load, 15000);
    }

    init();

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  if (loading) return <LoadingState />;

  return (
    <div className="page-grid">
      <div className="warden-toolbar">
        <div>
          <h2 className="warden-page-title">Warden Operations Dashboard</h2>
          <p className="warden-page-subtitle">
            Monitors occupancy, noise, waste, faults, and rooms needing action.
          </p>
        </div>

        <div className="warden-toolbar-right">
          <span className="warden-refresh-note">
            Last updated: {lastUpdated ? formatDate(lastUpdated) : "-"}
          </span>
          <button className="warden-refresh-btn" onClick={load}>
            Refresh now
          </button>
        </div>
      </div>

      {error ? (
        <div className="warden-error-box">
          <strong>Dashboard error:</strong> {error}
        </div>
      ) : null}

      <div className="stats-grid">
        <StatCard title="Occupied Rooms" value={summary?.occupied_rooms ?? 0} />
        <StatCard title="Empty Rooms" value={summary?.empty_rooms ?? 0} />
        <StatCard title="Sleeping Rooms" value={summary?.sleeping_rooms ?? 0} />
        <StatCard title="Noise Issue Rooms" value={summary?.noise_issue_rooms ?? 0} />
        <StatCard
          title="Rooms Needing Inspection"
          value={summary?.rooms_needing_inspection ?? 0}
        />
        <StatCard title="Stale Rooms" value={summary?.stale_rooms ?? 0} />
      </div>

      <SectionCard title="Real-Time Room Status Grid">
        {rooms.length ? (
          <div className="status-grid">
            {rooms.map((room) => (
              <div
                key={room.room_id}
                className={`room-tile ${room.needs_inspection ? "room-tile-alert" : ""}`}
              >
                <div className="room-tile-top">
                  <h3>{room.room_id}</h3>
                  {room.needs_inspection ? (
                    <span className="warden-pill danger">Needs inspection</span>
                  ) : (
                    <span className="warden-pill ok">Normal</span>
                  )}
                </div>

                <div className="warden-room-badges">
                  <StatusBadge value={room.occupancy_stat} />
                  <StatusBadge value={room.noise_stat} />
                  <StatusBadge value={room.waste_stat} />
                  <StatusBadge value={room.door_status} />
                </div>

                <div className="warden-room-meta">
                  <p><strong>Current:</strong> {room.current_amp} A</p>
                  <p><strong>Sound Peak:</strong> {room.sound_peak}</p>
                  <p><strong>Faults:</strong> {renderFaults(room.sensor_faults)}</p>
                  <p><strong>Stale Data:</strong> {room.stale_data ? "Yes" : "No"}</p>
                  <p><strong>Updated:</strong> {formatDate(room.captured_at)}</p>
                </div>

                {room.inspection_reasons?.length ? (
                  <div className="warden-reasons-box">
                    <strong>Inspection reasons:</strong>
                    <div>{renderReasons(room.inspection_reasons)}</div>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <EmptyState text="No room status data available." />
        )}
      </SectionCard>

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
              <Line type="monotone" dataKey="warnings" name="Warnings" />
              <Line type="monotone" dataKey="violations" name="Violations" />
              <Line type="monotone" dataKey="total" name="Total Issues" />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState text="No recent noise trend data available." />
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
              { key: "door_status", label: "Door" },
              { key: "current_amp", label: "Current (A)" },
              {
                key: "stale_data",
                label: "Stale",
                render: (row) => (row.stale_data ? "Yes" : "No")
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
    </div>
  );
}
