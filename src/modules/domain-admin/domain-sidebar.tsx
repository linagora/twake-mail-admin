import { Users, BookMarked, Mailbox, Gauge, Zap, ListChecks, Globe, LogOut, Languages, Mails } from "lucide-react";
import Logo from "@/assets/images/logo.svg";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { useLocation } from "react-router";
import { SidebarNavGroups } from "@/components/sidebar-nav-item";
import { type NavGroup, visibleNavGroups } from "@/components/nav-groups";
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

export function DomainSidebar() {
  const domain = useDomain();
  const location = useLocation();
  const { t } = useTranslation();
  const canUsers = useIsAllowed("GET", "/domains/{domain}/users");
  const canAliases = useIsAllowed("GET", "/domains/{domain}/aliases");
  const canTeamMailboxes = useIsAllowed("GET", "/domains/{domain}/team-mailboxes");
  const canQuota = useIsAllowed("GET", "/quota/domains/{domain}");
  const canRateLimiting = useIsAllowed("GET", "/domains/{domain}/ratelimits");
  const canMailingLists = useIsAllowed("GET", "/mailingLists");
  const canTasks = useIsAllowed("GET", "/tasks");

  // Grouped like the global sidebar, by what the operator comes to do
  const GROUPS: NavGroup[] = [
    { label: t("sidebar.groupDirectory"), items: [
      { title: t("domainAdminPages.users"),         url: "/users",          icon: Users },
      { title: t("domainAdminPages.teamMailboxes"), url: "/team-mailboxes", icon: Mailbox },
      { title: t("domainAdminPages.mailingLists"),  url: "/mailing-lists",  icon: Mails },
      { title: t("domainAdminPages.domainAliases"), url: "/aliases",        icon: BookMarked },
    ] },
    { label: t("sidebar.groupDomainSettings"), items: [
      { title: t("domainAdminPages.quota"),         url: "/quota",          icon: Gauge },
      { title: t("domainAdminPages.rateLimiting"),  url: "/rate-limiting",  icon: Zap },
    ] },
    { label: t("sidebar.groupMaintenance"), items: [
      { title: t("domainAdminPages.tasks"),         url: "/tasks",          icon: ListChecks },
    ] },
  ];

  const VISIBILITY: Record<string, boolean> = {
    "/users": canUsers,
    "/aliases": canAliases,
    "/team-mailboxes": canTeamMailboxes,
    "/quota": canQuota,
    "/rate-limiting": canRateLimiting,
    "/mailing-lists": canMailingLists,
    "/tasks": canTasks,
  };

  const groups = visibleNavGroups(GROUPS, VISIBILITY);

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
        <SidebarNavGroups groups={groups} isActive={(url) => location.pathname.startsWith(url)} />
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
