import { HealthStatuses } from "./types";

// Light tint with a dark text of the same hue: every pair stays well above
// the 4.5:1 WCAG AA contrast ratio, the coloured border keeps the status visible.
const STATUS_STYLES: Record<HealthStatuses, string> = {
  [HealthStatuses.HEALTHY]: "bg-green-100 text-green-900 border-green-600",
  [HealthStatuses.DEGRADED]: "bg-orange-100 text-orange-900 border-orange-400",
  [HealthStatuses.UNHEALTHY]: "bg-red-100 text-red-900 border-red-600",
};

export const statusStyle = (status: HealthStatuses) => STATUS_STYLES[status];
