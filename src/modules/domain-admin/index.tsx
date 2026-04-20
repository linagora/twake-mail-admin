import { Navigate, Route, Routes } from "react-router";
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { ConfirmProvider } from "@/components/custom/confirm-provider";
import type { SSOConfig } from "@/lib/env-config";
import { DomainProvider } from "./domain-context";
import { DomainSidebar } from "./domain-sidebar";
import DomainUsersList from "./domain-users-list";
import AliasesPage from "./pages/aliases";
import TeamMailboxesPage from "./pages/team-mailboxes";
import QuotaPage from "./pages/quota";
import RateLimitingPage from "./pages/rate-limiting";
import TasksPage from "./pages/tasks";

// Reuse the per-user and team-mailbox detail pages from global mode
import Users from "@/modules/users";
import UserDetail from "@/modules/users/details/user-detail";
import UserMessageSearch from "@/modules/users/details/user-message-search";
import TeamMailboxDetail from "@/modules/domains/details/team-mailbox-detail";
import TeamMailboxFolderDetail from "@/modules/domains/details/team-mailbox-folder-detail";
import TaskDetail from "@/modules/common-tasks/task-detail";

interface Props {
  domain: string;
  sso: SSOConfig | null;
}

export default function DomainAdminApp({ domain }: Props) {
  return (
    <DomainProvider value={domain}>
      <ConfirmProvider>
        <SidebarProvider>
          <DomainSidebar />
          <SidebarInset>
            <div className="p-4">
              <Routes>
                <Route path="/" element={<Navigate to="/users" replace />} />

                {/* Users */}
                <Route path="/users" element={<Users />}>
                  <Route index element={<DomainUsersList />} />
                  <Route path="user/:username" element={<UserDetail />} />
                  <Route path="user/:username/message-search" element={<UserMessageSearch />} />
                </Route>

                {/* Domain sections as standalone pages */}
                <Route path="/aliases" element={<AliasesPage />} />
                <Route path="/team-mailboxes" element={<TeamMailboxesPage />} />
                <Route path="/quota" element={<QuotaPage />} />
                <Route path="/rate-limiting" element={<RateLimitingPage />} />
                <Route path="/tasks" element={<TasksPage />} />

                {/* Team mailbox detail — reuse global routes so existing links work */}
                <Route
                  path="/domains/domain/:domain/team-mailbox/:mailbox"
                  element={<TeamMailboxDetail />}
                />
                <Route
                  path="/domains/domain/:domain/team-mailbox/:mailbox/folder/:folder"
                  element={<TeamMailboxFolderDetail />}
                />

                {/* Task detail */}
                <Route path="/task/:id" element={<TaskDetail />} />

                <Route path="*" element={<Navigate to="/users" replace />} />
              </Routes>
            </div>
          </SidebarInset>
        </SidebarProvider>
      </ConfirmProvider>
    </DomainProvider>
  );
}
