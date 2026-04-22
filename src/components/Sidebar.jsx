import { NavLink } from "react-router-dom";

const items = [
  { to: "/owner", label: "Owner" },
  { to: "/warden", label: "Warden" },
  { to: "/security", label: "Security" },
  { to: "/student", label: "Student" },
];

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="brand">Smart Hostel</div>

      <nav className="nav-list">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              isActive ? "nav-item active" : "nav-item"
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}