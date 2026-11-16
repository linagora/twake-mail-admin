import { ReactNode, useId } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import DescribedTrigger from "./described-trigger";
import { RiskBadge, RunTaskButton, TaskRisk } from "./run-task-button";

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
        // On the side and not hoverable: above, the command would cover the Run button of the previous task
        <TooltipProvider>
          <Tooltip delayDuration={0} disableHoverableContent>
            <TooltipTrigger asChild>
              <DescribedTrigger description={describedBy}>{button}</DescribedTrigger>
            </TooltipTrigger>
            <TooltipContent side="left" className="max-w-md break-all">{tooltip}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : button}
      {/* The tooltip only exists while shown: a hidden copy of the command describes Run, and DescribedTrigger
          keeps the shown tooltip out of its description */}
      {tooltip && <span id={commandId} hidden>{tooltip}</span>}
    </div>
  );
}
