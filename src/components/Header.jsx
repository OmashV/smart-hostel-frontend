import { useLocation } from "react-router-dom";

export default function Header() {
  const { pathname } = useLocation();
  const isOwnerDashboard = pathname === "/owner";

  return (
    <header className="topbar">
      <div className="topbar-left">
        <div>
          <h1>
            {isOwnerDashboard
              ? "Hostel Energy Management Dashboard"
              : "Smart Hostel Monitoring Dashboard"}
          </h1>
          {!isOwnerDashboard ? (
            <p>Energy, waste, occupancy, behavior, and security views by user role.</p>
          ) : null}
        </div>
      </div>
    </header>
  );
}