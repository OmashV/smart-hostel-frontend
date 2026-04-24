import { useState } from "react";
import { HiOutlineChatBubbleLeftRight, HiOutlineXMark } from "react-icons/hi2";
import {
  getWardenMlAlerts,
  getWardenAnomalies,
  getWardenPatterns,
  getWardenForecasts,
  getWardenRoomsStatus
} from "../api/client";

export default function ChatAssistant({ roomId = "All" }) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("Ask about critical alerts, inspection rooms, weekly patterns, anomalies, or forecasts.");
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
            ? `There are ${alerts.length} critical alerts for ${roomId}. Latest alert is in ${alerts[0].room_id} with ${Math.round((alerts[0].confidence || 0) * 100)}% ML confidence.`
            : `No critical alerts are available for ${roomId}.`
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
      } else if (query.includes("pattern") || query.includes("weekly") || query.includes("kmeans")) {
        const data = await getWardenPatterns(roomId);
        const patterns = data.items || [];
        const important = patterns.find((item) => String(item.usual_pattern || "").toLowerCase().includes("high")) || patterns[0];
        setAnswer(
          important
            ? `${important.day} pattern is ${important.usual_pattern}. Average occupancy ${important.avg_occupancy}, average noise ${important.avg_noise_level}, warnings ${important.avg_warnings}, critical ratio ${important.avg_critical_ratio}%.`
            : `No weekly pattern records are available for ${roomId}.`
        );
      } else if (query.includes("anomaly") || query.includes("abnormal")) {
        const data = await getWardenAnomalies(roomId);
        const anomalies = data.items || [];
        setAnswer(
          anomalies.length
            ? `There are ${anomalies.length} anomaly records for ${roomId}. Latest: ${anomalies[0].room_id} on ${anomalies[0].date} with score ${anomalies[0].anomaly_score}.`
            : `No anomaly records are available for ${roomId}.`
        );
      } else if (query.includes("forecast") || query.includes("predict")) {
        const data = await getWardenForecasts(roomId);
        const forecasts = data.items || [];
        setAnswer(
          forecasts.length
            ? `Next forecast for ${forecasts[0].room_id} on ${forecasts[0].date}: predicted occupancy ${Number(forecasts[0].predicted_occupied_count || 0).toFixed(2)}, predicted warnings ${Number(forecasts[0].predicted_warning_count || 0).toFixed(2)}.`
            : `No forecast records are available for ${roomId}.`
        );
      } else {
        setAnswer("Ask: Which rooms have active alerts? Which rooms need inspection? What is the weekly pattern? Show anomalies. What is the forecast?");
      }
    } catch (error) {
      setAnswer(error?.message || "Failed to load Warden data.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button type="button" className="warden-floating-chat-button" onClick={() => setOpen(true)} title="Open Warden Chat Assistant">
        <HiOutlineChatBubbleLeftRight size={26} />
      </button>

      <div className={`warden-chat-drawer ${open ? "open" : ""}`} aria-hidden={!open}>
        <div className="warden-chat-drawer-head">
          <div>
            <h3>Warden Chat Assistant</h3>
            <p>Live answers from Warden APIs</p>
          </div>
          <button type="button" onClick={() => setOpen(false)} title="Close chat">
            <HiOutlineXMark size={22} />
          </button>
        </div>

        <div className="warden-chat-drawer-body">
          <div className="warden-chat-suggestions">
            <button onClick={() => setQuestion("Which rooms have active alerts?")}>Active alerts</button>
            <button onClick={() => setQuestion("Which rooms need inspection?")}>Inspection rooms</button>
            <button onClick={() => setQuestion("What is the weekly pattern?")}>Weekly pattern</button>
            <button onClick={() => setQuestion("Show anomalies")}>Anomalies</button>
            <button onClick={() => setQuestion("What is the forecast?")}>Forecast</button>
          </div>

          <div className="warden-chat-row">
            <input
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") handleAsk();
              }}
              placeholder="Ask about alerts, anomalies, patterns, forecasts..."
            />
            <button type="button" onClick={handleAsk} disabled={loading}>
              {loading ? "Checking..." : "Ask"}
            </button>
          </div>
          <p className="warden-chat-answer">{answer}</p>
        </div>
      </div>

      {open ? <button type="button" className="warden-chat-backdrop" onClick={() => setOpen(false)} aria-label="Close chat backdrop" /> : null}
    </>
  );
}
