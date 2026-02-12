import { Route, Routes, Navigate } from "react-router";
import { AppSidebar } from "./components/side-bar";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "./components/ui/sidebar";
import HealthCheck from "./modules/health-check";
import MailRepositories from "./modules/mail-repositories";
import MailRepositoriesList from "./modules/mail-repositories/mail-repositories-list";
import MailRepositoryDetail from "./modules/mail-repositories/details/mail-repository";
import MailRepositoryExtended from "./modules/mail-repositories/details/mail-repository-extended";
import EventDeadletter from "./modules/event-deadletter";
import EventListenersList from "./modules/event-deadletter/eventl-listeners-list";
import EventListenersDetail from "./modules/event-deadletter/details/event-listener";
import Domains from "./modules/domains";
import DomainsList from "./modules/domains/domains-list";
import DomainDetail from "./modules/domains/details/domain-detail";
import TeamMailboxDetail from "./modules/domains/details/team-mailbox-detail";
import GlobalQuota from "./modules/global-quota";
import Users from "./modules/users";
import UsersList from "./modules/users/users-list";
import UserDetail from "./modules/users/details/user-detail";
import Mappings from "./modules/mappings";
import MappingsList from "./modules/mappings/mappings-list";
import NetworkChannels from "./modules/network-channels";
import ChannelsList from "./modules/network-channels/channels-list";
import Cassandra from "./modules/cassandra";
import TasksList from "./modules/tasks";
import CommonTasks from "./modules/common-tasks/index";
import LiveMetrics from "./modules/live-metrics";
import TaskDetail from "./modules/common-tasks/task-detail";
import { ConfirmProvider } from "./components/custom/confirm-provider";
import { AuthProvider } from "./components/custom/auth-provider";
import { Toaster } from "./components/ui/toaster";
import Logo from "./assets/images/logo.svg";

function App() {
  return (
    <>
      <AuthProvider>
        <ConfirmProvider>
          <SidebarProvider>
          <AppSidebar />
          <SidebarInset>
            <header className="block md:hidden flex h-16 shrink-0 items-center gap-2 border-b px-4">
              <SidebarTrigger className="-ml-1" />
              <img className="w-[50%]" src={Logo} />
            </header>
            <Routes>
              {/* Redirect root path to /health-check */}
              <Route
                path="/"
                element={<Navigate to="/health-check" replace />}
              />
              <Route path="/health-check" element={<HealthCheck />} />
              <Route path="/mail-repositories" element={<MailRepositories />}>
                <Route index element={<MailRepositoriesList />} />
                <Route
                  path="repository/:id"
                  element={<MailRepositoryDetail />}
                />
                <Route
                  path="repository/:id/extended"
                  element={<MailRepositoryExtended />}
                />
              </Route>

              <Route path="/event-dead-letter" element={<EventDeadletter />}>
                <Route index element={<EventListenersList />} />
                <Route path="group/:id" element={<EventListenersDetail />} />
              </Route>
              <Route path="/domains" element={<Domains />}>
                <Route index element={<DomainsList />} />
                <Route path="domain/:domain" element={<DomainDetail />} />
                <Route path="domain/:domain/team-mailbox/:mailbox" element={<TeamMailboxDetail />} />
              </Route>
              <Route path="/global-quota" element={<GlobalQuota />} />
              <Route path="/users" element={<Users />}>
                <Route index element={<UsersList />} />
                <Route path="user/:username" element={<UserDetail />} />
              </Route>
              <Route path="/mappings" element={<Mappings />}>
                <Route index element={<MappingsList />} />
              </Route>
              <Route path="/network-channels" element={<NetworkChannels />}>
                <Route index element={<ChannelsList />} />
              </Route>
              <Route path="/cassandra" element={<Cassandra />} />
              <Route path="/tasks" element={<TasksList />} />
              <Route path="/common-tasks" element={<CommonTasks />} />
              <Route path="/live-metrics" element={<LiveMetrics />} />
              <Route path="/task/:id" element={<TaskDetail />} />
            </Routes>
          </SidebarInset>
          </SidebarProvider>
        </ConfirmProvider>
      </AuthProvider>
      <Toaster />
    </>
  );
}

export default App;
