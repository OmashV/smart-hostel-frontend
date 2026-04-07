import { useEffect, useMemo, useState } from "react";
import { HiOutlineExclamationTriangle, HiOutlineInformationCircle } from "react-icons/hi2";
import { HiOutlineBolt, HiOutlineChartBarSquare, HiOutlineBuildingOffice2 } from "react-icons/hi2";
import {
  Area,
  Brush,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import {
  getEnergyForecast,
  getEnergyHistory,
  getOwnerAlerts,
  getOwnerKpis,
  getOwnerRoomsOverview,
  getTopWasteDays
} from "../api/client";
import { mergeHistoryWithForecast } from "../utils/chart";
import { formatDate, formatKwh } from "../utils/format";
import FilterBar from "../components/FilterBar";
import StatCard from "../components/StatCard";
import SectionCard from "../components/SectionCard";
import LoadingState from "../components/LoadingState";
import StatusBadge from "../components/StatusBadge";

function AlertCard({ alert }) {
  const cls =
    alert.severity === "Critical"
      ? "alert-card critical"
      : alert.severity === "Warning"
      ? "alert-card warning"
      : "alert-card info";

  const icon =
    alert.severity === "Critical" ? (
      <HiOutlineExclamationTriangle />
    ) : alert.severity === "Warning" ? (
      <HiOutlineExclamationTriangle />
    ) : (
      <HiOutlineInformationCircle />
    );

  return (
    <div className={cls}>
      <div className="alert-title-row">
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "18px" }}>{icon}</span>
          <strong>{alert.title}</strong>
        </div>
        <span className="alert-badge">{alert.severity}</span>
      </div>
      <p>{alert.message}</p>
      <div className="alert-meta">
        <span>{alert.room_id}</span>
        <span>{formatDate(alert.captured_at)}</span>
      </div>
    </div>
  );
}

function OwnerRoomTile({ room }) {
  const tileClass =
    room.waste_stat === "Critical"
      ? "owner-room-tile critical"
      : room.noise_stat === "Warning" || room.noise_stat === "Violation"
      ? "owner-room-tile warning"
      : "owner-room-tile normal";

  return (
    <div className={tileClass}>
      <div className="tile-top">
        <div>
          <h3>{room.room_id}</h3>
          <p className="tile-subtext">Room overview</p>
        </div>
        <span
          className={`tile-dot ${
            room.waste_stat === "Critical"
              ? "red"
              : room.noise_stat === "Warning" || room.noise_stat === "Violation"
              ? "orange"
              : "green"
          }`}
        />
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
          <strong>{room.total_energy_kwh.toFixed(2)} kWh</strong>
        </div>
        <div className="tile-row">
          <span>Waste</span>
          <strong>{room.wasted_energy_kwh.toFixed(2)} kWh</strong>
        </div>
        <div className="tile-row">
          <span>Waste Ratio</span>
          <strong>{room.waste_ratio_percent}%</strong>
        </div>
      </div>

      <div className="tile-badges">
        <StatusBadge value={room.noise_stat} />
        <StatusBadge value={room.waste_stat} />
      </div>

      <div className="tile-footer">
        Last Activity <span>{formatDate(room.last_activity)}</span>
      </div>
    </div>
  );
}

function BrushCircleHandle({ x, y, width, height }) {
  const radius = 5;
  const cx = x + width / 2;
  const cy = y + height / 2;

  return (
    <g>
      <line
        x1={cx}
        y1={y + 4}
        x2={cx}
        y2={y + height - 4}
        stroke="#94a3b8"
        strokeWidth={1.2}
      />
      <circle cx={cx} cy={cy} r={radius} fill="#ffffff" stroke="#64748b" strokeWidth={1.4} />
    </g>
  );
}

