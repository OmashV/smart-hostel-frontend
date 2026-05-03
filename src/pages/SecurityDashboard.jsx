import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import {
  HiOutlineArrowPath,
  HiOutlineBellAlert,
  HiOutlineChartBarSquare,
  HiOutlineExclamationTriangle,
  HiOutlineMoon,
  HiOutlineShieldExclamation
} from "react-icons/hi2";

import {
  getSecurityAnomalies,
  getSecurityDoorEvents,
  getSecuritySummary,
  getSecuritySuspiciousRooms,
  getSecurityTrend
} from "../api/client";
import { useChatbotContext } from "../context/ChatbotContext";

import DataTable from "../components/DataTable";
import EmptyState from "../components/EmptyState";
import LoadingState from "../components/LoadingState";
import SectionCard from "../components/SectionCard";
import StatCard from "../components/StatCard";
import StatusBadge from "../components/StatusBadge";
import { useChatbotContext } from "../context/ChatbotContext";
import { formatDate, formatDuration } from "../utils/format";

function SeverityBadge({ value }) {
  return <StatusBadge value={value || "No Data"} />;
}

function BandPill({ value }) {
  if (value === null || value === undefined) {
    return <StatusBadge value="No Data" />;
  }

  return <StatusBadge value={value ? "Critical" : "Normal"} />;
}

function DoorStatusBadge({ value }) {
  return <StatusBadge value={value || "No Data"} />;
}

function ScoreBar({ score }) {
  if (score == null) return <span className="muted-text">-</span>;

  const normalised = Math.max(0, Math.min(1, (score + 0.5) / 1));
  const pct = Math.round(normalised * 100);
  const tone = pct < 30 ? "danger" : pct < 60 ? "warning" : "ok";

  return (
    <div className="score-bar">
      <div className={`score-bar-fill ${tone}`} style={{ width: `${pct}%` }} />
      <span>{score.toFixed(3)}</span>
    </div>
  );
}

function DashboardTooltip({ active, payload, label, roomLabel = false }) {
  if (!active || !payload?.length) return null;

  return (
    <div className="dashboard-tooltip">
      <p className="dashboard-tooltip-title">
        {roomLabel ? `Room ${label}` : label}
      </p>
      {payload.map((item) => (
        <p key={item.name} style={{ color: item.color }}>
          {item.name}: <strong>{item.value}</strong>
        </p>
      ))}
    </div>
  );
}

function RefreshButton({ onClick, loading }) {
  return (
    <button
      type="button"
      className="dashboard-action-btn"
      onClick={onClick}
      disabled={loading}
    >
      <HiOutlineArrowPath className={loading ? "spin-icon" : ""} />
      {loading ? "Refreshing..." : "Refresh"}
    </button>
  );
}

