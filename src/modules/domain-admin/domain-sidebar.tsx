import { Users, BookMarked, Mailbox, Gauge, Zap, ListChecks, Globe, LogOut, Languages } from "lucide-react";
import Logo from "@/assets/images/logo.svg";
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
import { supportedLanguages } from "@/i18n";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function LanguageSelector() {
  const { i18n, t } = useTranslation();
  const currentLang =
    supportedLanguages.find((l) => i18n.language?.startsWith(l.code)) ?? supportedLanguages[0];
  return (
    <SidebarMenuItem>
      <Select value={currentLang.code} onValueChange={(code) => i18n.changeLanguage(code)}>
        <SelectTrigger title={t("sidebar.language")}>
          <span className="flex items-center gap-2">
            <Languages className="h-4 w-4 shrink-0" />
            <SelectValue />
          </span>
        </SelectTrigger>
        <SelectContent>
          {supportedLanguages.map((l) => (
            <SelectItem key={l.code} value={l.code}>
              {l.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
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

export function DomainSidebar() {
  const domain = useDomain();
  const location = useLocation();
  const { t } = useTranslation();
  const canUsers = useIsAllowed("GET", "/domains/{domain}/users");
  const canAliases = useIsAllowed("GET", "/domains/{domain}/aliases");
  const canTeamMailboxes = useIsAllowed("GET", "/domains/{domain}/team-mailboxes");
  const canQuota = useIsAllowed("GET", "/quota/domains/{domain}");
  const canRateLimiting = useIsAllowed("GET", "/domains/{domain}/ratelimits");
  const canTasks = useIsAllowed("GET", "/tasks");

  const ALL_ITEMS = [
    { title: t("domainAdminPages.users"),        url: "/users",         icon: Users },
    { title: t("domainAdminPages.domainAliases"), url: "/aliases",        icon: BookMarked },
    { title: t("domainAdminPages.teamMailboxes"), url: "/team-mailboxes", icon: Mailbox },
    { title: t("domainAdminPages.quota"),         url: "/quota",          icon: Gauge },
    { title: t("domainAdminPages.rateLimiting"),  url: "/rate-limiting",  icon: Zap },
    { title: t("domainAdminPages.tasks"),         url: "/tasks",          icon: ListChecks },
  ];

  const VISIBILITY: Record<string, boolean> = {
    "/users": canUsers,
    "/aliases": canAliases,
    "/team-mailboxes": canTeamMailboxes,
    "/quota": canQuota,
    "/rate-limiting": canRateLimiting,
    "/tasks": canTasks,
  };

  const items = ALL_ITEMS.filter(item => VISIBILITY[item.url] !== false);

  return (
    <Sidebar variant="inset">
      <SidebarHeader className="px-4 py-4 space-y-3">
        <img className="w-full" src={Logo} />
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
