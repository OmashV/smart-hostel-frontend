import { Outlet } from "react-router-dom";
import StudentSubNav from "../components/StudentSubNav";
import { DEFAULT_STUDENT_ROOM_ID } from "../constants/studentConstants";

export default function StudentModuleLayout() {
  return (
    <div className="student-module">
      <header className="student-module-header">
        <div>
          <h1>Student Analytics</h1>
          <p>Structured student overview, energy, noise, and alerts pages for upcoming phases.</p>
        </div>
        <p className="student-room-pill">Demo Room: {DEFAULT_STUDENT_ROOM_ID}</p>
      </header>

      <StudentSubNav />

      <Outlet />
    </div>
  );
}

