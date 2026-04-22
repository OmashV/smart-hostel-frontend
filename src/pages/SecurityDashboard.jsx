import { useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  CartesianGrid,
  XAxis,
  YAxis,
  Legend
} from "recharts";

import {
  getSecurityDoorEvents,
  getSecuritySummary,
  getSecuritySuspiciousRooms,
  getSecurityTrend,
  getSecurityAnomalies
} from "../api/client";

import StatCard from "../components/StatCard";
import SectionCard from "../components/SectionCard";
import DataTable from "../components/DataTable";
import LoadingState from "../components/LoadingState";
import EmptyState from "../components/EmptyState";

import { formatDate, formatDuration } from "../utils/format";

export default function SecurityDashboard() {
  const [loading, setLoading] = useState(true);
  const [selectedRoom, setSelectedRoom] = useState("all");

  const [summary, setSummary] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [events, setEvents] = useState([]);
  const [trend, setTrend] = useState([]);
  const [anomalies, setAnomalies] = useState([]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const roomId = selectedRoom === "all" ? undefined : selectedRoom;

        const [summaryRes, suspiciousRes, eventsRes, trendRes, anomalyRes] =
          await Promise.all([
            getSecuritySummary(roomId),
            getSecuritySuspiciousRooms(roomId),
            getSecurityDoorEvents(roomId),
            getSecurityTrend(roomId),
            getSecurityAnomalies(roomId)
          ]);

        setSummary(summaryRes);
        setRooms(suspiciousRes.rooms || []);
        setEvents(eventsRes.events || []);
        setTrend(trendRes.trend || []);
        setAnomalies(anomalyRes.anomalies || []);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [selectedRoom]);

  const availableRooms = useMemo(() => {
    const ids = new Set();

    rooms.forEach((r) => r.room_id && ids.add(r.room_id));
    events.forEach((r) => r.room_id && ids.add(r.room_id));
    anomalies.forEach((r) => r.room_id && ids.add(r.room_id));

    return ["all", ...Array.from(ids).sort()];
  }, [rooms, events, anomalies]);

  if (loading) return <LoadingState />;

  const trendData = trend.map((item) => ({
    hour: item.hour_label,
    expected: item.expected_door_stable_min,
    actual: item.actual_door_stable_min
  }));

  const renderRoomLink = (row) => (
    <button
      type="button"
      onClick={() => setSelectedRoom(row.room_id)}
      style={{
        background: "none",
        border: "none",
        padding: 0,
        color: "#2563eb",
        cursor: "pointer",
        fontWeight: 600
      }}
    >
      {row.room_id}
    </button>
  );

  return (
    <div className="page-grid">
      {/* Room Drill-down Filter */}
      <SectionCard title="Security Scope">
        <div
          style={{
            display: "flex",
            gap: 10,
            alignItems: "center",
            flexWrap: "wrap"
          }}
        >
          <label style={{ fontWeight: 600 }}>View:</label>

          <select
            value={selectedRoom}
            onChange={(e) => setSelectedRoom(e.target.value)}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid #d1d5db"
            }}
          >
            {availableRooms.map((roomId) => (
              <option key={roomId} value={roomId}>
                {roomId === "all" ? "All Rooms" : roomId}
              </option>
            ))}
          </select>

          {selectedRoom !== "all" && (
            <button
              type="button"
              onClick={() => setSelectedRoom("all")}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid #d1d5db",
                background: "#fff",
                cursor: "pointer"
              }}
            >
              Back to All Rooms
            </button>
          )}
        </div>
      </SectionCard>

      {/* KPI Cards */}
      <div className="stats-grid">
        <StatCard title="Active Alerts" value={summary?.active_security_alerts ?? 0} />
        <StatCard title="Suspicious Rooms" value={summary?.suspicious_rooms ?? 0} />
        <StatCard title="High-Risk Rooms" value={summary?.high_risk_rooms ?? 0} />
        <StatCard title="After-Hours Events" value={summary?.after_hours_events ?? 0} />
      </div>

      {/* Trend Analysis */}
      <SectionCard
        title={
          selectedRoom === "all"
            ? "Door Behavior Trend Analysis"
            : `Door Behavior Trend Analysis — ${selectedRoom}`
        }
      >
        <p className="section-description">
          This chart compares learned expected door-open duration patterns with
          recent actual behavior. Large gaps can indicate abnormal room activity.
        </p>

        {trendData.length ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="hour" />
              <YAxis label={{ value: "Minutes", angle: -90, position: "insideLeft" }} />
              <Tooltip formatter={(v) => `${v} min`} />
              <Legend />
              <Line dataKey="expected" name="Expected Duration" strokeWidth={2} />
              <Line dataKey="actual" name="Actual Duration" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState text="No trend data available." />
        )}
      </SectionCard>

      {/* Anomalies */}
      <SectionCard
        title={
          selectedRoom === "all"
            ? "Detected Security Anomalies"
            : `Detected Security Anomalies — ${selectedRoom}`
        }
      >
        <p className="section-description">
          Anomalies are events where the observed door behavior deviates from
          learned historical patterns. Risk is prioritized using duration,
          motion, occupancy, and time context.
        </p>

        {anomalies.length ? (
          <DataTable
            columns={[
              {
                key: "room_id",
                label: "Room",
                render: renderRoomLink
              },
              {
                key: "risk_level",
                label: "Risk",
                render: (row) => {
                  let color = "inherit";
                  if (row.risk_level === "High") color = "red";
                  else if (row.risk_level === "Medium") color = "orange";

                  return <strong style={{ color }}>{row.risk_level}</strong>;
                }
              },
              { key: "risk_score", label: "Score" },
              { key: "anomaly_ratio", label: "Ratio" },
              {
                key: "door_stable_min",
                label: "Actual Duration",
                render: (row) => `${row.door_stable_min} min`
              },
              {
                key: "expected_door_stable_min",
                label: "Expected Duration",
                render: (row) => `${row.expected_door_stable_min} min`
              },
              {
                key: "reasons",
                label: "Reason",
                render: (row) => row.reasons?.join(", ") || "-"
              },
              {
                key: "captured_at",
                label: "Time",
                render: (row) => formatDate(row.captured_at)
              }
            ]}
            rows={anomalies}
          />
        ) : (
          <EmptyState text="No anomalies detected." />
        )}
      </SectionCard>

      {/* Suspicious Rooms */}
      <SectionCard
        title={
          selectedRoom === "all"
            ? "Suspicious Room Activity"
            : `Suspicious Room Activity — ${selectedRoom}`
        }
      >
        <p className="section-description">
          Rooms flagged for unusual activity such as long open-door durations or
          suspicious motion behavior.
        </p>

        {rooms.length ? (
          <DataTable
            columns={[
              {
                key: "room_id",
                label: "Room",
                render: renderRoomLink
              },
              { key: "door_status", label: "Door" },
              {
                key: "door_stable_ms",
                label: "Door Duration",
                render: (row) => {
                  const min = row.door_stable_ms / 60000;

                  let color = "inherit";
                  if (min > 60) color = "red";
                  else if (min > 30) color = "orange";

                  return <span style={{ color }}>{formatDuration(row.door_stable_ms)}</span>;
                }
              },
              { key: "motion_count", label: "Motion" },
              {
                key: "captured_at",
                label: "Time",
                render: (row) => formatDate(row.captured_at)
              }
            ]}
            rows={rooms}
          />
        ) : (
          <EmptyState text="No suspicious rooms." />
        )}
      </SectionCard>

      {/* Recent Events */}
      <SectionCard
        title={
          selectedRoom === "all"
            ? "Recent Door Events"
            : `Recent Door Events — ${selectedRoom}`
        }
      >
        <p className="section-description">
          Latest door activity logs for real-time security monitoring.
        </p>

        {events.length ? (
          <DataTable
            columns={[
              {
                key: "room_id",
                label: "Room",
                render: renderRoomLink
              },
              { key: "door_status", label: "Door" },
              {
                key: "door_stable_ms",
                label: "Duration",
                render: (row) => {
                  const min = row.door_stable_ms / 60000;

                  let color = "inherit";
                  if (min > 60) color = "red";
                  else if (min > 30) color = "orange";

                  return <span style={{ color }}>{formatDuration(row.door_stable_ms)}</span>;
                }
              },
              { key: "motion_count", label: "Motion" },
              {
                key: "captured_at",
                label: "Time",
                render: (row) => formatDate(row.captured_at)
              }
            ]}
            rows={events}
          />
        ) : (
          <EmptyState text="No recent events." />
        )}
      </SectionCard>
    </div>
  );
}