import { ShieldCheck, Box, Users, UserCheck, ListChecks, Globe, LogOut } from "lucide-react";
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
import { useDomain } from "./domain-context";
import { useIsAllowed } from "@/lib/proxy-resolver-context";
import { appConfig } from "@/lib/config";
import { useOIDC } from "@/components/custom/oidc-provider";

function SidebarLogoutButton() {
  const { logout } = useOIDC();
  return (
    <SidebarMenuItem>
      <SidebarMenuButton onClick={logout}>
        <LogOut />
        <span>Logout</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

const ALL_ITEMS = [
  { title: "Domain Admins",    url: "/domain-admins",    icon: ShieldCheck },
  { title: "Resources",        url: "/resources",        icon: Box },
  { title: "Users",            url: "/users",            icon: Users },
  { title: "Registered Users", url: "/registered-users", icon: UserCheck },
  { title: "Tasks",            url: "/tasks",            icon: ListChecks },
];

export function CalendarDomainSidebar() {
  const domain = useDomain();
  const location = useLocation();
  const canDomainAdmins = useIsAllowed("GET", "/domains/{domain}/admins");
  const canResources = useIsAllowed("GET", "/domains/{domain}/resources");
  const canUsers = useIsAllowed("GET", "/domains/{domain}/users");
  const canRegisteredUsers = useIsAllowed("GET", "/registeredUsers");
  const canTasks = useIsAllowed("GET", "/tasks");

  const VISIBILITY: Record<string, boolean> = {
    "/domain-admins": canDomainAdmins,
    "/resources": canResources,
    "/users": canUsers,
    "/registered-users": canRegisteredUsers,
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
          <p className="text-base font-bold text-muted-foreground">Domain admin</p>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Administration</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
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
      {appConfig.sso && (
        <>
          <SidebarSeparator />
          <SidebarFooter>
            <SidebarMenu>
              <SidebarLogoutButton />
            </SidebarMenu>
          </SidebarFooter>
        </>
      )}
    </Sidebar>
  );
}
