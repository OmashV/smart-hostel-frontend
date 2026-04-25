import { NavLink } from "react-router-dom";
import { HiOutlineBars3, HiOutlineXMark } from "react-icons/hi2";
import {
  HiOutlineHome,
  HiOutlineBuildingOffice2,
  HiOutlineShieldCheck,
  HiOutlineUser,
  HiOutlineDocumentText
} from "react-icons/hi2";

const items = [
  { to: "/owner", label: "Owner", icon: <HiOutlineHome /> },
  { to: "/warden", label: "Warden", icon: <HiOutlineBuildingOffice2 /> },
  { to: "/security", label: "Security", icon: <HiOutlineShieldCheck /> },
  { to: "/student", label: "Student", icon: <HiOutlineUser /> }
];

export default function Sidebar({ sidebarOpen, setSidebarOpen }) {
  return (
    <>
      <aside className={`sidebar ${sidebarOpen ? "open" : "collapsed"}`}>
        <div className="sidebar-top-row">
          {sidebarOpen && <div className="brand">Smart Hostel</div>}

          <button
            className="sidebar-toggle-btn"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label="Toggle sidebar"
          >
            {sidebarOpen ? <HiOutlineXMark /> : <HiOutlineBars3 />}
          </button>
        </div>


        <nav className="nav-list">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                isActive ? "nav-item active" : "nav-item"
              }
              title={item.label}
            >
              <span className="nav-icon">{item.icon}</span>
              {sidebarOpen && <span className="nav-label">{item.label}</span>}
            </NavLink>
          ))}
        </nav>
      </aside>

      {sidebarOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </>
  );
}