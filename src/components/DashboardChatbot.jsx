import { useState } from "react";
import { chatWithDashboardAgent } from "../api/client";

export default function DashboardChatbot({
  role = "owner",
  floorId = "all",
  roomId = "all",
  onAction
}) {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "Ask me about floors, rooms, energy waste, forecasts, anomalies, or what action to take."
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const parseActions = (text) => {
    const lines = text.split("\n");
    const actions = [];

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed.startsWith("ACTION: switch_floor=")) {
        actions.push({
          type: "switch_floor",
          value: trimmed.replace("ACTION: switch_floor=", "").trim()
        });
      }

      if (trimmed.startsWith("ACTION: switch_room=")) {
        actions.push({
          type: "switch_room",
          value: trimmed.replace("ACTION: switch_room=", "").trim()
        });
      }
    }

    return actions;
  };

  const cleanReply = (text) =>
    text
      .split("\n")
      .filter((line) => !line.trim().startsWith("ACTION:"))
      .join("\n")
      .trim();

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setInput("");
    setLoading(true);

    try {
      const res = await chatWithDashboardAgent({
        role,
        message: userMessage,
        dashboardState: {
          floorId,
          roomId
        }
      });

      const reply = res.reply || "No response generated.";
      const actions = parseActions(reply);

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: cleanReply(reply) }
      ]);

      if (actions.length && onAction) {
        onAction(actions);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Something went wrong while getting a response."
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="owner-chatbot">
      <div className="owner-chatbot-header">Analytics Assistant</div>

      <div className="owner-chatbot-messages">
        {messages.map((msg, idx) => (
          <div key={idx} className={`owner-chatbot-msg ${msg.role}`}>
            {msg.content}
          </div>
        ))}
      </div>

      <div className="owner-chatbot-input-row">
        <input
          type="text"
          value={input}
          placeholder="Ask about floors, rooms, trends, anomalies..."
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") sendMessage();
          }}
        />
        <button onClick={sendMessage} disabled={loading}>
          {loading ? "..." : "Send"}
        </button>
      </div>
    </div>
  );
}
