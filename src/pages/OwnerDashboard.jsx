import { useEffect, useMemo, useState } from "react";
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
import DataTable from "../components/DataTable";
import LoadingState from "../components/LoadingState";
import StatusBadge from "../components/StatusBadge";

function AlertCard({ alert }) {
  const cls =
    alert.severity === "Critical"
      ? "alert-card critical"
      : alert.severity === "Warning"
      ? "alert-card warning"
      : "alert-card info";

  return (
    <div className={cls}>
      <div className="alert-title-row">
        <strong>{alert.title}</strong>
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
          current_waste_status: `${highWasteRooms} High-Waste Rooms`
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
          getTopWasteDays(roomId)
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

  const chartData = useMemo(
    () => mergeHistoryWithForecast(history, forecast),
    [history, forecast]
  );

  if (loading) return <LoadingState />;

  return (
    <div className="page-grid">
      <FilterBar
        roomId={roomId}
        setRoomId={setRoomId}
        forecastDays={forecastDays}
        setForecastDays={setForecastDays}
      />

      <div className="stats-grid">
        <StatCard title="Total Energy Today" value={formatKwh(kpis?.total_energy_today_kwh)} />
        <StatCard title="Wasted Energy Today" value={formatKwh(kpis?.wasted_energy_today_kwh)} />
        <StatCard title="Waste Ratio Today" value={`${kpis?.waste_ratio_today_percent ?? 0}%`} />
        <StatCard title="Current Waste Status" value={kpis?.current_waste_status || "-"} />
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
              <ComposedChart
                data={history}
                onClick={(state) =>
                  setSelectedDay(state?.activePayload?.[0]?.payload || null)
                }
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="total_energy_kwh" name="Total Energy" />
                <Line
                  type="monotone"
                  dataKey="wasted_energy_kwh"
                  name="Wasted Energy"
                  strokeWidth={2}
                />
                <Brush dataKey="date" height={24} travellerWidth={12} />
              </ComposedChart>
            </ResponsiveContainer>
          </SectionCard>

          <SectionCard title="Forecast: Actual vs Predicted">
            <ResponsiveContainer width="100%" height={360}>
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="total_energy_kwh" name="Actual Energy" />
                <Area type="monotone" dataKey="wasted_energy_kwh" name="Actual Waste" />
                <Line
                  type="monotone"
                  dataKey="predicted_total_energy_kwh"
                  name="Predicted Energy"
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="predicted_wasted_energy_kwh"
                  name="Predicted Waste"
                  strokeWidth={2}
                  strokeDasharray="6 6"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </SectionCard>

          <SectionCard title="Top Waste Days">
            <DataTable
              columns={[
                { key: "date", label: "Date" },
                { key: "total_energy_kwh", label: "Total Energy (kWh)" },
                { key: "wasted_energy_kwh", label: "Wasted Energy (kWh)" },
                { key: "waste_ratio_percent", label: "Waste Ratio (%)" }
              ]}
              rows={topWasteDays}
            />
          </SectionCard>

          <SectionCard title="Selected Day Detail">
            {selectedDay ? (
              <div className="selected-day">
                <p><strong>Date:</strong> {selectedDay.date}</p>
                <p><strong>Total Energy:</strong> {formatKwh(selectedDay.total_energy_kwh)}</p>
                <p><strong>Wasted Energy:</strong> {formatKwh(selectedDay.wasted_energy_kwh)}</p>
              </div>
            ) : (
              <p>Click a day in the history chart to inspect it.</p>
            )}
          </SectionCard>
        </>
      )}
    </div>
  );
}