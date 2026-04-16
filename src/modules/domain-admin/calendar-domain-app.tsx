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
import { CalendarDomainSidebar } from "./calendar-domain-sidebar";
import CalendarDomainAdminsPage from "./pages/calendar-domain-admins-page";
import CalendarResourcesPage from "./pages/calendar-resources-page";
import CalendarTasksPage from "./pages/calendar-tasks-page";
import CalendarDomainUsersList from "./calendar-domain-users-list";

import Users from "@/modules/users";
import CalendarUserDetail from "@/modules/users/details/calendar-user-detail";
import RegisteredUsers from "@/modules/registered-users";
import RegisteredUsersList from "@/modules/registered-users/registered-users-list";
import TaskDetail from "@/modules/common-tasks/task-detail";
import CalendarResourceDetail from "@/modules/domains/details/calendar-resource-detail";

function OIDCLogoutButton() {
  const { logout } = useOIDC();
  return (
    <Button variant="ghost" size="sm" onClick={logout} className="gap-2">
      <LogOut className="h-4 w-4" />
      Logout
    </Button>
  );
}

interface Props {
  domain: string;
  sso: SSOConfig | null;
}

export default function CalendarDomainApp({ domain, sso }: Props) {
  return (
    <DomainProvider value={domain}>
      <ConfirmProvider>
        <SidebarProvider>
          <CalendarDomainSidebar />
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
                <Route path="/" element={<Navigate to="/domain-admins" replace />} />

                <Route path="/domain-admins" element={<CalendarDomainAdminsPage />} />
                <Route path="/resources" element={<CalendarResourcesPage />} />
                <Route
                  path="/resources/resource/:resourceId"
                  element={<CalendarResourceDetail />}
                />

                <Route path="/users" element={<Users />}>
                  <Route index element={<CalendarDomainUsersList />} />
                  <Route path="user/:username" element={<CalendarUserDetail />} />
                </Route>

                <Route path="/registered-users" element={<RegisteredUsers />}>
                  <Route index element={<RegisteredUsersList />} />
                </Route>

                <Route path="/tasks" element={<CalendarTasksPage />} />

                <Route path="/task/:id" element={<TaskDetail />} />

                <Route path="*" element={<Navigate to="/domain-admins" replace />} />
              </Routes>
            </div>
          </SidebarInset>
        </SidebarProvider>
      </ConfirmProvider>
    </DomainProvider>
  );
}
