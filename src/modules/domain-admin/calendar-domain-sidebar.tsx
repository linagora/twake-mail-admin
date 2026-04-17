import { ShieldCheck, Box, Users, UserCheck, ListChecks, Globe } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useLocation } from "react-router";
import { useDomain } from "./domain-context";
import { useIsAllowed } from "@/lib/proxy-resolver-context";

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
    <Sidebar>
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
                    <a
                      href={item.url}
                      className={location.pathname.startsWith(item.url) ? "font-bold" : ""}
                    >
                      <item.icon />
                      <span>{item.title}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
