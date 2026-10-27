import { MouseEvent, ReactNode, useId, useState } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * An explanation shown on hover, on keyboard focus and on a tap: a native `title` never
 * shows up on a touch screen, and a Radix tooltip closes on a click.
 */
// The trigger is a focusable span wrapping `children`: a disabled button inside it receives
// no pointer event, so the span gets the tap instead.
export default function HintTooltip({ hint, children, className }: {
  hint: string;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const hintId = useId();
  const toggle = (event: MouseEvent) => {
    event.preventDefault();
    setOpen((wasOpen) => !wasOpen);
  };
  return (
    <TooltipProvider>
      <Tooltip delayDuration={0} open={open} onOpenChange={setOpen}>
        <TooltipTrigger asChild onClick={toggle}>
          <span tabIndex={0} aria-describedby={hintId} className={className}>{children}</span>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">{hint}</TooltipContent>
      </Tooltip>
      {/* The tooltip only exists while shown: a hidden copy of the hint describes the trigger */}
      <span id={hintId} hidden>{hint}</span>
    </TooltipProvider>
  );
}
