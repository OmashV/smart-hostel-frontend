import { useEffect, useMemo, useState } from "react";
import {
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
  HiOutlineBolt,
  HiOutlineChartBarSquare,
  HiOutlineBuildingOffice2,
  HiOutlineExclamationTriangle,
  HiOutlineInformationCircle
} from "react-icons/hi2";

import {
  getEnergyForecast,
  getEnergyHistory,
  getOwnerAlerts,
  resolveOwnerAlert,
  deleteOwnerAlert,
  getOwnerAnomalies,
  getOwnerWeekdayPatterns,
  getOwnerKpis,
  getOwnerPatterns,
  getOwnerRoomsOverview
} from "../api/client";
import { mergeHistoryWithForecast } from "../utils/chart";
import { formatDate, formatKwh } from "../utils/format";
import FilterBar from "../components/FilterBar";
import StatCard from "../components/StatCard";
import SectionCard from "../components/SectionCard";
import LoadingState from "../components/LoadingState";
import StatusBadge from "../components/StatusBadge";

function AlertCard({ alert, onResolve, onDelete }) {
  const cls =
    alert.severity === "Critical"
      ? "alert-card critical"
      : alert.severity === "Warning"
      ? "alert-card warning"
      : "alert-card info";

  const icon =
    alert.severity === "Critical" || alert.severity === "Warning" ? (
      <HiOutlineExclamationTriangle />
    ) : (
      <HiOutlineInformationCircle />
    );

  const displayDate = alert.captured_at || alert.date;

  return (
    <div className={cls}>
      <div className="alert-title-row">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 18 }}>{icon}</span>
          <strong>{alert.title}</strong>
        </div>
        <span className="alert-badge">{alert.severity}</span>
      </div>

      <p>{alert.message}</p>

      <div className="alert-meta">
        <span>{alert.room_id}</span>
        <span>{formatDate(displayDate)}</span>
      </div>

      <div className="alert-actions">
        <button
          type="button"
          className="alert-action-btn resolve"
          onClick={() => onResolve(alert._id)}
        >
          Resolve
        </button>
        <button
          type="button"
          className="alert-action-btn delete"
          onClick={() => onDelete(alert._id)}
        >
          Delete
        </button>
      </div>
    </div>
  );
}

function OwnerRoomTile({ room }) {
  const isCritical = room.waste_stat === "Critical";
  const isWarning =
    room.noise_stat === "Warning" || room.noise_stat === "Violation";

  const tileClass = isCritical
    ? "owner-room-tile critical"
    : isWarning
    ? "owner-room-tile warning"
    : "owner-room-tile normal";

  const dotClass = isCritical ? "red" : isWarning ? "orange" : "green";

  return (
    <div className={tileClass}>
      <div className="tile-top">
        <div>
          <h3>{room.room_id}</h3>
          <p className="tile-subtext">Room overview</p>
        </div>
        <span className={`tile-dot ${dotClass}`} />
      </div>

      {room.alert_count > 0 && (
        <div className="tile-alert-pill">
          {room.alert_count} Alert{room.alert_count > 1 ? "s" : ""}
        </div>
      )}

      <div className="tile-metrics">
        <div className="tile-row">
          <span>Occupancy</span>
          <strong>{room.occupancy_stat}</strong>
        </div>
        <div className="tile-row">
          <span>Energy</span>
          <strong>{Number(room.total_energy_kwh || 0).toFixed(2)} kWh</strong>
        </div>
        <div className="tile-row">
          <span>Waste</span>
          <strong>{Number(room.wasted_energy_kwh || 0).toFixed(2)} kWh</strong>
        </div>
        <div className="tile-row">
          <span>Waste Ratio</span>
          <strong>{Number(room.waste_ratio_percent || 0).toFixed(2)}%</strong>
        </div>
      </div>

      <div className="tile-badges">
        <span className="badge-label-wrap">
          <small className="badge-label">Noise</small>
          <StatusBadge value={room.noise_stat} />
        </span>
        <span className="badge-label-wrap">
          <small className="badge-label">Waste</small>
          <StatusBadge value={room.waste_stat} />
        </span>
      </div>

      <div className="tile-footer">
        Last Activity <span>{formatDate(room.last_activity)}</span>
      </div>
    </div>
  );
}

