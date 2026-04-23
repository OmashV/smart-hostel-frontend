import { Navigate, Route, Routes } from "react-router-dom";
import FloatingDashboardChatbot from "./components/FloatingDashboardChatbot";
import Layout from "./components/Layout";
import { ChatbotProvider } from "./context/ChatbotContext";
import OwnerDashboard from "./pages/OwnerDashboard";
import WardenDashboard from "./pages/WardenDashboard";
import SecurityDashboard from "./pages/SecurityDashboard";
import StudentDashboard from "./pages/StudentDashboard";


export default function App() {
  return (
    <ChatbotProvider>
      <Layout>
        <Routes>
          <Route path="/" element={<Navigate to="/owner" replace />} />
          <Route path="/owner" element={<OwnerDashboard />} />
          <Route path="/warden" element={<WardenDashboard />} />
          <Route path="/security" element={<SecurityDashboard />} />
          <Route path="/student" element={<StudentDashboard />} />
        </Routes>
      </Layout>
      <FloatingDashboardChatbot />
    </ChatbotProvider>
  );
}
