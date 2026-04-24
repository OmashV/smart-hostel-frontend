import { useEffect, useMemo, useState, useCallback } from "react";
import {
  Line,
  Area,
  AreaChart,
  BarChart,
  Bar,
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

import DataTable from "../components/DataTable";
import LoadingState from "../components/LoadingState";
import EmptyState from "../components/EmptyState";

import { formatDate, formatDuration } from "../utils/format";

// ─── Severity badge ──────────────────────────────────────────────────────────
function SeverityBadge({ value }) {
  if (!value) return <span style={styles.badge.neutral}>—</span>;
  const s =
    value === "Critical"
      ? styles.badge.critical
      : value === "Warning"
      ? styles.badge.warning
      : styles.badge.neutral;
  return <span style={s}>{value}</span>;
}

// ─── Outside-band pill ───────────────────────────────────────────────────────
function BandPill({ value }) {
  if (value === null || value === undefined) {
    return <span style={styles.badge.neutral}>—</span>;
  }
  return value ? (
    <span style={styles.badge.critical}>Outside Band</span>
  ) : (
    <span style={styles.badge.ok}>Within Band</span>
  );
}

// ─── Anomaly score bar ───────────────────────────────────────────────────────
function ScoreBar({ score }) {
  if (score == null) return <span style={{ color: "#64748b" }}>—</span>;
  const normalised = Math.max(0, Math.min(1, (score + 0.5) / 1));
  const pct = Math.round(normalised * 100);
  const color = pct < 30 ? "#ef4444" : pct < 60 ? "#f97316" : "#22c55e";

  return (
    <div style={styles.scoreBar.wrap}>
      <div style={{ ...styles.scoreBar.fill, width: `${pct}%`, background: color }} />
      <span style={styles.scoreBar.label}>{score.toFixed(3)}</span>
    </div>
  );
}

// ─── Tooltips ────────────────────────────────────────────────────────────────
function TrendTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={styles.tooltip}>
      <p style={styles.tooltipTitle}>{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color, margin: "2px 0", fontSize: 12 }}>
          {p.name}: <strong>{p.value} min</strong>
        </p>
      ))}
    </div>
  );
}

function RoomOverviewTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;

  return (
    <div style={styles.tooltip}>
      <p style={styles.tooltipTitle}>Room {label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color, margin: "2px 0", fontSize: 12 }}>
          {p.name}: <strong>{p.value}</strong>
        </p>
      ))}
    </div>
  );
}

