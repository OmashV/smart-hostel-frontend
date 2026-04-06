import { useEffect, useState } from "react";
import { Bar, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis, BarChart } from "recharts";
import { getWardenNoiseIssues, getWardenRoomsStatus, getWardenSummary } from "../api/client";
import StatCard from "../components/StatCard";
import SectionCard from "../components/SectionCard";
import StatusBadge from "../components/StatusBadge";
import DataTable from "../components/DataTable";
import LoadingState from "../components/LoadingState";
import EmptyState from "../components/EmptyState";

export default function WardenDashboard() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [noiseIssues, setNoiseIssues] = useState([]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [summaryRes, roomsRes, noiseRes] = await Promise.all([
          getWardenSummary(),
          getWardenRoomsStatus(),
          getWardenNoiseIssues()
        ]);

        setSummary(summaryRes);
        setRooms(roomsRes.rooms || []);
        setNoiseIssues(noiseRes.rooms || []);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <LoadingState />;

  return (
    <div className="page-grid">
      <div className="stats-grid">
        <StatCard title="Occupied Rooms" value={summary?.occupied_rooms ?? 0} />
        <StatCard title="Empty Rooms" value={summary?.empty_rooms ?? 0} />
        <StatCard title="Sleeping Rooms" value={summary?.sleeping_rooms ?? 0} />
        <StatCard title="Noise Issue Rooms" value={summary?.noise_issue_rooms ?? 0} />
      </div>

      <SectionCard title="Real-Time Room Status Grid">
        <div className="status-grid">
          {rooms.map((room) => (
            <div key={room.room_id} className="room-tile">
              <h3>{room.room_id}</h3>
              <p><StatusBadge value={room.occupancy_stat} /></p>
              <p><StatusBadge value={room.noise_stat} /></p>
              <p><StatusBadge value={room.waste_stat} /></p>
              <small>{room.door_status} · {room.current_amp} A</small>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Noise Issues by Room">
        {noiseIssues.length ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={noiseIssues}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="room_id" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="issue_count" name="Issue Count" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState text="No active noise issues right now." />
        )}
      </SectionCard>

      <SectionCard title="Rooms Requiring Attention">
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
            { key: "current_amp", label: "Current (A)" }
          ]}
          rows={rooms.filter(
            (r) =>
              r.waste_stat === "Critical" ||
              r.noise_stat === "Violation" ||
              r.noise_stat === "Warning"
          )}
        />
      </SectionCard>
    </div>
  );
}