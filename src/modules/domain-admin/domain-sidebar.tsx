import { Users, BookMarked, Mailbox, Gauge, Zap, ListChecks, Globe } from "lucide-react";
import Logo from "@/assets/images/logo.svg";
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

const items = [
  { title: "Users",          url: "/users",         icon: Users },
  { title: "Domain Aliases", url: "/aliases",        icon: BookMarked },
  { title: "Team Mailboxes", url: "/team-mailboxes", icon: Mailbox },
  { title: "Quota",          url: "/quota",          icon: Gauge },
  { title: "Rate Limiting",  url: "/rate-limiting",  icon: Zap },
  { title: "Tasks",          url: "/tasks",          icon: ListChecks },
];

export function DomainSidebar() {
  const domain = useDomain();
  const location = useLocation();

  return (
    <Sidebar>
      <SidebarHeader className="px-4 py-4 space-y-3">
        <img className="w-full" src={Logo} />
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
