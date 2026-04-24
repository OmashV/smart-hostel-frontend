import { useEffect, useState } from "react";
import Sidebar from "./Sidebar";
import Header from "./Header";

export default function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    try {
      const saved = localStorage.getItem("smart-hostel.sidebarOpen");
      return saved === null ? false : saved === "true";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("smart-hostel.sidebarOpen", String(sidebarOpen));
    } catch {
      // Ignore persistence failures (e.g. private mode).
    }
  }, [sidebarOpen]);

  return (
    <div className={`app-shell ${sidebarOpen ? "sidebar-open" : "sidebar-closed"}`}>
      <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      <div className="main-shell">
        <Header />
        <main className="page-content">{children}</main>
      </div>
    </div>
  );
}