export default function OwnerDashboard() {
  const [roomId, setRoomId] = useState(() => {
    try {
      return localStorage.getItem("smart-hostel.owner.roomId") || "all";
    } catch {
      return "all";
    }
  });
  const [forecastDays, setForecastDays] = useState(() => {
    try {
      const raw = Number(localStorage.getItem("smart-hostel.owner.forecastDays"));
      return raw === 7 ? 7 : 5;
    } catch {
      return 5;
    }
  });
  const [loading, setLoading] = useState(true);

  const [kpis, setKpis] = useState(null);
  const [roomsOverview, setRoomsOverview] = useState([]);
  const [alerts, setAlerts] = useState([]);

  const [history, setHistory] = useState([]);
  const [forecast, setForecast] = useState([]);
  const [anomalies, setAnomalies] = useState([]);
  const [patterns, setPatterns] = useState([]);
  const [weekdayPatterns, setWeekdayPatterns] = useState([]);

  const [selectedDay, setSelectedDay] = useState(null);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });

  useEffect(() => {
    try {
      localStorage.setItem("smart-hostel.owner.roomId", roomId);
    } catch {
      // Ignore persistence failures.
    }
  }, [roomId]);

  useEffect(() => {
    try {
      localStorage.setItem("smart-hostel.owner.forecastDays", String(forecastDays));
    } catch {
      // Ignore persistence failures.
    }
  }, [forecastDays]);

  useEffect(() => {
    let liveInterval;
    let analyticsInterval;

    async function loadAllRoomsView() {
      try {
        const [overviewRes, alertsRes] = await Promise.all([
          getOwnerRoomsOverview(),
          getOwnerAlerts().catch(() => ({ alerts: [] }))
        ]);
    
        const rooms = overviewRes.rooms || [];
        const liveAlerts = alertsRes.alerts || [];
    
        setRoomsOverview(rooms);
        setAlerts(liveAlerts);
    
        const totalEnergy = rooms.reduce(
          (sum, r) => sum + Number(r.total_energy_kwh || 0),
          0
        );
        const wastedEnergy = rooms.reduce(
          (sum, r) => sum + Number(r.wasted_energy_kwh || 0),
          0
        );
        const wasteRatio =
          totalEnergy > 0
            ? Number(((wastedEnergy / totalEnergy) * 100).toFixed(2))
            : 0;
        const highWasteRooms = rooms.filter(
          (r) => r.waste_stat === "Critical"
        ).length;
    
        setKpis({
          total_energy_today_kwh: totalEnergy,
          wasted_energy_today_kwh: wastedEnergy,
          waste_ratio_today_percent: wasteRatio,
          current_waste_status: `${highWasteRooms} High Waste Rooms`
        });
      } catch (error) {
        console.error("All rooms refresh failed:", error);
      } finally {
        setLoading(false);
      }
    }

    async function loadSingleRoomLive() {
      try {
        const [kpiRes, historyRes] = await Promise.all([
          getOwnerKpis(roomId),
          getEnergyHistory(roomId)
        ]);

        setKpis(kpiRes);
        setHistory(historyRes.history || []);
        setRoomsOverview([]);
        setAlerts([]);
      } catch (error) {
        console.error("Single room live refresh failed:", error);
      } finally {
        setLoading(false);
      }
    }

    async function loadSingleRoomAnalytics() {
      try {
        const [forecastRes, anomalyRes, patternRes, weekdayRes] = await Promise.all([
          getEnergyForecast(roomId, forecastDays).catch(() => ({
            history: [],
            forecast: []
          })),
          getOwnerAnomalies(roomId).catch(() => ({ items: [] })),
          getOwnerPatterns().catch(() => ({ items: [] })),
          getOwnerWeekdayPatterns(roomId).catch(() => ({ items: [] }))
        ]);
    
        setForecast(forecastRes.forecast || []);
        setAnomalies(anomalyRes.items || []);
        setPatterns(patternRes.items || []);
        setWeekdayPatterns(weekdayRes.items || []);
      } catch (error) {
        console.error("Single room analytics refresh failed:", error);
      }
    }

    setLoading(true);

    if (roomId === "all") {
      loadAllRoomsView();
      liveInterval = setInterval(loadAllRoomsView, 10000);
    } else {
      loadSingleRoomLive();
      loadSingleRoomAnalytics();

      liveInterval = setInterval(loadSingleRoomLive, 10000);
      analyticsInterval = setInterval(loadSingleRoomAnalytics, 60000);
    }

    return () => {
      if (liveInterval) clearInterval(liveInterval);
      if (analyticsInterval) clearInterval(analyticsInterval);
    };
  }, [roomId, forecastDays]);

  useEffect(() => {
    if (roomId === "all" || !history.length) return;

    const latest = history[history.length - 1];
    const latestDate = new Date(latest.date);

    if (!Number.isNaN(latestDate.getTime())) {
      setCalendarMonth(
        new Date(latestDate.getFullYear(), latestDate.getMonth(), 1)
      );

      const key = `${latestDate.getFullYear()}-${String(
        latestDate.getMonth() + 1
      ).padStart(2, "0")}-${String(latestDate.getDate()).padStart(2, "0")}`;

      setSelectedDay({
        ...latest,
        date: key
      });
    }
  }, [history, roomId]);

  const chartData = useMemo(
    () => mergeHistoryWithForecast(history, forecast),
    [history, forecast]
  );
  const forecastSplitDate = useMemo(() => {
    if (!history.length || !forecast.length) return null;
    return history[history.length - 1]?.date || null;
  }, [history, forecast]);

  const patternByDate = useMemo(() => {
    return patterns.reduce((acc, item) => {
      if (item?.date) {
        acc[item.date] = item.pattern_name;
      }
      return acc;
    }, {});
  }, [patterns]);

  const historyByDate = useMemo(() => {
    const toDateKey = (rawDate) => {
      if (!rawDate) return "";
      if (typeof rawDate === "string" && rawDate.length >= 10) {
        return rawDate.slice(0, 10);
      }

      const parsed = new Date(rawDate);
      if (Number.isNaN(parsed.getTime())) return "";

      const y = parsed.getFullYear();
      const m = String(parsed.getMonth() + 1).padStart(2, "0");
      const d = String(parsed.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    };

    const latestHistoryDateKey =
      history.length > 0 ? toDateKey(history[history.length - 1]?.date) : "";

    const currentKpiStatus = String(kpis?.current_waste_status || "").toLowerCase();
    const kpiStatusNormalized =
      currentKpiStatus.includes("critical")
        ? "critical"
        : currentKpiStatus.includes("warning")
        ? "warning"
        : currentKpiStatus.includes("normal")
        ? "normal"
        : "";

    return history.reduce((acc, item) => {
      const key = toDateKey(item.date);
      if (!key) return acc;

      const total = Number(item.total_energy_kwh || 0);
      const waste = Number(item.wasted_energy_kwh || 0);
      const ratio =
        item.waste_ratio_percent !== undefined && item.waste_ratio_percent !== null
          ? Number(Number(item.waste_ratio_percent).toFixed(2))
          : total > 0
          ? Number(((waste / total) * 100).toFixed(2))
          : 0;

      const rawStatus = String(
        item.waste_stat || item.waste_status || item.current_waste_status || ""
      )
        .toLowerCase()
        .trim();

        const patternName = patternByDate[key];

        const wasteStatus =
          patternName === "High Waste Pattern"
            ? "critical"
            : patternName === "Moderate Waste"
            ? "warning"
            : patternName === "Efficient Usage"
            ? "normal"
            : rawStatus === "critical"
            ? "critical"
            : rawStatus === "warning"
            ? "warning"
            : rawStatus === "normal" || rawStatus === "ok"
            ? "normal"
            : key === latestHistoryDateKey && kpiStatusNormalized
            ? kpiStatusNormalized
            : ratio >= 30
            ? "critical"
            : ratio >= 15
            ? "warning"
            : "normal";

      acc[key] = {
        ...item,
        date: key,
        waste_ratio_percent: ratio,
        waste_status: wasteStatus
      };

      return acc;
    }, {});
  }, [history, kpis, patternByDate]);

  const calendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const first = new Date(year, month, 1);
    const start = new Date(year, month, 1 - first.getDay());

    return Array.from({ length: 42 }, (_, idx) => {
      const date = new Date(start);
      date.setDate(start.getDate() + idx);

      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
        2,
        "0"
      )}-${String(date.getDate()).padStart(2, "0")}`;

      return {
        key,
        date,
        dayNumber: date.getDate(),
        isCurrentMonth: date.getMonth() === month,
        data: historyByDate[key] || null
      };
    });
  }, [calendarMonth, historyByDate]);

  const selectedDayData = selectedDay?.date
    ? historyByDate[selectedDay.date] || selectedDay
    : null;

  const monthTitle = calendarMonth.toLocaleString("en-US", {
    month: "long",
    year: "numeric"
  });

  const handleCalendarDayClick = (day) => {
    if (day.data) setSelectedDay(day.data);
  };

  const renderForecastLegend = ({ payload = [] }) => (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        gap: 14,
        flexWrap: "wrap"
      }}
    >
      {payload.map((entry) => (
        <span
          key={entry.value}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            color: entry.color,
            fontSize: 13,
            fontWeight: 600
          }}
        >
          <i
            style={{
              width: 18,
              borderTop: `2px ${String(entry.value).includes("Predicted") ? "dashed" : "solid"} ${entry.color}`
            }}
          />
          {entry.value}
        </span>
      ))}
    </div>
  );

  const resolvedWasteRatio = useMemo(() => {
    if (kpis?.waste_ratio_today_percent !== undefined && kpis?.waste_ratio_today_percent !== null) {
      return Number(kpis.waste_ratio_today_percent).toFixed(2);
    }
  
    const total = Number(kpis?.total_energy_today_kwh || 0);
    const waste = Number(kpis?.wasted_energy_today_kwh || 0);
  
    return total > 0 ? ((waste / total) * 100).toFixed(2) : "0.00";
  }, [kpis]);
  
  const resolvedWasteStatus = useMemo(() => {
    if (kpis?.current_waste_status && String(kpis.current_waste_status).trim() !== "") {
      return kpis.current_waste_status;
    }
  
    const ratio = Number(resolvedWasteRatio);
  
    if (ratio >= 30) return "Critical";
    if (ratio >= 15) return "Warning";
    return "Normal";
  }, [kpis, resolvedWasteRatio]);

  const handleResolveAlert = async (alertId) => {
    try {
      await resolveOwnerAlert(alertId);
      setAlerts((prev) => prev.filter((item) => item._id !== alertId));
    } catch (error) {
      console.error("Resolve alert failed:", error);
    }
  };
  
  const handleDeleteAlert = async (alertId) => {
    try {
      await deleteOwnerAlert(alertId);
      setAlerts((prev) => prev.filter((item) => item._id !== alertId));
    } catch (error) {
      console.error("Delete alert failed:", error);
    }
  };

  const patternSummary = useMemo(() => {
    if (!patterns.length) {
      return {
        latestPattern: "-",
        mostCommonPattern: "-",
        highWasteDays: 0,
        efficientDays: 0
      };
    }
  
    const sorted = [...patterns].sort((a, b) => b.date.localeCompare(a.date));
    const latestPattern = sorted[0]?.pattern_name || "-";
  
    const counts = patterns.reduce((acc, item) => {
      const key = item.pattern_name || "Unknown";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  
    const mostCommonPattern =
      Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || "-";
  
    return {
      latestPattern,
      mostCommonPattern,
      highWasteDays: counts["High Waste Pattern"] || 0,
      efficientDays: counts["Efficient Usage"] || 0
    };
  }, [patterns]);

  if (loading) return <LoadingState />;

  return (
    <div className="page-grid owner-dashboard">
      <FilterBar
        roomId={roomId}
        setRoomId={setRoomId}
        forecastDays={forecastDays}
        setForecastDays={setForecastDays}
      />

      <div className="stats-grid">
        <StatCard
          title="Total Energy Today"
          value={formatKwh(kpis?.total_energy_today_kwh)}
          subtitle="Current daily usage"
          icon={<HiOutlineBolt />}
          tone="orange"
        />
        <StatCard
          title="Wasted Energy Today"
          value={formatKwh(kpis?.wasted_energy_today_kwh)}
          subtitle="Energy lost due to waste"
          icon={<HiOutlineChartBarSquare />}
          tone="purple"
        />
        <StatCard
          title="Waste Ratio Today"
          value={`${resolvedWasteRatio}%`}
          subtitle="Compared with total usage"
          icon={<HiOutlineBuildingOffice2 />}
          tone="green"
        />

        <StatCard
          title="Current Waste Status"
          value={resolvedWasteStatus}
          subtitle="Latest room waste condition"
          icon={<HiOutlineExclamationTriangle />}
          tone="red"
        />
      </div>

      {roomId === "all" ? (
        <div className="owner-top-grid">
          <SectionCard title="Room Overview">
            <div className="owner-room-grid">
              {roomsOverview.map((room) => (
                <OwnerRoomTile key={room.room_id} room={room} />
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Active Alerts">
            <div className="alerts-list">
            {alerts.length ? (
              alerts.map((alert) => (
                <AlertCard
                  key={alert._id}
                  alert={alert}
                  onResolve={handleResolveAlert}
                  onDelete={handleDeleteAlert}
                />
              ))
            ) : (
              <p>No active owner-level alerts right now.</p>
            )}
            </div>
          </SectionCard>
        </div>
      ) : (
        <>
          <SectionCard title="Historical and Forecasted Energy Trend">
            <ResponsiveContainer width="100%" height={360}>
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#d9e1ec" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "#64748b", fontSize: 12 }}
                  tickLine={false}
                  axisLine={{ stroke: "#e2e8f0" }}
                />
                <YAxis
                  tick={{ fill: "#64748b", fontSize: 12 }}
                  tickLine={false}
                  axisLine={{ stroke: "#e2e8f0" }}
                />
                <Tooltip
                  contentStyle={{
                    background: "#ffffff",
                    border: "1px solid #dbe2ea",
                    borderRadius: "12px",
                    color: "#172033",
                    boxShadow: "0 10px 24px rgba(15, 23, 42, 0.08)"
                  }}
                />
                {forecastSplitDate ? (
                  <ReferenceLine
                    x={forecastSplitDate}
                    stroke="#94a3b8"
                    strokeDasharray="4 4"
                    ifOverflow="visible"
                    label={{
                      value: "forecast",
                      position: "insideTopLeft",
                      fill: "#0f172a",
                      fontSize: 13
                    }}
                  />
                ) : null}
                <Legend content={renderForecastLegend} />
                <Line
                  type="monotone"
                  dataKey="total_energy_kwh"
                  name="Actual Energy"
                  stroke="#2563eb"
                  strokeWidth={2.6}
                  dot={false}
                  connectNulls
                  legendType="plainline"
                />
                <Line
                  type="monotone"
                  dataKey="wasted_energy_kwh"
                  name="Actual Waste"
                  stroke="#f59e0b"
                  strokeWidth={2.2}
                  dot={false}
                  connectNulls
                  legendType="plainline"
                />
                <Line
                  type="monotone"
                  dataKey="predicted_total_energy_kwh"
                  name="Predicted Energy"
                  stroke="#2563eb"
                  strokeWidth={2.6}
                  strokeDasharray="10 6"
                  dot={false}
                  connectNulls
                  legendType="plainline"
                />
                <Line
                  type="monotone"
                  dataKey="predicted_wasted_energy_kwh"
                  name="Predicted Waste"
                  stroke="#f59e0b"
                  strokeWidth={2.2}
                  strokeDasharray="10 6"
                  dot={false}
                  connectNulls
                  legendType="plainline"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </SectionCard>

          <SectionCard title="Abnormal Waste Days">
            {anomalies.length ? (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Room</th>
                      <th>Date</th>
                      <th>Total Energy (kWh)</th>
                      <th>Wasted Energy (kWh)</th>
                      <th>Status</th>
                      <th>Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {anomalies.map((item, idx) => (
                      <tr key={idx}>
                        <td>{item.room_id}</td>
                        <td>{item.date}</td>
                        <td>{Number(item.total_energy_kwh || 0).toFixed(2)}</td>
                        <td>{Number(item.wasted_energy_kwh || 0).toFixed(2)}</td>
                        <td>{item.status || "Abnormal"}</td>
                        <td>{item.reason || "Unusual waste pattern detected"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p>No abnormal waste days detected yet.</p>
            )}
          </SectionCard>

          <SectionCard title="Weekly Pattern Discovery">
            {weekdayPatterns.length ? (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Day</th>
                      <th>Type</th>
                      <th>Usual Pattern</th>
                      <th>Avg Energy (kWh)</th>
                      <th>Avg Waste (kWh)</th>
                      <th>Avg Waste Ratio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {weekdayPatterns.map((item, idx) => (
                      <tr key={idx}>
                        <td>{item.weekday_name}</td>
                        <td>{item.day_type}</td>
                        <td>
                          <span
                            className={
                              item.usual_pattern === "Efficient Usage"
                                ? "badge ok"
                                : item.usual_pattern === "Moderate Waste"
                                ? "badge warning"
                                : "badge danger"
                            }
                          >
                            {item.usual_pattern}
                          </span>
                        </td>
                        <td>{Number(item.avg_total_energy_kwh || 0).toFixed(2)}</td>
                        <td>{Number(item.avg_wasted_energy_kwh || 0).toFixed(2)}</td>
                        <td>{Number(item.avg_waste_ratio_percent || 0).toFixed(2)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p>No weekday pattern discovery available yet.</p>
            )}
          </SectionCard>
          <SectionCard title="Monthly Waste Calendar">
            <div className="owner-calendar-wrap">
              <div className="owner-calendar-toolbar">
                <button
                  type="button"
                  className="calendar-nav-btn"
                  onClick={() =>
                    setCalendarMonth(
                      (prev) =>
                        new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
                    )
                  }
                >
                  Prev
                </button>

                <strong>{monthTitle}</strong>

                <button
                  type="button"
                  className="calendar-nav-btn"
                  onClick={() =>
                    setCalendarMonth(
                      (prev) =>
                        new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
                    )
                  }
                >
                  Next
                </button>
              </div>

              <div className="owner-calendar-weekdays">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                  <span key={day}>{day}</span>
                ))}
              </div>

              <div className="owner-calendar-grid">
                {calendarDays.map((day) => (
                  <button
                    key={day.key}
                    type="button"
                    disabled={!day.data}
                    onClick={() => handleCalendarDayClick(day)}
                    className={`calendar-day ${
                      day.isCurrentMonth ? "current-month" : "other-month"
                    } ${day.data ? `status-${day.data.waste_status}` : "status-empty"} ${
                      selectedDayData?.date === day.key ? "active" : ""
                    }`}
                  >
                    <span>{day.dayNumber}</span>
                  </button>
                ))}
              </div>

              <div className="calendar-legend">
                <span className="legend-item">
                  <i className="dot status-normal" /> Normal
                </span>
                <span className="legend-item">
                  <i className="dot status-warning" /> Warning
                </span>
                <span className="legend-item">
                  <i className="dot status-critical" /> Critical
                </span>
              </div>

              <div className="selected-day">
                {selectedDayData ? (
                  <div className="selected-day-row">
                    <div className="selected-day-item">
                      <span className="selected-day-label">Date</span>
                      <strong>{selectedDayData.date}</strong>
                    </div>
                    <div className="selected-day-item">
                      <span className="selected-day-label">Total Energy</span>
                      <strong>{formatKwh(selectedDayData.total_energy_kwh)}</strong>
                    </div>
                    <div className="selected-day-item">
                      <span className="selected-day-label">Wasted Energy</span>
                      <strong>{formatKwh(selectedDayData.wasted_energy_kwh)}</strong>
                    </div>
                    <div className="selected-day-item">
                      <span className="selected-day-label">Waste Ratio</span>
                      <strong>{Number(selectedDayData.waste_ratio_percent || 0).toFixed(2)}%</strong>
                    </div>
                  </div>
                ) : (
                  <p>Click a colored date to view energy and waste details.</p>
                )}
              </div>
            </div>
          </SectionCard>
        </>
      )}
    </div>
  );
}