import { useState } from "react";
import {
  getWardenMlAlerts,
  getWardenAnomalies,
  getWardenPatterns,
  getWardenForecasts,
  getWardenRoomsStatus
} from "../api/client";

export default function ChatAssistant({ roomId = "All" }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("Answers are generated from live Warden API data.");
  const [loading, setLoading] = useState(false);

  async function handleAsk() {
    const query = question.trim().toLowerCase();
    if (!query) return;

    setLoading(true);
    try {
      if (query.includes("alert") || query.includes("critical")) {
        const data = await getWardenMlAlerts(roomId, 10);
        const alerts = data.items || [];
        setAnswer(
          alerts.length
            ? `There are ${alerts.length} ML alerts for ${roomId}. Latest: ${alerts[0].alert_type} in ${alerts[0].room_id} with ${Math.round((alerts[0].confidence || 0) * 100)}% confidence.`
            : `No ML alerts are available for ${roomId}.`
        );
      } else if (query.includes("anomaly") || query.includes("abnormal")) {
        const data = await getWardenAnomalies(roomId);
        const anomalies = data.items || [];
        setAnswer(
          anomalies.length
            ? `There are ${anomalies.length} anomaly records for ${roomId}. Latest: ${anomalies[0].room_id} on ${anomalies[0].date} with score ${anomalies[0].anomaly_score}.`
            : `No anomaly records are available for ${roomId}.`
        );
      } else if (query.includes("pattern") || query.includes("weekly") || query.includes("kmeans")) {
        const data = await getWardenPatterns(roomId);
        const patterns = data.items || [];
        const important = patterns.find((item) => String(item.usual_pattern || "").toLowerCase().includes("high")) || patterns[0];
        setAnswer(
          important
            ? `${important.day} pattern is ${important.usual_pattern}. Average occupancy ${important.avg_occupancy}, average noise ${important.avg_noise_level}, warnings ${important.avg_warnings}, critical ratio ${important.avg_critical_ratio}%.`
            : `No weekly pattern records are available for ${roomId}.`
        );
      } else if (query.includes("forecast") || query.includes("predict")) {
        const data = await getWardenForecasts(roomId);
        const forecasts = data.items || [];
        setAnswer(
          forecasts.length
            ? `Next forecast for ${forecasts[0].room_id} on ${forecasts[0].date}: predicted occupancy ${Number(forecasts[0].predicted_occupied_count || 0).toFixed(2)}, predicted warnings ${Number(forecasts[0].predicted_warning_count || 0).toFixed(2)}.`
            : `No forecast records are available for ${roomId}.`
        );
      } else if (query.includes("inspection") || query.includes("room")) {
        const data = await getWardenRoomsStatus(roomId);
        const rooms = data.rooms || [];
        const inspectionRooms = rooms.filter((room) => room.needs_inspection);
        setAnswer(
          inspectionRooms.length
            ? `${inspectionRooms.length} rooms need inspection: ${inspectionRooms.map((room) => room.room_id).join(", ")}.`
            : `No rooms currently need inspection for ${roomId}.`
        );
      } else {
        setAnswer("Ask about alerts, anomalies, weekly patterns, forecasts, or inspection rooms.");
      }
    } catch (error) {
      setAnswer(error?.message || "Failed to load Warden data.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SectionShell title="Warden Chat Assistant">
      <div className="warden-chat-row">
        <input
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Ask about alerts, anomalies, patterns, forecasts..."
        />
        <button type="button" onClick={handleAsk} disabled={loading}>
          {loading ? "Checking..." : "Ask"}
        </button>
      </div>
      <p className="warden-chat-answer">{answer}</p>
    </SectionShell>
  );
}

function SectionShell({ title, children }) {
  return (
    <section className="section-card">
      <div className="section-head">
        <h2>{title}</h2>
      </div>
      {children}
    </section>
  );
}
