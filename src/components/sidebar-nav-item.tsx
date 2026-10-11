import type { LucideIcon } from "lucide-react";
import { Link } from "react-router";
import { SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";

export interface SidebarNavEntry {
  title: string;
  url: string;
  icon: LucideIcon;
}

interface SidebarNavItemProps {
  item: SidebarNavEntry;
  isActive: boolean;
}

/**
 * A sidebar navigation link. The current page is exposed both visually (bold)
 * and to assistive technologies (aria-current="page", data-active="true").
 */
export function SidebarNavItem({ item, isActive }: SidebarNavItemProps) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={isActive} className="data-[active=true]:font-bold">
        <Link to={item.url} aria-current={isActive ? "page" : undefined}>
          <item.icon />
          <span>{item.title}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
