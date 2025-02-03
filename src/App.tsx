import { Route, Routes, Navigate } from "react-router";
import { AppSidebar } from "./components/side-bar";
import { SidebarProvider } from "./components/ui/sidebar";
import HealthCheck from "./modules/health-check";
import MailRepositories from "./modules/mail-repositories";
import MailRepositoriesList from "./modules/mail-repositories/mail-repositories-list";
import MailRepositoryDetail from "./modules/mail-repositories/details/mail-repository";

function App() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <Routes>
        {/* Redirect root path to /health-check */}
        <Route path="/" element={<Navigate to="/health-check" replace />} />
        <Route path="/health-check" element={<HealthCheck />} />
        <Route path="/mail-repositories" element={<MailRepositories />}>
          <Route index element={<MailRepositoriesList />} />
          <Route path="repository/:id" element={<MailRepositoryDetail />} />
        </Route>
      </Routes>
    </SidebarProvider>
  );
}

export default App;
