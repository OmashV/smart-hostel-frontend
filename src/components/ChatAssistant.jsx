import { useState } from "react";
import {
  getAlerts,
  getAnomalies,
  getPatterns,
  getForecasts,
  getRoomsStatus
} from "../api/client";

export default function ChatAssistant({ roomId = "All" }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);

  async function ask() {
    const q = question.trim().toLowerCase();
    if (!q) return;

    setLoading(true);
    try {
      if (q.includes("alert") || q.includes("critical")) {
        const data = await getAlerts(roomId);
        const items = data.items || [];
        setAnswer(
          items.length
            ? `There are ${items.length} ML alerts. Latest: ${items[0].alert_type} in ${items[0].room_id} with ${Math.round((items[0].confidence || 0) * 100)}% confidence.`
            : "No ML alerts are available for the selected room."
        );
      } else if (q.includes("anomaly") || q.includes("abnormal")) {
        const data = await getAnomalies(roomId);
        const items = data.items || [];
        setAnswer(
          items.length
            ? `There are ${items.length} anomaly records. Latest anomaly is ${items[0].room_id} on ${items[0].date} with score ${items[0].anomaly_score}.`
            : "No anomaly records are available for the selected room."
        );
      } else if (q.includes("pattern") || q.includes("weekly") || q.includes("kmeans")) {
        const data = await getPatterns(roomId);
        const items = data.items || [];
        const high = items.find((p) => String(p.usual_pattern || "").toLowerCase().includes("high"));
        setAnswer(
          high
            ? `${high.day} shows ${high.usual_pattern}. Avg noise ${high.avg_noise_level}, avg warnings ${high.avg_warnings}, critical ratio ${high.avg_critical_ratio}%.`
            : `Weekly pattern data has ${items.length} rows for the selected room.`
        );
      } else if (q.includes("forecast") || q.includes("predict")) {
        const data = await getForecasts(roomId);
        const items = data.items || [];
        setAnswer(
          items.length
            ? `Next forecast: ${items[0].date}, predicted occupancy ${Number(items[0].predicted_occupied_count || 0).toFixed(2)}, predicted warnings ${Number(items[0].predicted_warning_count || 0).toFixed(2)}.`
            : "No forecast data is available for the selected room."
        );
      } else if (q.includes("inspection") || q.includes("room")) {
        const data = await getRoomsStatus(roomId);
        const rooms = data.rooms || [];
        const inspectionRooms = rooms.filter((room) => room.needs_inspection);
        setAnswer(
          inspectionRooms.length
            ? `${inspectionRooms.length} rooms need inspection: ${inspectionRooms.map((room) => room.room_id).join(", ")}.`
            : "No rooms currently need inspection for the selected filter."
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
    <section className="card chat-card">
      <h3>Warden Chat Assistant</h3>
      <div className="chat-row">
        <input
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Ask about alerts, anomalies, patterns, forecasts..."
        />
        <button onClick={ask} disabled={loading}>
          {loading ? "Checking..." : "Ask"}
        </button>
      </div>
      <p className="chat-answer">{answer || "Answers are generated from live Warden APIs."}</p>
    </section>
  );
}
