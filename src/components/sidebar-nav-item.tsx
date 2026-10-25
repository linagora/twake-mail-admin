import type { LucideIcon } from "lucide-react";
import { Link } from "react-router";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

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

interface SidebarNavGroupsProps {
  groups: { label: string; items: SidebarNavEntry[] }[];
  isActive: (url: string) => boolean;
}

/**
 * The sidebar entries, one labelled group per block, in the given order. The
 * same markup serves the desktop sidebar and the mobile "Navigation" sheet.
 */
export function SidebarNavGroups({ groups, isActive }: SidebarNavGroupsProps) {
  return (
    <>
      {groups.map((group) => (
        <SidebarGroup key={group.label}>
          <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {group.items.map((item) => (
                <SidebarNavItem key={item.url} item={item} isActive={isActive(item.url)} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </>
  );
}
