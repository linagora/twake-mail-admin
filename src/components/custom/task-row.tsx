import { ReactNode, useId, useRef, useState } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import DescribedTrigger from "./described-trigger";
import { RiskBadge, RunTaskButton, TaskRisk } from "./run-task-button";

type TooltipSide = "left" | "bottom";

// Widest tooltip (max-w-md), its offset to Run and its collision padding
const TOOLTIP_ROOM = 448 + 4 + 8;

/**
 * Beside Run when the command fits on its left, so that it does not cover the Run button of the
 * previous task. Below otherwise, e.g. on a phone, where the left of Run is narrower than the command.
 */
function tooltipSide(trigger: Element | null): TooltipSide {
  return trigger !== null && trigger.getBoundingClientRect().left >= TOOLTIP_ROOM ? "left" : "bottom";
}

interface TaskRowProps {
  title: ReactNode;
  description?: ReactNode;
  doc?: string;
  risk?: TaskRisk;
  // The WebAdmin call, shown in the tooltip of the Run button
  command?: ReactNode;
  onRun: () => void;
  disabled?: boolean;
  loading?: boolean;
  // Why the task cannot run on this server: Run is disabled, and its tooltip says why
  unavailable?: string;
  // Inline controls of the task, e.g. the port of a certificate reload
  children?: ReactNode;
}

/**
 * One task of a task list: Common Tasks, or the Tasks section of a user or a domain, in
 * both applications. Same layout everywhere: title, risk, description, then Run.
 * Run is named after its task ("Run Reindex") and described by the risk and the command.
 */
export default function TaskRow({ title, description, doc, risk = "safe", command, onRun, disabled, loading, unavailable, children }: TaskRowProps) {
  const id = useId();
  const triggerRef = useRef<HTMLElement>(null);
  const [side, setSide] = useState<TooltipSide>("left");
  const [buttonId, titleId, riskId, commandId] = ["run", "title", "risk", "command"].map((part) => `${id}-${part}`);
  const tooltip = unavailable ?? command;
  const describedBy = [risk !== "safe" && riskId, tooltip && commandId].filter(Boolean).join(" ") || undefined;
  const runButton = (
    <RunTaskButton
      id={buttonId}
      aria-labelledby={`${buttonId} ${titleId}`}
      aria-describedby={describedBy}
      risk={risk}
      loading={loading}
      disabled={disabled || !!unavailable}
      onClick={onRun}
    />
  );
  // A disabled button receives no pointer events: its wrapper shows the tooltip
  const button = unavailable ? <span tabIndex={0} className="inline-flex shrink-0">{runButton}</span> : runButton;
  return (
    <div data-task-row className="flex justify-between items-center gap-4 p-4 bg-gray-50 rounded-2 transition-colors hover:bg-gray-100">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="font-medium">
            <span id={titleId}>{title}</span>
            {doc && <> <a className="text-blue-500 hover:underline font-normal" href={doc} target="_blank" rel="noreferrer">(doc)</a></>}
          </p>
          <RiskBadge id={riskId} risk={risk} />
        </div>
        {description && <p className="text-sm text-muted-foreground mt-0.5">{description}</p>}
        {children && <div className="flex flex-wrap items-center gap-2 mt-2">{children}</div>}
      </div>
      {tooltip ? (
        // Not hoverable, and never above: there, the command would cover the Run button of the previous task
        <TooltipProvider>
          <Tooltip delayDuration={0} disableHoverableContent onOpenChange={(open) => open && setSide(tooltipSide(triggerRef.current))}>
            <TooltipTrigger asChild>
              <DescribedTrigger ref={triggerRef} description={describedBy}>{button}</DescribedTrigger>
            </TooltipTrigger>
            <TooltipContent side={side} collisionPadding={8} className="max-w-[min(28rem,calc(100vw-1rem))] break-all">{tooltip}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : button}
      {/* The tooltip only exists while shown: a hidden copy of the command describes Run, and DescribedTrigger
          keeps the shown tooltip out of its description */}
      {tooltip && <span id={commandId} hidden>{tooltip}</span>}
    </div>
  );
}
