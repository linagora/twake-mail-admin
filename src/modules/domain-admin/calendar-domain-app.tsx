import { Navigate, Route, Routes } from "react-router";
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { ConfirmProvider } from "@/components/custom/confirm-provider";
import type { SSOConfig } from "@/lib/env-config";
import { DomainProvider } from "./domain-context";
import { CalendarDomainSidebar } from "./calendar-domain-sidebar";
import CalendarDomainAdminsPage from "./pages/calendar-domain-admins-page";
import CalendarResourcesPage from "./pages/calendar-resources-page";
import CalendarSettingsPage from "./pages/calendar-settings-page";
import CalendarTasksPage from "./pages/calendar-tasks-page";
import CalendarDomainUsersList from "./calendar-domain-users-list";

import Users from "@/modules/users";
import CalendarUserDetail from "@/modules/users/details/calendar-user-detail";
import RegisteredUsers from "@/modules/registered-users";
import RegisteredUsersList from "@/modules/registered-users/registered-users-list";
import TaskDetail from "@/modules/common-tasks/task-detail";
import CalendarResourceDetail from "@/modules/domains/details/calendar-resource-detail";

interface Props {
  domain: string;
  sso: SSOConfig | null;
}

export default function CalendarDomainApp({ domain }: Props) {
  return (
    <DomainProvider value={domain}>
      <ConfirmProvider>
        <SidebarProvider>
          <CalendarDomainSidebar />
          <SidebarInset>
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

                <Route path="/settings" element={<CalendarSettingsPage />} />

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
