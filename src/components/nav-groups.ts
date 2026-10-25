import type { SidebarNavEntry } from "@/components/sidebar-nav-item";

/** A labelled block of sidebar entries, grouped by what the operator comes to do. */
export interface NavGroup {
  label: string;
  items: SidebarNavEntry[];
}

/**
 * Keeps the entries the current OIDC client may open (an entry absent from
 * `visibility` stays shown) and drops the groups left without any entry.
 */
export function visibleNavGroups(groups: NavGroup[], visibility: Record<string, boolean>): NavGroup[] {
  return groups
    .map((group) => ({ ...group, items: group.items.filter((item) => visibility[item.url] !== false) }))
    .filter((group) => group.items.length > 0);
}
