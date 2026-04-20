import { Heart, Mail, AlertCircle, ClipboardList, ListChecks, Users, Network, Globe, Gauge, Activity, Database, ArrowRightLeft, MapPin, UserCheck } from "lucide-react";

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
import Logo from '../assets/images/logo.svg';
import { useLocation } from "react-router";
import { appConfig } from "@/lib/config";
import { useIsAllowed } from "@/lib/proxy-resolver-context";

const MAIL_ITEMS = [
  { title: "Health Check", url: "/health-check", icon: Heart },
  { title: "Mail Repositories", url: "/mail-repositories", icon: Mail },
  { title: "Event Dead Letter", url: "/event-dead-letter", icon: AlertCircle },
  { title: "Domains", url: "/domains", icon: Globe },
  { title: "Global Quota", url: "/global-quota", icon: Gauge },
  { title: "Users", url: "/users", icon: Users },
  { title: "Mappings", url: "/mappings", icon: ArrowRightLeft },
  { title: "Network Channels", url: "/network-channels", icon: Network },
  { title: "Cassandra", url: "/cassandra", icon: Database },
  { title: "Tasks", url: "/tasks", icon: ListChecks },
  { title: "Common Tasks", url: "/common-tasks", icon: ClipboardList },
  { title: "Resource Locator", url: "/resource-locator", icon: MapPin },
  { title: "Live Metrics", url: "/live-metrics", icon: Activity },
];

const CALENDAR_ITEMS = [
  { title: "Health Check", url: "/health-check", icon: Heart },
  { title: "Domains", url: "/domains", icon: Globe },
  { title: "Users", url: "/users", icon: Users },
  { title: "Registered Users", url: "/registered-users", icon: UserCheck },
  { title: "Tasks", url: "/tasks", icon: ListChecks },
  { title: "Common Tasks", url: "/common-tasks", icon: ClipboardList },
];

export function AppSidebar() {
  const location = useLocation();
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
  };

  const allItems = appConfig.application === 'CALENDAR' ? CALENDAR_ITEMS : MAIL_ITEMS;
  const items = allItems.filter(item => VISIBILITY[item.url] !== false);

  return (
    <Sidebar>
      <SidebarHeader className="hidden md:block">
        {appConfig.application === 'CALENDAR' ? (
          <div className="flex items-center gap-2 px-1 py-1">
            <img src="/favicon-calendar.svg" alt="Twake Calendar" className="w-8 h-8 shrink-0" />
            <span className="text-xl font-semibold leading-tight">
              Twake <span className="text-orange-500">Calendar</span>
            </span>
          </div>
        ) : (
          <img className="w-full" src={Logo} />
        )}
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Application</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <a href={item.url} className={location.pathname.includes(item.url) ? 'font-bold' : ''}>
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
