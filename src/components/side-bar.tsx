import { Heart, Mail, AlertCircle, ClipboardList, Users, Network } from "lucide-react";

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

// Menu items.
const items = [
  {
    title: "Health Check",
    url: "/health-check",
    icon: Heart,
  },
  {
    title: "Mail Repositories",
    url: "/mail-repositories",
    icon: Mail,
  },
  {
    title: "Event Dead Letter",
    url: "/event-dead-letter",
    icon: AlertCircle,
  },
  {
    title: "Users",
    url: "/users",
    icon: Users,
  },
  {
    title: "Network Channels",
    url: "/network-channels",
    icon: Network,
  },
  {
    title: "Common Tasks",
    url: "/common-tasks",
    icon: ClipboardList,
  },
];

export function AppSidebar() {
  const location = useLocation();

  return (
    <Sidebar>
      <SidebarHeader className="hidden md:block">
        <img className="w-full" src={Logo} />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Application</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem
                  key={item.title}
                >
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
