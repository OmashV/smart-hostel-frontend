import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import OwnerDashboard from "./pages/OwnerDashboard";
import WardenDashboard from "./pages/WardenDashboard";
import SecurityDashboard from "./pages/SecurityDashboard";
import StudentDashboard from "./pages/StudentDashboard";
import DesignNotes from "./pages/DesignNotes";

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/owner" replace />} />
        <Route path="/owner" element={<OwnerDashboard />} />
        <Route path="/warden" element={<WardenDashboard />} />
        <Route path="/security" element={<SecurityDashboard />} />
        <Route path="/student" element={<StudentDashboard />} />
        <Route path="/design-notes" element={<DesignNotes />} />
      </Routes>
    </Layout>
  );
}