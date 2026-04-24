import { useEffect } from "react";
import { Outlet } from "react-router-dom";

import StudentSubNav from "../components/StudentSubNav";
import { DEFAULT_STUDENT_ROOM_ID } from "../constants/studentConstants";
import { useChatbotContext } from "../../../context/ChatbotContext";

export default function StudentModuleLayout() {
  const { registerChatContext, clearChatContext } = useChatbotContext();

  useEffect(() => {
    registerChatContext({
      role: "student",
      dashboardState: {
        dashboard: "student",
        roomId: DEFAULT_STUDENT_ROOM_ID,
        selectedFilters: {
          range: "7d",
        },
        selectedVisual: null,
      },
    });

    return () => {
      clearChatContext();
    };
  }, [registerChatContext, clearChatContext]);

  return (
    <div className="student-module">
      <header className="student-module-header">
        <div className="student-module-header-main">
          <p className="student-module-kicker">Smart Hostel Analytics</p>
          <h1>Student Analytics</h1>
          <p>
            Personal dashboard for room usage, noise trends, energy insights,
            and alert monitoring.
          </p>
        </div>

        <p className="student-room-pill student-module-room-pill">
          Demo Room: {DEFAULT_STUDENT_ROOM_ID}
        </p>
      </header>

      <StudentSubNav />

      <Outlet />
    </div>
  );
}