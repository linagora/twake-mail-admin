import { ShieldCheck, Box, Users, UserCheck, ListChecks, Settings, Globe, LogOut, Languages } from "lucide-react";
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
import { Link, useLocation } from "react-router";
import { useTranslation } from "react-i18next";
import { useDomain } from "./domain-context";
import { useIsAllowed } from "@/lib/proxy-resolver-context";
import { appConfig } from "@/lib/config";
import { useOIDC } from "@/components/custom/oidc-provider";

function LanguageSelector() {
  const { i18n, t } = useTranslation();
  const current = i18n.language?.startsWith("fr") ? "fr" : "en";
  const next = current === "fr" ? "en" : "fr";
  return (
    <SidebarMenuItem>
      <SidebarMenuButton onClick={() => i18n.changeLanguage(next)} title={t("sidebar.language")}>
        <Languages />
        <span>{current === "fr" ? "Français" : "English"}</span>
      </SidebarMenuButton>
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

export function CalendarDomainSidebar() {
  const domain = useDomain();
  const location = useLocation();
  const { t } = useTranslation();
  const canDomainAdmins = useIsAllowed("GET", "/domains/{domain}/admins");
  const canResources = useIsAllowed("GET", "/domains/{domain}/resources");
  const canUsers = useIsAllowed("GET", "/domains/{domain}/users");
  const canRegisteredUsers = useIsAllowed("GET", "/registeredUsers");
  const canSettings = useIsAllowed("GET", "/domains/{domain}/settings");
  const canTasks = useIsAllowed("GET", "/tasks");

  const ALL_ITEMS = [
    { title: t("domainAdminPages.calendarAdmins"),    url: "/domain-admins",    icon: ShieldCheck },
    { title: t("domainAdminPages.resources"),         url: "/resources",        icon: Box },
    { title: t("domainAdminPages.users"),             url: "/users",            icon: Users },
    { title: t("domainAdminPages.registeredUsers"),   url: "/registered-users", icon: UserCheck },
    { title: t("domainAdminPages.calendarSettings"),  url: "/settings",         icon: Settings },
    { title: t("domainAdminPages.tasks"),             url: "/tasks",            icon: ListChecks },
  ];

  const VISIBILITY: Record<string, boolean> = {
    "/domain-admins": canDomainAdmins,
    "/resources": canResources,
    "/users": canUsers,
    "/registered-users": canRegisteredUsers,
    "/settings": canSettings,
    "/tasks": canTasks,
  };

  const items = ALL_ITEMS.filter(item => VISIBILITY[item.url] !== false);

  return (
    <Sidebar variant="inset">
      <SidebarHeader className="px-4 py-4 space-y-3">
        <div className="flex items-center gap-2">
          <img src="/favicon-calendar.svg" alt="Twake Calendar" className="w-8 h-8 shrink-0" />
          <span className="text-xl font-semibold leading-tight">
            Twake <span className="text-orange-500">Calendar</span>
          </span>
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-muted-foreground shrink-0" />
            <span className="text-lg font-bold truncate" title={domain}>{domain}</span>
          </div>
          <p className="text-base font-bold text-muted-foreground">{t("domainAdminPages.domainAdmin")}</p>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{t("domainAdminPages.administration")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild>
                    <Link
                      to={item.url}
                      className={location.pathname.startsWith(item.url) ? "font-bold" : ""}
                    >
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
