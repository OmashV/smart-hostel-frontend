import { Navigate, Route, Routes } from "react-router-dom";
<<<<<<< HEAD

import Layout from "./components/Layout";

=======
import FloatingDashboardChatbot from "./components/FloatingDashboardChatbot";
import Layout from "./components/Layout";
import { ChatbotProvider } from "./context/ChatbotContext";
>>>>>>> main
import OwnerDashboard from "./pages/OwnerDashboard";
import WardenDashboard from "./pages/WardenDashboard";
import SecurityDashboard from "./pages/SecurityDashboard";

import StudentModuleLayout from "./features/student/pages/StudentModuleLayout";
import StudentOverviewPage from "./features/student/pages/StudentOverviewPage";
import StudentEnergyPage from "./features/student/pages/StudentEnergyPage";
import StudentNoisePage from "./features/student/pages/StudentNoisePage";
import StudentAlertsPage from "./features/student/pages/StudentAlertsPage";


export default function App() {
  return (
<<<<<<< HEAD
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/owner" replace />} />
        <Route path="/owner" element={<OwnerDashboard />} />
        <Route path="/warden" element={<WardenDashboard />} />
        <Route path="/security" element={<SecurityDashboard />} />

        <Route path="/student" element={<StudentModuleLayout />}>
          <Route index element={<Navigate to="overview" replace />} />
          <Route path="overview" element={<StudentOverviewPage />} />
          <Route path="energy" element={<StudentEnergyPage />} />
          <Route path="noise" element={<StudentNoisePage />} />
          <Route path="alerts" element={<StudentAlertsPage />} />
        </Route>
      </Routes>
    </Layout>
=======
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
>>>>>>> main
  );
}
