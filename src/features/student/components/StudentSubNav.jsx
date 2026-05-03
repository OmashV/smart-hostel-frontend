import { NavLink } from "react-router-dom";
import { STUDENT_ROUTE_PATHS } from "../constants/studentConstants";

const tabs = [
  { to: STUDENT_ROUTE_PATHS.overview, label: "Overview" },
  { to: STUDENT_ROUTE_PATHS.energy, label: "Energy Usage" },
  { to: STUDENT_ROUTE_PATHS.noise, label: "Noise Monitoring" },
  { to: STUDENT_ROUTE_PATHS.alerts, label: "Personal Alerts" }
];

export default function StudentSubNav() {
  return (
    <nav className="student-subnav" aria-label="Student section navigation">
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          className={({ isActive }) =>
            isActive ? "student-subnav-link active" : "student-subnav-link"
          }
        >
          {tab.label}
        </NavLink>
      ))}
    </nav>
  );
}

