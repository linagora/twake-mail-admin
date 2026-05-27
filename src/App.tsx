import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Route, Routes, Navigate } from "react-router";
import { AppSidebar } from "./components/side-bar";
import {
  SidebarInset,
  SidebarProvider,
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
import CalendarDomainDetail from "./modules/domains/details/calendar-domain-detail";
import CalendarResourceDetail from "./modules/domains/details/calendar-resource-detail";
import TeamMailboxDetail from "./modules/domains/details/team-mailbox-detail";
import TeamMailboxFolderDetail from "./modules/domains/details/team-mailbox-folder-detail";
import GlobalQuota from "./modules/global-quota";
import Users from "./modules/users";
import UsersList from "./modules/users/users-list";
import UserDetail from "./modules/users/details/user-detail";
import CalendarUserDetail from "./modules/users/details/calendar-user-detail";
import UserMessageSearch from "./modules/users/details/user-message-search";
import RegisteredUsers from "./modules/registered-users";
import RegisteredUsersList from "./modules/registered-users/registered-users-list";
import Mappings from "./modules/mappings";
import MappingsList from "./modules/mappings/mappings-list";
import NetworkChannels from "./modules/network-channels";
import ChannelsList from "./modules/network-channels/channels-list";
import ChannelsMap from "./modules/network-channels/channels-map";
import ChannelsUserAgent from "./modules/network-channels/channels-user-agent";
import Cassandra from "./modules/cassandra";
import TasksList from "./modules/tasks";
import CommonTasks from "./modules/common-tasks/index";
import LiveMetrics from "./modules/live-metrics";
import ResourceLocator from "./modules/resource-locator";
import JmapSettingsReport from "./modules/jmap-settings-report";
import TaskDetail from "./modules/common-tasks/task-detail";
import { ConfirmProvider } from "./components/custom/confirm-provider";
import { AuthProvider } from "./components/custom/auth-provider";
import { OIDCProvider } from "./components/custom/oidc-provider";
import { OIDCCallback } from "./components/custom/oidc-callback";
import { ProxyResolverProvider } from "./lib/proxy-resolver-context";
import { Toaster } from "./components/ui/toaster";
import { appConfig } from "./lib/config";
import { apiClient } from "./lib/apiClient";
import DomainAdminApp from "./modules/domain-admin";
import CalendarDomainApp from "./modules/domain-admin/calendar-domain-app";

// ---------------------------------------------------------------------------
// GLOBAL mode — unchanged layout
// ---------------------------------------------------------------------------

function GlobalLayout() {
  const isCalendar = appConfig.application === 'CALENDAR';

  return (
    <ConfirmProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <Routes>
            <Route path="/" element={<Navigate to="/health-check" replace />} />
            <Route path="/health-check" element={<HealthCheck />} />

            {/* Mail-only routes */}
            {!isCalendar && (
              <>
                <Route path="/mail-repositories" element={<MailRepositories />}>
                  <Route index element={<MailRepositoriesList />} />
                  <Route path="repository/:id" element={<MailRepositoryDetail />} />
                  <Route path="repository/:id/extended" element={<MailRepositoryExtended />} />
                </Route>
                <Route path="/event-dead-letter" element={<EventDeadletter />}>
                  <Route index element={<EventListenersList />} />
                  <Route path="group/:id" element={<EventListenersDetail />} />
                </Route>
                <Route path="/global-quota" element={<GlobalQuota />} />
                <Route path="/mappings" element={<Mappings />}>
                  <Route index element={<MappingsList />} />
                </Route>
                <Route path="/network-channels" element={<NetworkChannels />}>
                  <Route index element={<ChannelsList />} />
                  <Route path="map" element={<ChannelsMap />} />
                  <Route path="user-agent" element={<ChannelsUserAgent />} />
                </Route>
                <Route path="/cassandra" element={<Cassandra />} />
                <Route path="/resource-locator" element={<ResourceLocator />} />
                <Route path="/jmap-settings-report" element={<JmapSettingsReport />} />
              </>
            )}

            {/* Domains — detail page differs by application */}
            <Route path="/domains" element={<Domains />}>
              <Route index element={<DomainsList />} />
              {isCalendar ? (
                <>
                  <Route path="domain/:domain" element={<CalendarDomainDetail />} />
                  <Route path="domain/:domain/resource/:resourceId" element={<CalendarResourceDetail />} />
                </>
              ) : (
                <>
                  <Route path="domain/:domain" element={<DomainDetail />} />
                  <Route path="domain/:domain/team-mailbox/:mailbox" element={<TeamMailboxDetail />} />
                  <Route path="domain/:domain/team-mailbox/:mailbox/folder/:folder" element={<TeamMailboxFolderDetail />} />
                </>
              )}
            </Route>

            {/* Users — detail page differs by application */}
            <Route path="/users" element={<Users />}>
              <Route index element={<UsersList />} />
              {isCalendar ? (
                <Route path="user/:username" element={<CalendarUserDetail />} />
              ) : (
                <>
                  <Route path="user/:username" element={<UserDetail />} />
                  <Route path="user/:username/message-search" element={<UserMessageSearch />} />
                </>
              )}
            </Route>

            {/* Calendar-only routes */}
            {isCalendar && (
              <Route path="/registered-users" element={<RegisteredUsers />}>
                <Route index element={<RegisteredUsersList />} />
              </Route>
            )}

            {/* Common routes */}
            <Route path="/tasks" element={<TasksList />} />
            <Route path="/common-tasks" element={<CommonTasks />} />
            <Route path="/live-metrics" element={<LiveMetrics />} />
            <Route path="/task/:id" element={<TaskDetail />} />
          </Routes>
        </SidebarInset>
      </SidebarProvider>
    </ConfirmProvider>
  );
}

// ---------------------------------------------------------------------------
// DOMAIN mode — resolves domain then renders DomainAdminApp
// ---------------------------------------------------------------------------

function DomainModeWrapper() {
  const { t } = useTranslation();
  const [domain, setDomain] = useState<string | null>(appConfig.domain);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (domain) return; // already resolved from env.js
    apiClient.get<any, { domain: string }>('/.proxy/myDomain')
      .then((res) => setDomain(res.domain))
      .catch(() => setError(t("common.domainResolveError")));
  }, [domain]);

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  if (!domain) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-muted-foreground">{t("common.resolvingDomain")}</p>
      </div>
    );
  }

  if (appConfig.application === 'CALENDAR') {
    return <CalendarDomainApp domain={domain} sso={appConfig.sso} />;
  }
  return <DomainAdminApp domain={domain} sso={appConfig.sso} />;
}

// ---------------------------------------------------------------------------
// Root — picks the right layout based on MODE, wraps with auth provider
// ---------------------------------------------------------------------------

function AppContent() {
  const inner = appConfig.mode === 'DOMAIN' ? <DomainModeWrapper /> : <GlobalLayout />;

  return appConfig.sso ? (
    <OIDCProvider config={appConfig.sso}>
      <ProxyResolverProvider>{inner}</ProxyResolverProvider>
    </OIDCProvider>
  ) : (
    <AuthProvider>
      <ProxyResolverProvider>{inner}</ProxyResolverProvider>
    </AuthProvider>
  );
}

function App() {
  return (
    <>
      <Routes>
        {appConfig.sso && (
          <Route
            path="/oidc-callback"
            element={<OIDCCallback config={appConfig.sso} />}
          />
        )}
        <Route path="*" element={<AppContent />} />
      </Routes>
      <Toaster />
    </>
  );
}

export default App;
