import { Heart, Mail, AlertCircle, ClipboardList } from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
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
    title: "Common Tasks",
    url: "/common-tasks",
    icon: ClipboardList,
  },
];

export function AppSidebar() {
  const location = useLocation(); // Get the current location

  // Check if the current path matches or is a subpath of the item URL
  const isActive = (url: string) => location.pathname.startsWith(url);
  return (
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Application</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem
                  key={item.title}
                  className={isActive(item.url) ? "bg-blue-500 text-white" : ""}
                >
                  <SidebarMenuButton asChild>
                    <a
                      href={item.url}
                      className={isActive(item.url) ? "font-semibold" : ""}
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
