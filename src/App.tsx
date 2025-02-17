import { Route, Routes, Navigate } from "react-router";
import { AppSidebar } from "./components/side-bar";
import { SidebarProvider } from "./components/ui/sidebar";
import HealthCheck from "./modules/health-check";
import MailRepositories from "./modules/mail-repositories";
import MailRepositoriesList from "./modules/mail-repositories/mail-repositories-list";
import MailRepositoryDetail from "./modules/mail-repositories/details/mail-repository";
import EventDeadletter from "./modules/event-deadletter";
import EventListenersList from "./modules/event-deadletter/eventl-listeners-list";
import EventListenersDetail from "./modules/event-deadletter/details/event-listener";
import CommonTasks from "./modules/common-tasks/index";
import TaskDetail from "./modules/common-tasks/task-detail";
import { ConfirmProvider } from "./components/custom/confirm-provider";
import { Toaster } from "./components/ui/toaster";

function App() {
  return (
    <>
      <ConfirmProvider>
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
            <Route path="/event-dead-letter" element={<EventDeadletter />}>
              <Route index element={<EventListenersList />} />
              <Route
                path="event-dead-letter/:id"
                element={<EventListenersDetail />}
              />
            </Route>
            <Route path="/common-tasks" element={<CommonTasks />} />
            <Route path="/task/:id" element={<TaskDetail />} />
          </Routes>
        </SidebarProvider>
      </ConfirmProvider>
      <Toaster />
    </>
  );
}

export default App;
