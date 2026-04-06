import { useEffect, useState } from "react";
import { LineChart, Line, ResponsiveContainer, Tooltip, CartesianGrid, XAxis, YAxis } from "recharts";
import { getSecurityDoorEvents, getSecuritySummary, getSecuritySuspiciousRooms } from "../api/client";
import StatCard from "../components/StatCard";
import SectionCard from "../components/SectionCard";
import DataTable from "../components/DataTable";
import LoadingState from "../components/LoadingState";
import EmptyState from "../components/EmptyState";
import { formatDate } from "../utils/format";

export default function SecurityDashboard() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [events, setEvents] = useState([]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [summaryRes, suspiciousRes, eventsRes] = await Promise.all([
          getSecuritySummary(),
          getSecuritySuspiciousRooms(),
          getSecurityDoorEvents()
        ]);

        setSummary(summaryRes);
        setRooms(suspiciousRes.rooms || []);
        setEvents(eventsRes.events || []);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <LoadingState />;

  const timelineData = events.slice(0, 12).map((item, index) => ({
    index: index + 1,
    door_stable_ms: item.door_stable_ms
  }));

  return (
    <div className="page-grid">
      <div className="stats-grid">
        <StatCard title="Active Security Alerts" value={summary?.active_security_alerts ?? 0} />
        <StatCard title="Suspicious Rooms" value={summary?.suspicious_rooms ?? 0} />
        <StatCard title="Door-Open Rooms" value={summary?.door_open_rooms ?? 0} />
      </div>

      <SectionCard title="Suspicious Rooms">
        {rooms.length ? (
          <DataTable
            columns={[
              { key: "room_id", label: "Room" },
              { key: "door_status", label: "Door" },
              { key: "door_stable_ms", label: "Door Open ms" },
              { key: "motion_count", label: "Motion Count" },
              { key: "hour", label: "Hour" },
              {
                key: "captured_at",
                label: "Captured At",
                render: (row) => formatDate(row.captured_at)
              }
            ]}
            rows={rooms}
          />
        ) : (
          <EmptyState text="No suspicious rooms right now." />
        )}
      </SectionCard>

      <SectionCard title="Door Activity Timeline">
        {timelineData.length ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={timelineData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="index" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="door_stable_ms" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState text="No door events available." />
        )}
      </SectionCard>

      <SectionCard title="Recent Door Events">
        <DataTable
          columns={[
            { key: "room_id", label: "Room" },
            { key: "door_status", label: "Door" },
            { key: "door_stable_ms", label: "Door Open ms" },
            { key: "motion_count", label: "Motion Count" },
            {
              key: "captured_at",
              label: "Captured At",
              render: (row) => formatDate(row.captured_at)
            }
          ]}
          rows={events}
        />
      </SectionCard>
    </div>
  );
}