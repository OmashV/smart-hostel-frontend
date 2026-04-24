import { useMemo, useState } from "react";
import { chatWithDashboardAgent } from "../api/client";
import { useChatbotContext } from "../context/ChatbotContext";

export default function FloatingDashboardChatbot() {
  const { chatConfig } = useChatbotContext();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "Ask about floors, rooms, trends, energy waste, anomalies, forecasts, or what action to take."
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const role = chatConfig?.role || "owner";
  const dashboardState = chatConfig?.dashboardState || {
    floorId: "all",
    roomId: "all"
  };
  const onAction = chatConfig?.onAction || null;

  const title = useMemo(() => {
    switch (role) {
      case "owner":
        return "Owner Assistant";
      case "warden":
        return "Warden Assistant";
      case "security":
        return "Security Assistant";
      case "student":
        return "Student Assistant";
      default:
        return "Dashboard Assistant";
    }
  }, [role]);

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

  const isNavigationRequest = (text) => {
    const t = String(text || "").toLowerCase();
    return (
      t.includes("open ") ||
      t.includes("go to ") ||
      t.includes("switch to ") ||
      t.includes("show me ") ||
      t.includes("take me to ")
    );
  };

  const cleanReply = (text) =>
    text
      .split("\n")
      .filter((line) => {
        const t = line.trim();
        return (
          !t.startsWith("ACTION:") &&
          !t.startsWith("<function=") &&
          t !== "</function>"
        );
      })
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
        dashboardState
      });

      const reply = res.reply || "No response generated.";
      const actions = parseActions(reply);

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: cleanReply(reply) }
      ]);

      if (actions.length && onAction && isNavigationRequest(userMessage)) {
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
    <>
      {isOpen && (
        <div className="floating-chatbot-panel">
          <div className="floating-chatbot-header">
            <div>
              <strong>{title}</strong>
              <div className="floating-chatbot-subtitle">
                Role: {role} | Floor: {dashboardState?.floorId || "all"} | Room:{" "}
                {dashboardState?.roomId || "all"}
              </div>
            </div>
            <button
              type="button"
              className="floating-chatbot-close"
              onClick={() => setIsOpen(false)}
            >
              ×
            </button>
          </div>

          <div className="floating-chatbot-messages">
            {messages.map((msg, idx) => (
              <div key={idx} className={`floating-chatbot-msg ${msg.role}`}>
                {msg.content}
              </div>
            ))}
          </div>

          <div className="floating-chatbot-input-row">
            <input
              type="text"
              value={input}
              placeholder="Ask a question about this dashboard..."
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  sendMessage();
                }
              }}
            />
            <button type="button" onClick={sendMessage} disabled={loading}>
              {loading ? "..." : "Send"}
            </button>
          </div>
        </div>
      )}

      <button
        type="button"
        className="floating-chatbot-bubble"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="Open chatbot"
      >
        💬
      </button>
    </>
  );
}
