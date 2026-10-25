import { ChevronFirst, ChevronLast, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReactNode } from "react";
import { useTranslation } from "react-i18next";

interface PaginationControlsProps {
  onFirst: () => void;
  onPrev: () => void;
  onNext: () => void;
  onLast?: () => void;
  disabledPrev: boolean;
  disabledNext: boolean;
  label: ReactNode;
  // Number of items, shown alone when everything fits on one page
  total?: number;
  // Shown at the right end of the total line, e.g. an action on the listed items
  actions?: ReactNode;
}

export function PaginationControls({
  onFirst, onPrev, onNext, onLast,
  disabledPrev, disabledNext, label, total, actions,
}: PaginationControlsProps) {
  const { t } = useTranslation();
  // Nothing to page through: no controls above the content, only what the list holds
  if (disabledPrev && disabledNext) {
    const summary = (
      <p className={actions ? "text-sm text-muted-foreground" : "mt-6 text-sm text-muted-foreground"}>
        {total !== undefined ? t("common.totalOnly", { count: total }) : label}
      </p>
    );
    if (!actions) return summary;
    return (
      <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
        {summary}
        {actions}
      </div>
    );
  }
  const controls = (
    <div className={actions ? "flex flex-wrap items-center justify-between gap-4" : "mt-6 flex flex-wrap items-center justify-between gap-4"}>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={onFirst} disabled={disabledPrev}>
          <ChevronFirst className="w-4 h-4" />
          {t("common.first")}
        </Button>
        <Button variant="outline" size="sm" onClick={onPrev} disabled={disabledPrev}>
          <ChevronLeft className="w-4 h-4" />
          {t("common.previous")}
        </Button>
      </div>
      <span className="text-sm text-muted-foreground font-medium">{label}</span>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={onNext} disabled={disabledNext}>
          {t("common.next")}
          <ChevronRight className="w-4 h-4" />
        </Button>
        {onLast && (
          <Button variant="outline" size="sm" onClick={onLast} disabled={disabledNext}>
            {t("common.last")}
            <ChevronLast className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
  if (!actions) return controls;
  // Several pages: the action goes on its own line under the controls, at the right
  return (
    <div className="mt-6 flex flex-col gap-2">
      {controls}
      <div className="flex justify-end">{actions}</div>
    </div>
  );
}
