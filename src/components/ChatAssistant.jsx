import { useState } from "react";
import { HiOutlineChatBubbleLeftRight, HiOutlineXMark } from "react-icons/hi2";
import {
  getWardenMlAlerts,
  getWardenAnomalies,
  getWardenPatterns,
  getWardenForecasts,
  getWardenRoomsStatus
} from "../api/client";

function extractRoom(question, fallbackRoom) {
  const match = question.match(/\b([A-Z]\d{3})\b/i);
  return match ? match[1].toUpperCase() : fallbackRoom;
}

function extractRequestedDate(question, forecasts = []) {
  const year = (forecasts[0]?.date || new Date().toISOString()).slice(0, 4);
  const lower = question.toLowerCase();

  const iso = lower.match(/\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})\b/);
  if (iso) return `${iso[1]}-${String(Number(iso[2])).padStart(2, "0")}-${String(Number(iso[3])).padStart(2, "0")}`;

  const monthNames = {
    january: "01", jan: "01", february: "02", feb: "02", march: "03", mar: "03",
    april: "04", apr: "04", may: "05", june: "06", jun: "06", july: "07", jul: "07",
    august: "08", aug: "08", september: "09", sep: "09", october: "10", oct: "10",
    november: "11", nov: "11", december: "12", dec: "12"
  };

  const wordDate = lower.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/);
  if (wordDate) {
    return `${year}-${monthNames[wordDate[2]]}-${String(Number(wordDate[1])).padStart(2, "0")}`;
  }

  const numericDate = lower.match(/\b(\d{1,2})[-/](\d{1,2})\b/);
  if (numericDate) return `${year}-${String(Number(numericDate[2])).padStart(2, "0")}-${String(Number(numericDate[1])).padStart(2, "0")}`;

  const dayOnly = lower.match(/\b(\d{1,2})(?:st|nd|rd|th)\b/);
  if (dayOnly && forecasts.length) {
    const match = forecasts.find((item) => Number(String(item.date || "").slice(-2)) === Number(dayOnly[1]));
    return match?.date || null;
  }

  return null;
}

export default function ChatAssistant({ roomId = "All" }) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("Ask any Warden dashboard question. Answers are generated from live Warden APIs.");
  const [loading, setLoading] = useState(false);

  async function handleAsk() {
    const query = question.trim();
    const lower = query.toLowerCase();
    if (!query) return;

    setLoading(true);
    try {
      const requestedRoom = extractRoom(query, roomId);

      if (lower.includes("alert") || lower.includes("critical")) {
        const data = await getWardenMlAlerts(requestedRoom, 20);
        const alerts = data.items || [];
        setAnswer(
          alerts.length
            ? `${alerts.length} critical alerts found for ${requestedRoom}. Latest displayed alert: ${alerts[0].room_id} at ${new Date(alerts[0].display_at || alerts[0].generated_at || alerts[0].updatedAt || alerts[0].createdAt || alerts[0].captured_at).toLocaleString()} with ${Math.round((alerts[0].confidence || 0) * 100)}% ML confidence.`
            : `No critical alerts are available for ${requestedRoom}.`
        );
      } else if (lower.includes("inspection") || lower.includes("need")) {
        const data = await getWardenRoomsStatus(requestedRoom);
        const rooms = data.rooms || [];
        const inspectionRooms = rooms.filter((room) => room.needs_inspection);
        setAnswer(
          inspectionRooms.length
            ? `${inspectionRooms.length} room${inspectionRooms.length === 1 ? "" : "s"} need inspection: ${inspectionRooms.map((room) => room.room_id).join(", ")}.`
            : `No rooms currently need inspection for ${requestedRoom}.`
        );
      } else if (lower.includes("pattern") || lower.includes("weekly") || lower.includes("kmeans")) {
        const data = await getWardenPatterns(requestedRoom);
        const patterns = data.items || [];
        const important = patterns.find((item) => String(item.usual_pattern || "").toLowerCase().includes("high")) || patterns[0];
        setAnswer(
          important
            ? `${important.day} pattern for ${requestedRoom} is ${important.usual_pattern}. Average occupancy ${Number(important.avg_occupancy || 0).toFixed(2)}, average noise ${Number(important.avg_noise_level || 0).toFixed(2)}, warnings ${Number(important.avg_warnings || 0).toFixed(2)}, critical ratio ${Number(important.avg_critical_ratio || 0).toFixed(2)}%.`
            : `No weekly pattern records are available for ${requestedRoom}.`
        );
      } else if (lower.includes("anomaly") || lower.includes("abnormal")) {
        const data = await getWardenAnomalies(requestedRoom);
        const anomalies = data.items || [];
        setAnswer(
          anomalies.length
            ? `There are ${anomalies.length} anomaly records for ${requestedRoom}. Latest: ${anomalies[0].room_id} on ${anomalies[0].date} with score ${Number(anomalies[0].anomaly_score || 0).toFixed(3)}.`
            : `No anomaly records are available for ${requestedRoom}.`
        );
      } else if (lower.includes("forecast") || lower.includes("predict") || lower.includes("predicted")) {
        const data = await getWardenForecasts(requestedRoom);
        const forecasts = data.items || [];
        const requestedDate = extractRequestedDate(lower, forecasts);
        const selected = requestedDate
          ? forecasts.find((item) => item.date === requestedDate)
          : forecasts[0];

        setAnswer(
          selected
            ? `Forecast for ${selected.room_id} on ${selected.date}: predicted occupancy ${Number(selected.predicted_occupied_count || 0).toFixed(2)}, predicted warnings ${Number(selected.predicted_warning_count || 0).toFixed(2)}, predicted violations ${Number(selected.predicted_violation_count || 0).toFixed(2)}.`
            : requestedDate
              ? `No forecast record is available for ${requestedRoom} on ${requestedDate}. Available dates: ${forecasts.map((item) => item.date).join(", ") || "none"}.`
              : `No forecast records are available for ${requestedRoom}.`
        );
      } else {
        setAnswer("I can answer from the live Warden APIs about room status, occupied rooms, empty rooms, active alerts, inspection priority, weekly patterns, anomalies, forecasts, and data coverage. Please ask a Warden-related question.");
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
