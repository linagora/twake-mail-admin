import { forwardRef, ReactNode } from "react";
import { Loader2, Play, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button, ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * How much a task changes: safe ones only read or rebuild derived data, caution ones
 * modify data, destructive ones delete it. Told by an icon and a badge, not only by colour.
 */
export type TaskRisk = "safe" | "caution" | "destructive";

const ICONS = { safe: Play, caution: Play, destructive: Trash2 } as const;

// The colour code operators know (green, orange, red), in shades where white text keeps a
// contrast of at least 4.5:1: green-700 5.0, orange-700 5.2, red-600 4.8
const RISK_CLASS = {
  safe: "bg-green-700 text-white hover:bg-green-800",
  caution: "bg-orange-700 text-white hover:bg-orange-800",
  destructive: "bg-red-600 text-white hover:bg-red-700",
} as const;

interface RunTaskButtonProps extends Omit<ButtonProps, "variant"> {
  risk?: TaskRisk;
  loading?: boolean;
  label?: ReactNode;
}

export const RunTaskButton = forwardRef<HTMLButtonElement, RunTaskButtonProps>(
  ({ risk = "safe", loading, label, className, children, ...props }, ref) => {
    const { t } = useTranslation();
    const Icon = ICONS[risk];
    return (
      <Button
        ref={ref}
        className={cn("rounded-sm shrink-0", RISK_CLASS[risk], className)}
        {...props}
      >
        {loading ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Icon aria-hidden="true" />}
        {label ?? children ?? t("common.run")}
      </Button>
    );
  }
);
RunTaskButton.displayName = "RunTaskButton";

const BADGE_CLASS = {
  caution: "bg-amber-100 text-amber-800",
  destructive: "bg-red-100 text-red-800",
} as const;

export function RiskBadge({ risk, id }: { risk: TaskRisk; id?: string }) {
  const { t } = useTranslation();
  if (risk === "safe") return null;
  return (
    <span id={id} className={cn("inline-block text-xs font-medium rounded px-1.5 py-0.5 whitespace-nowrap", BADGE_CLASS[risk])}>
      {t(`tasks.risk.${risk}`)}
    </span>
  );
}