// ─── Refresh button ───────────────────────────────────────────────────────────
function RefreshButton({ onClick, loading }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      style={{
        ...styles.btn,
        opacity: loading ? 0.5 : 1,
        cursor: loading ? "not-allowed" : "pointer"
      }}
    >
      <span
        style={{
          display: "inline-block",
          animation: loading ? "spin 1s linear infinite" : "none"
        }}
      >
        ↻
      </span>{" "}
      {loading ? "Refreshing…" : "Refresh"}
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function SecurityDashboard() {
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
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [load]);

  const availableRooms = useMemo(() => {
    const ids = new Set();
    rooms.forEach((r) => r.room_id && ids.add(r.room_id));
    events.forEach((r) => r.room_id && ids.add(r.room_id));
    anomalies.forEach((r) => r.room_id && ids.add(r.room_id));
    return ["all", ...Array.from(ids).sort()];
  }, [rooms, events, anomalies]);

  // ── Single-room trend data ────────────────────────────────────────────────
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

  // ── All-rooms overview data ───────────────────────────────────────────────
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
      onClick={() => setSelectedRoom(row.room_id)}
      style={styles.roomLink}
    >
      {row.room_id}
    </button>
  );

  if (loading && !summary) return <LoadingState />;

  return (
    <div style={styles.page}>
      <style>{globalCss}</style>

      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>
            <span style={styles.titleIcon}>🔒</span> Security Dashboard
          </h1>
          {lastUpdated && (
            <p style={styles.subtitle}>
              ML-powered · Last updated {lastUpdated.toLocaleTimeString()} · auto-refreshes every 30 s
            </p>
          )}
        </div>
        <RefreshButton onClick={load} loading={loading} />
      </div>

      {error && <div style={styles.errorBanner}>⚠ {error}</div>}

      <div style={styles.scopeBar}>
        <span style={styles.scopeLabel}>Scope:</span>
        <select
          value={selectedRoom}
          onChange={(e) => setSelectedRoom(e.target.value)}
          style={styles.select}
        >
          {availableRooms.map((id) => (
            <option key={id} value={id}>
              {id === "all" ? "All Rooms" : id}
            </option>
          ))}
        </select>

        {selectedRoom !== "all" && (
          <button
            type="button"
            onClick={() => setSelectedRoom("all")}
            style={styles.btnGhost}
          >
            ← All Rooms
          </button>
        )}

        {selectedRoom !== "all" && (
          <span style={styles.scopePill}>{selectedRoom}</span>
        )}
      </div>

      <div style={styles.kpiGrid}>
        <KpiCard
          label="Active Alerts"
          value={summary?.active_security_alerts ?? 0}
          accent="#ef4444"
          icon="🚨"
        />
        <KpiCard
          label="Suspicious Rooms"
          value={summary?.suspicious_rooms ?? 0}
          accent="#f97316"
          icon="🚪"
        />
        <KpiCard
          label="High-Risk Rooms"
          value={summary?.high_risk_rooms ?? 0}
          accent="#eab308"
          icon="⚠️"
        />
        <KpiCard
          label="After-Hours Events"
          value={summary?.after_hours_events ?? 0}
          accent="#8b5cf6"
          icon="🌙"
        />
        <KpiCard
          label="ML Anomalies"
          value={anomalies.length}
          accent="#06b6d4"
          icon="🤖"
          tag="Isolation Forest"
        />
      </div>

      <section style={styles.card}>
        <div style={styles.cardHeader}>
          <div>
            <h2 style={styles.cardTitle}>
              {selectedRoom === "all"
                ? "All Rooms Security Overview"
                : "Door Behaviour Trend"}
              {selectedRoom !== "all" && (
                <span style={styles.roomTag}> — {selectedRoom}</span>
              )}
            </h2>
            <p style={styles.cardDesc}>
              {selectedRoom === "all"
                ? "Compare rooms using average door-open duration and anomaly counts."
                : "Prophet-forecasted expected duration (with 95 % confidence band) vs recent actual behaviour. Points outside the shaded band are flagged as anomalous."}
            </p>
          </div>
          <span style={styles.mlBadge}>
            {selectedRoom === "all" ? "Overview" : "Prophet"}
          </span>
        </div>

        {selectedRoom === "all" ? (
          roomOverviewData.length ? (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart
                data={roomOverviewData}
                margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="room_id" tick={{ fill: "#64748b", fontSize: 11 }} />
                <YAxis tick={{ fill: "#64748b", fontSize: 11 }} />
                <Tooltip content={<RoomOverviewTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12, color: "#64748b" }} />
                <Bar
                  dataKey="duration_min"
                  name="Avg Door Duration (min)"
                  radius={[6, 6, 0, 0]}
                  fill="#6366f1"
                />
                <Bar
                  dataKey="anomaly_count"
                  name="Anomaly Count"
                  radius={[6, 6, 0, 0]}
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
                <linearGradient id="bandGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0.02} />
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="hour" tick={{ fill: "#94a3b8", fontSize: 11 }} />
              <YAxis
                tick={{ fill: "#94a3b8", fontSize: 11 }}
                label={{
                  value: "min",
                  angle: -90,
                  position: "insideLeft",
                  fill: "#64748b",
                  fontSize: 11
                }}
              />
              <Tooltip content={<TrendTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12, color: "#94a3b8" }} />

              {trendData[0]?.upper != null && (
                <Area
                  dataKey="upper"
                  name="Upper Bound (95%)"
                  stroke="#6366f1"
                  strokeWidth={1}
                  strokeDasharray="4 4"
                  fill="url(#bandGrad)"
                  dot={false}
                  activeDot={false}
                  legendType="none"
                />
              )}
              {trendData[0]?.lower != null && (
                <Area
                  dataKey="lower"
                  name="Lower Bound (95%)"
                  stroke="#6366f1"
                  strokeWidth={1}
                  strokeDasharray="4 4"
                  fill="transparent"
                  dot={false}
                  activeDot={false}
                  legendType="none"
                />
              )}

              <Line
                dataKey="expected"
                name="Expected (Prophet)"
                stroke="#6366f1"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 5 }}
              />
              <Line
                dataKey="actual"
                name="Actual"
                stroke="#f97316"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 5 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState text="No trend data available." />
        )}
      </section>

      <section style={styles.card}>
        <div style={styles.cardHeader}>
          <div>
            <h2 style={styles.cardTitle}>
              Detected Anomalies
              {selectedRoom !== "all" && (
                <span style={styles.roomTag}> — {selectedRoom}</span>
              )}
            </h2>
            <p style={styles.cardDesc}>
              Flagged by Isolation Forest using learned patterns across door duration,
              motion, occupancy and time context — not hardcoded rules.
            </p>
          </div>
          <span style={styles.mlBadge}>Isolation Forest</span>
        </div>

        {anomalies.length ? (
          <DataTable
            columns={[
              {
                key: "room_id",
                label: "Room",
                render: renderRoomLink
              },
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
                  row.door_stable_min != null ? (
                    <span style={{ fontVariantNumeric: "tabular-nums" }}>
                      {row.door_stable_min} min
                    </span>
                  ) : (
                    "—"
                  )
              },
              {
                key: "expected_door_stable_min",
                label: "Expected",
                render: (row) =>
                  row.expected_door_stable_min != null ? (
                    <span
                      style={{
                        color: "#6366f1",
                        fontVariantNumeric: "tabular-nums"
                      }}
                    >
                      {row.expected_door_stable_min} min
                    </span>
                  ) : (
                    "—"
                  )
              },
              {
                key: "reason",
                label: "Reason",
                render: (row) =>
                  row.reason ? (
                    <span style={styles.reasonText}>{row.reason}</span>
                  ) : (
                    "—"
                  )
              },
              {
                key: "captured_at",
                label: "Time",
                render: (row) => (
                  <span style={{ color: "#94a3b8", fontSize: 12 }}>
                    {formatDate(row.captured_at)}
                  </span>
                )
              }
            ]}
            rows={anomalies}
          />
        ) : (
          <EmptyState text="No anomalies detected." />
        )}
      </section>

      <section style={styles.card}>
        <div style={styles.cardHeader}>
          <div>
            <h2 style={styles.cardTitle}>
              Suspicious Room Activity
              {selectedRoom !== "all" && (
                <span style={styles.roomTag}> — {selectedRoom}</span>
              )}
            </h2>
            <p style={styles.cardDesc}>
              Rooms with unusually long open-door durations or after-hours motion.
            </p>
          </div>
        </div>

        {rooms.length ? (
          <DataTable
            columns={[
              { key: "room_id", label: "Room", render: renderRoomLink },
              {
                key: "door_status",
                label: "Door",
                render: (row) => (
                  <span
                    style={{
                      ...styles.badge.neutral,
                      background:
                        row.door_status === "Open" ? "#fef2f2" : "#f0fdf4",
                      color:
                        row.door_status === "Open" ? "#ef4444" : "#16a34a",
                      borderColor:
                        row.door_status === "Open" ? "#fecaca" : "#bbf7d0"
                    }}
                  >
                    {row.door_status}
                  </span>
                )
              },
              {
                key: "door_stable_ms",
                label: "Duration",
                render: (row) => {
                  const min = row.door_stable_ms / 60000;
                  const color =
                    min > 60 ? "#ef4444" : min > 30 ? "#f97316" : "#64748b";
                  return (
                    <span style={{ color, fontWeight: 600 }}>
                      {formatDuration(row.door_stable_ms)}
                    </span>
                  );
                }
              },
              {
                key: "motion_count",
                label: "Motion Events",
                render: (row) => (
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>
                    {row.motion_count}
                  </span>
                )
              },
              {
                key: "captured_at",
                label: "Time",
                render: (row) => (
                  <span style={{ color: "#94a3b8", fontSize: 12 }}>
                    {formatDate(row.captured_at)}
                  </span>
                )
              }
            ]}
            rows={rooms}
          />
        ) : (
          <EmptyState text="No suspicious rooms." />
        )}
      </section>

      <section style={styles.card}>
        <div style={styles.cardHeader}>
          <div>
            <h2 style={styles.cardTitle}>
              Recent Door Events
              {selectedRoom !== "all" && (
                <span style={styles.roomTag}> — {selectedRoom}</span>
              )}
            </h2>
            <p style={styles.cardDesc}>
              Latest door activity for real-time monitoring.
            </p>
          </div>
          <span
            style={{
              ...styles.mlBadge,
              background: "#ecfeff",
              color: "#0e7490",
              borderColor: "#a5f3fc"
            }}
          >
            Live
          </span>
        </div>

        {events.length ? (
          <DataTable
            columns={[
              { key: "room_id", label: "Room", render: renderRoomLink },
              {
                key: "door_status",
                label: "Door",
                render: (row) => (
                  <span
                    style={{
                      ...styles.badge.neutral,
                      background:
                        row.door_status === "Open" ? "#fef2f2" : "#f0fdf4",
                      color:
                        row.door_status === "Open" ? "#ef4444" : "#16a34a",
                      borderColor:
                        row.door_status === "Open" ? "#fecaca" : "#bbf7d0"
                    }}
                  >
                    {row.door_status}
                  </span>
                )
              },
              {
                key: "door_stable_ms",
                label: "Duration",
                render: (row) => {
                  const min = row.door_stable_ms / 60000;
                  const color =
                    min > 60 ? "#ef4444" : min > 30 ? "#f97316" : "#64748b";
                  return (
                    <span style={{ color, fontWeight: 600 }}>
                      {formatDuration(row.door_stable_ms)}
                    </span>
                  );
                }
              },
              {
                key: "motion_count",
                label: "Motion",
                render: (row) => (
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>
                    {row.motion_count}
                  </span>
                )
              },
              {
                key: "captured_at",
                label: "Time",
                render: (row) => (
                  <span style={{ color: "#94a3b8", fontSize: 12 }}>
                    {formatDate(row.captured_at)}
                  </span>
                )
              }
            ]}
            rows={events}
          />
        ) : (
          <EmptyState text="No recent events." />
        )}
      </section>
    </div>
  );
}

