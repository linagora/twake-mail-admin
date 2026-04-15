import { Navigate, Route, Routes } from "react-router";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { ConfirmProvider } from "@/components/custom/confirm-provider";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { useOIDC } from "@/components/custom/oidc-provider";
import type { SSOConfig } from "@/lib/env-config";
import { DomainProvider } from "./domain-context";
import { DomainSidebar } from "./domain-sidebar";

function OIDCLogoutButton() {
  const { logout } = useOIDC();
  return (
    <Button variant="ghost" size="sm" onClick={logout} className="gap-2">
      <LogOut className="h-4 w-4" />
      Logout
    </Button>
  );
}
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

export default function DomainAdminApp({ domain, sso }: Props) {
  return (
    <DomainProvider value={domain}>
      <ConfirmProvider>
        <SidebarProvider>
          <DomainSidebar />
          <SidebarInset>
            <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
              <div className="md:hidden">
                <SidebarTrigger className="-ml-1" />
              </div>
              <div className="flex-1" />
              {sso && <OIDCLogoutButton />}
            </header>
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
