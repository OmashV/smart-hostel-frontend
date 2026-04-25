import { useEffect, useState } from "react";
import { LineChart, Line, ResponsiveContainer, Tooltip, CartesianGrid, XAxis, YAxis, Legend } from "recharts";
import { getStudentAlerts, getStudentHistory, getStudentOverview } from "../api/client";
import FilterBar from "../components/FilterBar";
import StatCard from "../components/StatCard";
import SectionCard from "../components/SectionCard";
import StatusBadge from "../components/StatusBadge";
import DataTable from "../components/DataTable";
import LoadingState from "../components/LoadingState";
import { formatDate, formatKwh } from "../utils/format";

const STUDENT_ROOMS = ["A101", "A102", "A103", "A201", "A202", "A203"];

export default function StudentDashboard() {
  const [roomId, setRoomId] = useState("A101");
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState(null);
  const [history, setHistory] = useState([]);
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [overviewRes, historyRes, alertsRes] = await Promise.all([
          getStudentOverview(roomId),
          getStudentHistory(roomId),
          getStudentAlerts(roomId)
        ]);

        setOverview(overviewRes);
        setHistory(historyRes.history || []);
        setAlerts(alertsRes.alerts || []);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [roomId]);

  if (loading) return <LoadingState />;

  return (
    <div className="page-grid owner-dashboard student-dashboard">
      <FilterBar
        roomId={roomId}
        setRoomId={setRoomId}
        availableRooms={STUDENT_ROOMS}
      />

      <div className="stats-grid">
        <StatCard title="My Energy Today" value={formatKwh(overview?.today_energy_kwh)} />
        <StatCard title="My Waste Today" value={formatKwh(overview?.today_wasted_energy_kwh)} />
        <StatCard title="Current Waste Status" value={overview?.current_status?.waste_stat || "-"} />
      </div>

      <SectionCard title="My Room Current Status">
        <div className="overview-box">
          <p><strong>Occupancy:</strong> <StatusBadge value={overview?.current_status?.occupancy_stat} /></p>
          <p><strong>Noise:</strong> <StatusBadge value={overview?.current_status?.noise_stat} /></p>
          <p><strong>Waste:</strong> <StatusBadge value={overview?.current_status?.waste_stat} /></p>
          <p><strong>Door:</strong> {overview?.current_status?.door_status}</p>
          <p><strong>Current:</strong> {overview?.current_status?.current_amp} A</p>
          <p><strong>Updated:</strong> {formatDate(overview?.current_status?.captured_at)}</p>
        </div>
      </SectionCard>

      <SectionCard title="My Daily Energy Usage and Waste">
        <div className="chart-shell">
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={history}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 12 }} />
              <YAxis tick={{ fill: "#64748b", fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="total_energy_kwh" name="Total Energy" stroke="#2563eb" strokeWidth={2.6} />
              <Line type="monotone" dataKey="wasted_energy_kwh" name="Wasted Energy" stroke="#f59e0b" strokeWidth={2.4} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </SectionCard>

      <SectionCard title="My Recent Alerts">
        <DataTable
          columns={[
            {
              key: "captured_at",
              label: "Time",
              render: (row) => formatDate(row.captured_at)
            },
            {
              key: "waste_stat",
              label: "Waste",
              render: (row) => <StatusBadge value={row.waste_stat} />
            },
            {
              key: "noise_stat",
              label: "Noise",
              render: (row) => <StatusBadge value={row.noise_stat} />
            },
            { key: "current_amp", label: "Current (A)" },
            { key: "door_status", label: "Door" }
          ]}
          rows={alerts}
        />
      </SectionCard>
    </div>
  );
}