// ─── KPI card ────────────────────────────────────────────────────────────────
function KpiCard({ label, value, accent, icon, tag }) {
  return (
    <div style={{ ...styles.kpiCard, borderTopColor: accent }}>
      <div style={styles.kpiTop}>
        <span style={styles.kpiIcon}>{icon}</span>
        {tag && (
          <span style={{ ...styles.mlBadge, fontSize: 9, padding: "2px 6px" }}>
            {tag}
          </span>
        )}
      </div>
      <p style={{ ...styles.kpiValue, color: accent }}>{value}</p>
      <p style={styles.kpiLabel}>{label}</p>
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = {
  page: {
    background: "#f8fafc",
    minHeight: "100vh",
    padding: "28px 24px",
    fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
    color: "#1e293b"
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 24,
    flexWrap: "wrap",
    gap: 12
  },
  title: {
    fontSize: 26,
    fontWeight: 700,
    color: "#0f172a",
    margin: 0,
    letterSpacing: "-0.5px"
  },
  titleIcon: { marginRight: 8 },
  subtitle: {
    fontSize: 12,
    color: "#94a3b8",
    margin: "4px 0 0"
  },
  scopeBar: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 20,
    padding: "12px 16px",
    background: "#ffffff",
    borderRadius: 10,
    border: "1px solid #e2e8f0",
    flexWrap: "wrap"
  },
  scopeLabel: { fontWeight: 600, color: "#64748b", fontSize: 13 },
  select: {
    padding: "7px 12px",
    borderRadius: 8,
    border: "1px solid #e2e8f0",
    background: "#f8fafc",
    color: "#1e293b",
    fontSize: 13,
    cursor: "pointer",
    outline: "none"
  },
  scopePill: {
    background: "#eff6ff",
    color: "#1d4ed8",
    padding: "3px 10px",
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 600
  },
  kpiGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
    gap: 14,
    marginBottom: 20
  },
  kpiCard: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderTop: "3px solid",
    borderRadius: 12,
    padding: "16px 18px",
    transition: "transform 0.15s",
    boxShadow: "0 1px 3px rgba(0,0,0,0.04)"
  },
  kpiTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6
  },
  kpiIcon: { fontSize: 20 },
  kpiValue: {
    fontSize: 32,
    fontWeight: 800,
    margin: "4px 0 2px",
    letterSpacing: "-1px",
    fontVariantNumeric: "tabular-nums"
  },
  kpiLabel: {
    fontSize: 11,
    color: "#94a3b8",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    margin: 0
  },
  card: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 14,
    padding: "20px 22px",
    marginBottom: 18,
    boxShadow: "0 1px 3px rgba(0,0,0,0.04)"
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 14,
    gap: 10,
    flexWrap: "wrap"
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: "#0f172a",
    margin: "0 0 4px"
  },
  roomTag: { color: "#4f46e5", fontWeight: 600 },
  cardDesc: {
    fontSize: 12,
    color: "#94a3b8",
    margin: 0,
    maxWidth: 560,
    lineHeight: 1.5
  },
  mlBadge: {
    display: "inline-block",
    fontSize: 10,
    fontWeight: 700,
    padding: "3px 8px",
    borderRadius: 6,
    background: "#eef2ff",
    color: "#4338ca",
    border: "1px solid #c7d2fe",
    whiteSpace: "nowrap",
    letterSpacing: "0.3px",
    textTransform: "uppercase"
  },
  badge: {
    critical: {
      display: "inline-block",
      padding: "2px 10px",
      borderRadius: 20,
      fontSize: 11,
      fontWeight: 700,
      background: "#fef2f2",
      color: "#dc2626",
      border: "1px solid #fecaca"
    },
    warning: {
      display: "inline-block",
      padding: "2px 10px",
      borderRadius: 20,
      fontSize: 11,
      fontWeight: 700,
      background: "#fff7ed",
      color: "#ea580c",
      border: "1px solid #fed7aa"
    },
    ok: {
      display: "inline-block",
      padding: "2px 10px",
      borderRadius: 20,
      fontSize: 11,
      fontWeight: 700,
      background: "#f0fdf4",
      color: "#16a34a",
      border: "1px solid #bbf7d0"
    },
    neutral: {
      display: "inline-block",
      padding: "2px 10px",
      borderRadius: 20,
      fontSize: 11,
      fontWeight: 600,
      background: "#f1f5f9",
      color: "#94a3b8",
      border: "1px solid #e2e8f0"
    }
  },
  scoreBar: {
    wrap: {
      position: "relative",
      width: 90,
      height: 18,
      background: "#f1f5f9",
      borderRadius: 4,
      overflow: "hidden",
      border: "1px solid #e2e8f0"
    },
    fill: {
      position: "absolute",
      top: 0,
      left: 0,
      height: "100%",
      borderRadius: 4,
      opacity: 0.5,
      transition: "width 0.4s ease"
    },
    label: {
      position: "absolute",
      top: 0,
      left: 0,
      width: "100%",
      height: "100%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: 10,
      fontWeight: 700,
      color: "#1e293b",
      fontVariantNumeric: "tabular-nums"
    }
  },
  roomLink: {
    background: "none",
    border: "none",
    padding: 0,
    color: "#4f46e5",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 13,
    textDecoration: "underline",
    textDecorationStyle: "dotted",
    textUnderlineOffset: 3
  },
  reasonText: {
    fontSize: 12,
    color: "#94a3b8",
    fontStyle: "italic"
  },
  btn: {
    padding: "8px 14px",
    borderRadius: 8,
    border: "1px solid #e2e8f0",
    background: "#ffffff",
    color: "#1e293b",
    fontWeight: 600,
    fontSize: 13,
    display: "flex",
    alignItems: "center",
    gap: 6,
    boxShadow: "0 1px 2px rgba(0,0,0,0.05)"
  },
  btnGhost: {
    padding: "6px 12px",
    borderRadius: 8,
    border: "1px solid #e2e8f0",
    background: "transparent",
    color: "#64748b",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 600
  },
  errorBanner: {
    background: "#fef2f2",
    color: "#b91c1c",
    border: "1px solid #fecaca",
    borderRadius: 10,
    padding: "12px 16px",
    marginBottom: 16,
    fontSize: 13,
    fontWeight: 600
  },
  tooltip: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 8,
    padding: "10px 14px",
    boxShadow: "0 4px 16px rgba(0,0,0,0.08)"
  },
  tooltipTitle: {
    color: "#0f172a",
    fontWeight: 700,
    fontSize: 13,
    margin: "0 0 6px"
  }
};

const globalCss = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700;800&display=swap');
  @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
`;