export default function OwnerDashboard() {
  const [roomId, setRoomId] = useState("all");
  const [forecastDays, setForecastDays] = useState(5);
  const [loading, setLoading] = useState(true);

  const [kpis, setKpis] = useState(null);
  const [history, setHistory] = useState([]);
  const [forecast, setForecast] = useState([]);
  const [topWasteDays, setTopWasteDays] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [roomsOverview, setRoomsOverview] = useState([]);
  const [selectedDay, setSelectedDay] = useState(null);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });

  useEffect(() => {
    async function loadAllRoomsView() {
      setLoading(true);
      try {
        const [overviewRes, alertsRes] = await Promise.all([
          getOwnerRoomsOverview(),
          getOwnerAlerts()
        ]);

        const rooms = overviewRes.rooms || [];
        setRoomsOverview(rooms);
        setAlerts(alertsRes.alerts || []);

        const totalEnergy = rooms.reduce((sum, r) => sum + (r.total_energy_kwh || 0), 0);
        const wastedEnergy = rooms.reduce((sum, r) => sum + (r.wasted_energy_kwh || 0), 0);
        const wasteRatio =
          totalEnergy > 0 ? Number(((wastedEnergy / totalEnergy) * 100).toFixed(2)) : 0;
        const highWasteRooms = rooms.filter((r) => r.waste_stat === "Critical").length;

        setKpis({
          total_energy_today_kwh: totalEnergy,
          wasted_energy_today_kwh: wastedEnergy,
          waste_ratio_today_percent: wasteRatio,
          current_waste_status: `${highWasteRooms} High Waste Rooms`
        });
      } finally {
        setLoading(false);
      }
    }

    async function loadSingleRoomView() {
      setLoading(true);
      try {
        const [kpiRes, historyRes, forecastRes, topWasteRes] = await Promise.all([
          getOwnerKpis(roomId),
          getEnergyHistory(roomId),
          getEnergyForecast(roomId, forecastDays).catch(() => ({
            history: [],
            forecast: []
          })),
          getTopWasteDays(roomId, 31).catch(() => ({ days: [] }))
        ]);

        setKpis(kpiRes);
        setHistory(historyRes.history || []);
        setForecast(forecastRes.forecast || []);
        setTopWasteDays(topWasteRes.days || []);
      } finally {
        setLoading(false);
      }
    }

    if (roomId === "all") {
      loadAllRoomsView();
    } else {
      loadSingleRoomView();
    }
  }, [roomId, forecastDays]);
  useEffect(() => {
    if (!history.length) return;
    const latest = history[history.length - 1];
    const latestDate = new Date(latest.date);
    if (!Number.isNaN(latestDate.getTime())) {
      setCalendarMonth(new Date(latestDate.getFullYear(), latestDate.getMonth(), 1));
    }
    const key = `${latestDate.getFullYear()}-${String(latestDate.getMonth() + 1).padStart(2, "0")}-${String(
      latestDate.getDate()
    ).padStart(2, "0")}`;
    setSelectedDay({
      ...latest,
      date: key
    });
  }, [history]);

  const chartData = useMemo(
    () => mergeHistoryWithForecast(history, forecast),
    [history, forecast]
  );
  const historyByDate = useMemo(() => {
    const toDateKey = (rawDate) => {
      if (!rawDate) return "";
      if (typeof rawDate === "string" && rawDate.length >= 10) return rawDate.slice(0, 10);
      const parsed = new Date(rawDate);
      if (Number.isNaN(parsed.getTime())) return "";
      const y = parsed.getFullYear();
      const m = String(parsed.getMonth() + 1).padStart(2, "0");
      const d = String(parsed.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    };

    const topWasteByDate = (topWasteDays || []).reduce((acc, item) => {
      const key = toDateKey(item.date);
      if (!key) return acc;
      acc[key] = item;
      return acc;
    }, {});
    const latestHistoryDateKey = history.length ? toDateKey(history[history.length - 1]?.date) : "";
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
      const topWasteItem = topWasteByDate[key];
      const total = Number(item.total_energy_kwh || 0);
      const waste = Number(item.wasted_energy_kwh || 0);
      const backendRatioRaw =
        item.waste_ratio_percent !== undefined && item.waste_ratio_percent !== null
          ? Number(item.waste_ratio_percent)
          : topWasteItem?.waste_ratio_percent !== undefined &&
            topWasteItem?.waste_ratio_percent !== null
          ? Number(topWasteItem.waste_ratio_percent)
          : null;
      const ratio =
        backendRatioRaw !== null && !Number.isNaN(backendRatioRaw)
          ? Number(backendRatioRaw.toFixed(2))
          : total > 0
          ? Number(((waste / total) * 100).toFixed(2))
          : 0;
      const rawStatus = String(
        item.waste_stat ||
          item.waste_status ||
          item.current_waste_status ||
          topWasteItem?.waste_stat ||
          topWasteItem?.waste_status ||
          ""
      )
        .toLowerCase()
        .trim();
      const wasteStatus =
        rawStatus === "critical"
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
  }, [history, topWasteDays, kpis]);
  const calendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const first = new Date(year, month, 1);
    const start = new Date(year, month, 1 - first.getDay());
    return Array.from({ length: 42 }, (_, idx) => {
      const date = new Date(start);
      date.setDate(start.getDate() + idx);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
        date.getDate()
      ).padStart(2, "0")}`;
      return {
        key,
        date,
        dayNumber: date.getDate(),
        isCurrentMonth: date.getMonth() === month,
        data: historyByDate[key] || null
      };
    });
  }, [calendarMonth, historyByDate]);
  const selectedDayData = selectedDay?.date ? historyByDate[selectedDay.date] || selectedDay : null;
  const monthTitle = calendarMonth.toLocaleString("en-US", { month: "long", year: "numeric" });
  const handleHistoryPointSelect = (entry) => {
    if (entry?.activePayload?.[0]?.payload) {
      const payload = entry.activePayload[0].payload;
      setSelectedDay({
        ...payload,
        date: typeof payload.date === "string" ? payload.date.slice(0, 10) : payload.date
      });
      return;
    }
    if (entry?.payload) {
      const payload = entry.payload;
      setSelectedDay({
        ...payload,
        date: typeof payload.date === "string" ? payload.date.slice(0, 10) : payload.date
      });
      return;
    }
    setSelectedDay(null);
  };
  const handleCalendarDayClick = (day) => {
    if (!day.data) return;
    setSelectedDay(day.data);
  };
  const forecastLegendFormatter = (value) => {
    const isPredicted = value.toLowerCase().includes("predicted");
    return (
      <span className={`legend-label ${isPredicted ? "predicted" : "actual"}`}>
        {value}
      </span>
    );
  };

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
          value={`${kpis?.waste_ratio_today_percent ?? 0}%`}
          subtitle="compared with total usage"
          icon={<HiOutlineBuildingOffice2 />}
          tone="green"
        />
        <StatCard
          title="Current Waste Status"
          value={kpis?.current_waste_status || "-"}
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
                alerts.map((alert, idx) => <AlertCard key={idx} alert={alert} />)
              ) : (
                <p>No active owner-level alerts right now.</p>
              )}
            </div>
          </SectionCard>
        </div>
      ) : (
        <>
          <SectionCard title="Energy Usage and Waste History">
            <ResponsiveContainer width="100%" height={360}>
              <ComposedChart className="history-chart" data={history} onClick={handleHistoryPointSelect}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
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
                <Legend />
                <Line
                  type="monotone"
                  dataKey="total_energy_kwh"
                  name="Total Energy"
                  stroke="#2563eb"
                  strokeWidth={2.6}
                  dot={{ r: 3, fill: "#2563eb", strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                  onClick={handleHistoryPointSelect}
                />
                <Line
                  type="monotone"
                  dataKey="wasted_energy_kwh"
                  name="Wasted Energy"
                  stroke="#f59e0b"
                  strokeWidth={2.2}
                  dot={{ r: 3, fill: "#f59e0b", strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                  onClick={handleHistoryPointSelect}
                />
                <Brush
                  dataKey="date"
                  height={16}
                  travellerWidth={12}
                  stroke="#cbd5e1"
                  fill="#ffffff"
                  tick={{ fill: "#64748b", fontSize: 12 }}
                  traveller={<BrushCircleHandle />}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </SectionCard>

          <SectionCard title="Forecast: Actual vs Predicted">
            <ResponsiveContainer width="100%" height={360}>
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#d9e1ec" />
                <XAxis dataKey="date" tick={{ fill: "#64748b" }} />
                <YAxis tick={{ fill: "#64748b" }} />
                <Tooltip
                  contentStyle={{
                    background: "#ffffff",
                    border: "1px solid #dbe2ea",
                    borderRadius: "12px",
                    color: "#172033",
                    boxShadow: "0 10px 24px rgba(15, 23, 42, 0.08)"
                  }}
                />
                <Legend formatter={forecastLegendFormatter} />
                <Area
                  type="monotone"
                  dataKey="total_energy_kwh"
                  name="Actual Energy"
                  stroke="#3b82f6"
                  fill="#93c5fd"
                  fillOpacity={0.28}
                />
                <Area
                  type="monotone"
                  dataKey="wasted_energy_kwh"
                  name="Actual Waste"
                  stroke="#f59e0b"
                  fill="#fcd34d"
                  fillOpacity={0.26}
                />
                <Line
                  type="monotone"
                  dataKey="predicted_total_energy_kwh"
                  name="Predicted Energy"
                  stroke="#6366f1"
                  strokeWidth={2}
                  strokeDasharray="10 6"
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="predicted_wasted_energy_kwh"
                  name="Predicted Waste"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  strokeDasharray="2 7"
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </SectionCard>

          <SectionCard title="Monthly Waste Calendar">
            <div className="owner-calendar-wrap">
              <div className="owner-calendar-toolbar">
                <button
                  type="button"
                  className="calendar-nav-btn"
                  onClick={() =>
                    setCalendarMonth(
                      (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
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
                      (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
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
                <span className="legend-item"><i className="dot status-normal" /> Normal</span>
                <span className="legend-item"><i className="dot status-warning" /> Warning</span>
                <span className="legend-item"><i className="dot status-critical" /> Critical</span>
              </div>

              <div className="selected-day">
                {selectedDayData ? (
                  <>
                    <p><strong>Date:</strong> {selectedDayData.date}</p>
                    <p><strong>Total Energy:</strong> {formatKwh(selectedDayData.total_energy_kwh)}</p>
                    <p><strong>Wasted Energy:</strong> {formatKwh(selectedDayData.wasted_energy_kwh)}</p>
                    <p><strong>Waste Ratio:</strong> {(selectedDayData.waste_ratio_percent ?? 0).toFixed(2)}%</p>
                  </>
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