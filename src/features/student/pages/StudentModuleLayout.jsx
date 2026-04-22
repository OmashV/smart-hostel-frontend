import { Outlet } from "react-router-dom";
import StudentSubNav from "../components/StudentSubNav";
import { DEFAULT_STUDENT_ROOM_ID } from "../constants/studentConstants";

export default function StudentModuleLayout() {
  return (
    <div className="student-module">
      <header className="student-module-header">
        <div className="student-module-header-main">
          <p className="student-module-kicker">Smart Hostel Analytics</p>
          <h1>Student Analytics</h1>
          <p>Personal dashboard for room usage, noise trends, energy insights, and alert monitoring.</p>
        </div>
        <p className="student-room-pill student-module-room-pill">Demo Room: {DEFAULT_STUDENT_ROOM_ID}</p>
      </header>

      <StudentSubNav />

      <Outlet />
    </div>
  );
}