export default function SecurityDashboard() {
  const { registerChatContext, clearChatContext } = useChatbotContext();
  const registerChatContextRef = useRef(registerChatContext);
  const clearChatContextRef = useRef(clearChatContext);
  const handleChatActionsRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedRoom, setSelectedRoom] = useState("all");
  const [lastUpdated, setLastUpdated] = useState(null);

  const [summary, setSummary] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [events, setEvents] = useState([]);
  const [trend, setTrend] = useState([]);
  const [anomalies, setAnomalies] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

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
      setLastUpdated(new Date());
    } catch (err) {
      setError(err.message || "Failed to load security data.");
    } finally {
      setLoading(false);
    }
  }, [selectedRoom]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    registerChatContext({
      role: "security",
      dashboardState: {
        floorId: "all",
        roomId: selectedRoom
      }
    });

    return () => {
      clearChatContext();
    };
  }, [registerChatContext, clearChatContext, selectedRoom]);

  useEffect(() => {
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    registerChatContextRef.current = registerChatContext;
    clearChatContextRef.current = clearChatContext;
  }, [registerChatContext, clearChatContext]);

  useEffect(() => {
    handleChatActionsRef.current = (actions) => {
      actions.forEach((action) => {
        if (action.type === "switch_room") {
          setSelectedRoom(action.value);
        }
      });
    };

    registerChatContextRef.current({
      role: "security",
      dashboardState: {
        dashboard: "security",
        roomId: selectedRoom,
        selectedFilters: {
          roomId: selectedRoom
        },
        selectedVisual: null
      },
      onAction: handleChatActionsRef.current
    });

    return () => {
      clearChatContextRef.current();
    };
  }, [selectedRoom]);

  const availableRooms = useMemo(() => {
    const ids = new Set();
    rooms.forEach((room) => room.room_id && ids.add(room.room_id));
    events.forEach((event) => event.room_id && ids.add(event.room_id));
    anomalies.forEach((anomaly) => anomaly.room_id && ids.add(anomaly.room_id));
    return ["all", ...Array.from(ids).sort()];
  }, [rooms, events, anomalies]);

  const trendData = trend.map((item) => ({
    hour: item.hour_label,
    expected: item.expected_door_stable_min,
    actual: item.actual_door_stable_min,
    upper:
      item.upper_bound_ms != null
        ? +(item.upper_bound_ms / 60000).toFixed(2)
        : null,
    lower:
      item.lower_bound_ms != null
        ? +(item.lower_bound_ms / 60000).toFixed(2)
        : null,
    latest_captured_at: item.latest_captured_at,
    trend_status: item.trend_status
  }));

  const roomOverviewData = useMemo(() => {
    const roomMap = new Map();

    const ensureRoom = (roomId) => {
      if (!roomId) return null;

      if (!roomMap.has(roomId)) {
        roomMap.set(roomId, {
          room_id: roomId,
          duration_total: 0,
          duration_count: 0,
          motion_total: 0,
          anomaly_count: 0
        });
      }

      return roomMap.get(roomId);
    };

    rooms.forEach((room) => {
      const item = ensureRoom(room.room_id);
      if (!item) return;

      if (room.door_stable_ms != null) {
        item.duration_total += room.door_stable_ms / 60000;
        item.duration_count += 1;
      }

      item.motion_total += room.motion_count ?? 0;
    });

    events.forEach((event) => {
      const item = ensureRoom(event.room_id);
      if (!item) return;

      if (event.door_stable_ms != null) {
        item.duration_total += event.door_stable_ms / 60000;
        item.duration_count += 1;
      }

      item.motion_total += event.motion_count ?? 0;
    });

    anomalies.forEach((anomaly) => {
      const item = ensureRoom(anomaly.room_id);
      if (!item) return;

      if (anomaly.door_stable_min != null) {
        item.duration_total += anomaly.door_stable_min;
        item.duration_count += 1;
      } else if (anomaly.door_stable_ms != null) {
        item.duration_total += anomaly.door_stable_ms / 60000;
        item.duration_count += 1;
      }

      item.motion_total += anomaly.motion_count ?? 0;
      item.anomaly_count += 1;
    });

    return Array.from(roomMap.values())
      .map((item) => ({
        room_id: item.room_id,
        duration_min:
          item.duration_count > 0
            ? +(item.duration_total / item.duration_count).toFixed(2)
            : 0,
        motion_count: item.motion_total,
        anomaly_count: item.anomaly_count
      }))
      .sort((a, b) => a.room_id.localeCompare(b.room_id));
  }, [rooms, events, anomalies]);

  const renderRoomLink = (row) => (
    <button
      type="button"
      className="table-link-btn"
      onClick={() => setSelectedRoom(row.room_id)}
    >
      {row.room_id}
    </button>
  );

  if (loading && !summary) return <LoadingState />;

  return (
    <div className="page-grid owner-dashboard security-dashboard">
      <div className="dashboard-page-head">
        <div>
          <p className="dashboard-kicker">Security Operations</p>
          <h2>Security Dashboard</h2>
          {lastUpdated ? (
            <p>
              ML-powered door activity monitoring. Last updated{" "}
              {lastUpdated.toLocaleTimeString()} and auto-refreshing every 30s.
            </p>
          ) : null}
        </div>
        <RefreshButton onClick={load} loading={loading} />
      </div>

      {error ? <div className="warden-error-box">{error}</div> : null}

      <div className="filter-bar">
        <label>
          Scope
          <select
            value={selectedRoom}
            onChange={(event) => setSelectedRoom(event.target.value)}
          >
            {availableRooms.map((id) => (
              <option key={id} value={id}>
                {id === "all" ? "All Rooms" : id}
              </option>
            ))}
          </select>
        </label>

        {selectedRoom !== "all" ? (
          <button
            type="button"
            className="dashboard-action-btn ghost"
            onClick={() => setSelectedRoom("all")}
          >
            All Rooms
          </button>
        ) : null}
      </div>

      <div className="stats-grid">
        <StatCard
          title="Active Alerts"
          value={summary?.active_security_alerts ?? 0}
          subtitle="Security alerts requiring attention"
          icon={<HiOutlineBellAlert />}
          tone="red"
        />
        <StatCard
          title="Suspicious Rooms"
          value={summary?.suspicious_rooms ?? 0}
          subtitle="Rooms with unusual door activity"
          icon={<HiOutlineShieldExclamation />}
          tone="orange"
        />
        <StatCard
          title="High-Risk Rooms"
          value={summary?.high_risk_rooms ?? 0}
          subtitle="Rooms currently marked high risk"
          icon={<HiOutlineExclamationTriangle />}
          tone="red"
        />
        <StatCard
          title="After-Hours Events"
          value={summary?.after_hours_events ?? 0}
          subtitle="Door or motion events outside expected hours"
          icon={<HiOutlineMoon />}
          tone="purple"
        />
        <StatCard
          title="ML Anomalies"
          value={anomalies.length}
          subtitle="Isolation Forest detections"
          icon={<HiOutlineChartBarSquare />}
          tone="blue"
        />
      </div>

      <SectionCard
        title={
          selectedRoom === "all"
            ? "All Rooms Security Overview"
            : `Door Behaviour Trend - ${selectedRoom}`
        }
        action={
          <span className="dashboard-pill">
            {selectedRoom === "all" ? "Overview" : "Prophet"}
          </span>
        }
      >
        <p className="section-note">
          {selectedRoom === "all"
            ? "Compare rooms using average door-open duration and anomaly counts."
            : "Compare expected door duration with recent actual behavior and confidence bands."}
        </p>

        <div className="chart-shell">
          {selectedRoom === "all" ? (
            roomOverviewData.length ? (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart
                  data={roomOverviewData}
                  margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="room_id" tick={{ fill: "#64748b", fontSize: 12 }} />
                  <YAxis tick={{ fill: "#64748b", fontSize: 12 }} />
                  <Tooltip content={<DashboardTooltip roomLabel />} />
                  <Legend />
                  <Bar
                    dataKey="duration_min"
                    name="Avg Door Duration (min)"
                    radius={[8, 8, 0, 0]}
                    fill="#2563eb"
                  />
                  <Bar
                    dataKey="anomaly_count"
                    name="Anomaly Count"
                    radius={[8, 8, 0, 0]}
                    fill="#ef4444"
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState text="No all-room overview data available." />
            )
          ) : trendData.length ? (
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart
                data={trendData}
                margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="securityBandGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.16} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="hour" tick={{ fill: "#64748b", fontSize: 12 }} />
                <YAxis tick={{ fill: "#64748b", fontSize: 12 }} />
                <Tooltip content={<DashboardTooltip />} />
                <Legend />
                {trendData[0]?.upper != null ? (
                  <Area
                    dataKey="upper"
                    name="Upper Bound"
                    stroke="#2563eb"
                    strokeWidth={1}
                    strokeDasharray="4 4"
                    fill="url(#securityBandGrad)"
                    dot={false}
                    activeDot={false}
                    legendType="none"
                  />
                ) : null}
                {trendData[0]?.lower != null ? (
                  <Area
                    dataKey="lower"
                    name="Lower Bound"
                    stroke="#2563eb"
                    strokeWidth={1}
                    strokeDasharray="4 4"
                    fill="transparent"
                    dot={false}
                    activeDot={false}
                    legendType="none"
                  />
                ) : null}
                <Line
                  dataKey="expected"
                  name="Expected"
                  stroke="#2563eb"
                  strokeWidth={2.6}
                  dot={false}
                  activeDot={{ r: 5 }}
                />
                <Line
                  dataKey="actual"
                  name="Actual"
                  stroke="#f97316"
                  strokeWidth={2.4}
                  dot={false}
                  activeDot={{ r: 5 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState text="No trend data available." />
          )}
        </div>
      </SectionCard>

      <SectionCard
        title={`Detected Anomalies${selectedRoom !== "all" ? ` - ${selectedRoom}` : ""}`}
        action={<span className="dashboard-pill">Isolation Forest</span>}
      >
        <p className="section-note">
          Flagged using learned patterns across door duration, motion, occupancy,
          and time context.
        </p>
        {anomalies.length ? (
          <DataTable
            columns={[
              { key: "room_id", label: "Room", render: renderRoomLink },
              {
                key: "severity",
                label: "Severity",
                render: (row) => <SeverityBadge value={row.severity} />
              },
              {
                key: "anomaly_score",
                label: "Anomaly Score",
                render: (row) => <ScoreBar score={row.anomaly_score} />
              },
              {
                key: "is_outside_prophet_band",
                label: "Prophet Band",
                render: (row) => <BandPill value={row.is_outside_prophet_band} />
              },
              {
                key: "door_stable_min",
                label: "Actual",
                render: (row) =>
                  row.door_stable_min != null ? `${row.door_stable_min} min` : "-"
              },
              {
                key: "expected_door_stable_min",
                label: "Expected",
                render: (row) =>
                  row.expected_door_stable_min != null
                    ? `${row.expected_door_stable_min} min`
                    : "-"
              },
              {
                key: "reason",
                label: "Reason",
                render: (row) => row.reason || "-"
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

      <SectionCard
        title={`Suspicious Room Activity${selectedRoom !== "all" ? ` - ${selectedRoom}` : ""}`}
      >
        <p className="section-note">
          Rooms with unusually long open-door durations or after-hours motion.
        </p>
        {rooms.length ? (
          <DataTable
            columns={[
              { key: "room_id", label: "Room", render: renderRoomLink },
              {
                key: "door_status",
                label: "Door",
                render: (row) => <DoorStatusBadge value={row.door_status} />
              },
              {
                key: "door_stable_ms",
                label: "Duration",
                render: (row) => formatDuration(row.door_stable_ms)
              },
              { key: "motion_count", label: "Motion Events" },
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

      <SectionCard
        title={`Recent Door Events${selectedRoom !== "all" ? ` - ${selectedRoom}` : ""}`}
        action={<span className="dashboard-pill live">Live</span>}
      >
        <p className="section-note">Latest door activity for real-time monitoring.</p>
        {events.length ? (
          <DataTable
            columns={[
              { key: "room_id", label: "Room", render: renderRoomLink },
              {
                key: "door_status",
                label: "Door",
                render: (row) => <DoorStatusBadge value={row.door_status} />
              },
              {
                key: "door_stable_ms",
                label: "Duration",
                render: (row) => formatDuration(row.door_stable_ms)
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
