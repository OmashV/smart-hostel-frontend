import Sidebar from "./Sidebar";
import Header from "./Header";

export default function Layout({ children }) {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-shell">
        <Header />
        <main className="page-content">{children}</main>
      </div>
    </div>
  );
}