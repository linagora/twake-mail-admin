import { RESOURCE_ICONS } from "@/components/custom/resource-icon-picker";
import { Resource } from "./types";

/** Label of a resource: its name, or its ID when it has none. */
export const resourceDisplayName = (resource: Pick<Resource, "id" | "name">): string =>
  resource.name || resource.id;

export const compareResourcesByDisplayName = (a: Resource, b: Resource): number =>
  resourceDisplayName(a).localeCompare(resourceDisplayName(b));

/** Whether an icon has a matching image under /icons/resources. */
export const isKnownResourceIcon = (icon: string | null | undefined): icon is string =>
  !!icon && RESOURCE_ICONS.includes(icon);
