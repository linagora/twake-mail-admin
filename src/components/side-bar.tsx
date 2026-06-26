import { Heart, Mail, AlertCircle, ClipboardList, ListChecks, Users, Network, Globe, Gauge, Activity, Database, ArrowRightLeft, MapPin, UserCheck, LogOut, Languages, BarChart2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import Logo from '../assets/images/logo.svg';
import { Link, useLocation } from "react-router";
import { appConfig } from "@/lib/config";
import { useIsAllowed } from "@/lib/proxy-resolver-context";
import { useOIDC } from "@/components/custom/oidc-provider";
import { supportedLanguages } from "@/i18n";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function LanguageSelector() {
  const { i18n, t } = useTranslation();
  const currentLang =
    supportedLanguages.find((l) => i18n.language?.startsWith(l.code)) ?? supportedLanguages[0];
  return (
    <SidebarMenuItem>
      <div className="flex items-center gap-2 px-2">
        <Languages className="h-4 w-4 shrink-0" />
        <Select value={currentLang.code} onValueChange={(code) => i18n.changeLanguage(code)}>
          <SelectTrigger title={t("sidebar.language")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {supportedLanguages.map((l) => (
              <SelectItem key={l.code} value={l.code}>
                {l.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </SidebarMenuItem>
  );
}

function SidebarLogoutButton() {
  const { logout } = useOIDC();
  const { t } = useTranslation();
  return (
    <SidebarMenuItem>
      <SidebarMenuButton onClick={logout}>
        <LogOut />
        <span>{t("sidebar.logout")}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function AppSidebar() {
  const location = useLocation();
  const { t } = useTranslation();

  const canHealthCheck = useIsAllowed("GET", "/healthcheck");
  const canDomains = useIsAllowed("GET", "/domains");
  const canUsers = useIsAllowed("GET", "/users");
  const canRegisteredUsers = useIsAllowed("GET", "/registeredUsers");
  const canTasks = useIsAllowed("GET", "/tasks");
  const canCommonTasks = useIsAllowed("GET", "/tasks/{id}");
  const canResourceLocator = useIsAllowed("GET", "/mailboxes/{mailboxId}");
  const canMailRepositories = useIsAllowed("GET", "/mailRepositories");
  const canEventDeadletter = useIsAllowed("GET", "/events/deadLetter/groups");
  const canGlobalQuota = useIsAllowed("GET", "/quota");
  const canMappings = useIsAllowed("GET", "/mappings");
  const canNetworkChannels = useIsAllowed("GET", "/servers/channels");
  const canCassandra = useIsAllowed("GET", "/cassandra/version");
  const canLiveMetrics = useIsAllowed("GET", "/metrics");
  const canJmapReport = useIsAllowed("GET", "/jmap/settings/reports");

  const MAIL_ITEMS = [
    { title: t("sidebar.healthCheck"), url: "/health-check", icon: Heart },
    { title: t("sidebar.mailRepositories"), url: "/mail-repositories", icon: Mail },
    { title: t("sidebar.eventDeadLetter"), url: "/event-dead-letter", icon: AlertCircle },
    { title: t("sidebar.domains"), url: "/domains", icon: Globe },
    { title: t("sidebar.globalQuota"), url: "/global-quota", icon: Gauge },
    { title: t("sidebar.users"), url: "/users", icon: Users },
    { title: t("sidebar.mappings"), url: "/mappings", icon: ArrowRightLeft },
    { title: t("sidebar.networkChannels"), url: "/network-channels", icon: Network },
    { title: t("sidebar.cassandra"), url: "/cassandra", icon: Database },
    { title: t("sidebar.tasks"), url: "/tasks", icon: ListChecks },
    { title: t("sidebar.commonTasks"), url: "/common-tasks", icon: ClipboardList },
    { title: t("sidebar.resourceLocator"), url: "/resource-locator", icon: MapPin },
    { title: t("sidebar.jmapSettingsReport"), url: "/jmap-settings-report", icon: BarChart2 },
    { title: t("sidebar.liveMetrics"), url: "/live-metrics", icon: Activity },
  ];

  const CALENDAR_ITEMS = [
    { title: t("sidebar.healthCheck"), url: "/health-check", icon: Heart },
    { title: t("sidebar.domains"), url: "/domains", icon: Globe },
    { title: t("sidebar.users"), url: "/users", icon: Users },
    { title: t("sidebar.registeredUsers"), url: "/registered-users", icon: UserCheck },
    { title: t("sidebar.tasks"), url: "/tasks", icon: ListChecks },
    { title: t("sidebar.commonTasks"), url: "/common-tasks", icon: ClipboardList },
  ];

  const VISIBILITY: Record<string, boolean> = {
    "/health-check": canHealthCheck,
    "/domains": canDomains,
    "/users": canUsers,
    "/registered-users": canRegisteredUsers,
    "/tasks": canTasks,
    "/common-tasks": canCommonTasks,
    "/resource-locator": canResourceLocator,
    "/mail-repositories": canMailRepositories,
    "/event-dead-letter": canEventDeadletter,
    "/global-quota": canGlobalQuota,
    "/mappings": canMappings,
    "/network-channels": canNetworkChannels,
    "/cassandra": canCassandra,
    "/live-metrics": canLiveMetrics,
    "/jmap-settings-report": canJmapReport,
  };

  const allItems = appConfig.application === 'CALENDAR' ? CALENDAR_ITEMS : MAIL_ITEMS;
  const items = allItems.filter(item => VISIBILITY[item.url] !== false);

  return (
    <Sidebar variant="inset">
      <SidebarHeader>
        {appConfig.application === 'CALENDAR' ? (
          <div className="flex items-center gap-2 px-1 py-1">
            <img src="/favicon-calendar.svg" alt="Twake Calendar" className="w-8 h-8 shrink-0" />
            <span className="text-xl font-semibold leading-tight">
              Twake <span className="text-primary">Calendar</span>
            </span>
          </div>
        ) : (
          <img className="w-full" src={Logo} />
        )}
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{t("sidebar.application")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild>
                    <Link to={item.url} className={location.pathname.includes(item.url) ? 'font-bold' : ''}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarSeparator />
      <SidebarFooter>
        <SidebarMenu>
          <LanguageSelector />
          {appConfig.sso && <SidebarLogoutButton />}
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
