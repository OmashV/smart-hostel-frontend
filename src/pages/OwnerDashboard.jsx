import { useEffect, useMemo, useState } from "react";
import {
  Area,
  Bar,
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
  getEnergyHistory,
  getEnergyForecast,
  getOwnerKpis,
  getTopWasteDays
} from "../api/client";
import { mergeHistoryWithForecast } from "../utils/chart";
import { formatKwh } from "../utils/format";
import FilterBar from "../components/FilterBar";
import StatCard from "../components/StatCard";
import SectionCard from "../components/SectionCard";
import DataTable from "../components/DataTable";
import LoadingState from "../components/LoadingState";

export default function OwnerDashboard() {
  const [roomId, setRoomId] = useState("A101");
  const [forecastDays, setForecastDays] = useState(5);
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState(null);
  const [history, setHistory] = useState([]);
  const [forecast, setForecast] = useState([]);
  const [topWasteDays, setTopWasteDays] = useState([]);
  const [selectedDay, setSelectedDay] = useState(null);

  useEffect(() => {
    async function load() {
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
    load();
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
        <StatCard title="Critical Waste Events" value={kpis?.critical_waste_events_today ?? 0} />
        <StatCard title="Forecast Horizon" value={`${forecastDays} days`} />
      </div>

      <SectionCard title="Energy Usage and Waste History">
        <ResponsiveContainer width="100%" height={360}>
          <ComposedChart data={history} onClick={(state) => setSelectedDay(state?.activePayload?.[0]?.payload || null)}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="total_energy_kwh" name="Total Energy" />
            <Line type="monotone" dataKey="wasted_energy_kwh" name="Wasted Energy" strokeWidth={2} />
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
            <Line type="monotone" dataKey="predicted_total_energy_kwh" name="Predicted Energy" strokeWidth={2} />
            <Line type="monotone" dataKey="predicted_wasted_energy_kwh" name="Predicted Waste" strokeWidth={2} strokeDasharray="6 6" />
          </ComposedChart>
        </ResponsiveContainer>
      </SectionCard>

      <SectionCard title="Top Waste Days">
        <DataTable
          columns={[
            { key: "date", label: "Date" },
            { key: "total_energy_kwh", label: "Total Energy (kWh)" },
            { key: "wasted_energy_kwh", label: "Wasted Energy (kWh)" },
            { key: "critical_waste_events", label: "Critical Events" }
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
    </div>
  );
}