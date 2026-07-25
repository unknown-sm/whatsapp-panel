import { useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "./store/authStore";
import { useTranslation } from "react-i18next";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import BotGrid from "./pages/BotGrid";
import BotEditor from "./pages/BotEditor";
import Conversations from "./pages/Conversations";
import FollowUp from "./pages/FollowUp";
import Settings from "./pages/Settings";
import Pipeline from "./pages/Pipeline";
import LeadScoring from "./pages/LeadScoring";
import Broadcasts from "./pages/Broadcasts";
import Analytics from "./pages/Analytics";
import Logs from "./pages/Logs";
import Lab from "./pages/Lab";
import Templates from "./pages/Templates";
import Reports from "./pages/Reports";
import Nps from "./pages/Nps";
import AppLayout from "./components/AppLayout";
import { ToastContainer } from "./components/ToastContainer";

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

function App() {
  const fetchMe = useAuthStore((s) => s.fetchMe);
  const isLoading = useAuthStore((s) => s.isLoading);
  const { t } = useTranslation();
  useEffect(() => { fetchMe(); }, [fetchMe]);
  if (isLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", background: "#1a202c", color: "#e2e8f0", fontSize: 18 }}>
        {t("app.loading")}
      </div>
    );
  }
  return (
    <>
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<PrivateRoute><AppLayout /></PrivateRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="bots" element={<BotGrid />} />
        <Route path="bots/:id" element={<BotEditor />} />
        <Route path="conversations" element={<Conversations />} />
        <Route path="followup" element={<FollowUp />} />
        <Route path="pipeline" element={<Pipeline />} />
        <Route path="leadscoring" element={<LeadScoring />} />
        <Route path="broadcasts" element={<Broadcasts />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="logs" element={<Logs />} />
        <Route path="lab" element={<Lab />} />
        <Route path="templates" element={<Templates />} />
        <Route path="reports" element={<Reports />} />
        <Route path="nps" element={<Nps />} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
    <ToastContainer />
    </>
  );
}
export default App;
