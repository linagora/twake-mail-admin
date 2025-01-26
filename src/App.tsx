import { Route, Routes, Navigate } from "react-router";
import { AppSidebar } from "./components/side-bar";
import { SidebarProvider } from "./components/ui/sidebar";
import HealthCheck from "./modules/health-check";
import MailRepositories from "./modules/mail-repositories";

function App() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <Routes>
        {/* Redirect root path to /health-check */}
        <Route path="/" element={<Navigate to="/health-check" replace />} />
        <Route path="/health-check" element={<HealthCheck />} />
        <Route path="/mail-repositories" element={<MailRepositories />} />
      </Routes>
    </SidebarProvider>
  );
}

export default App;
