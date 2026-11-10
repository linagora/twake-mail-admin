import { forwardRef, HTMLAttributes, ReactElement } from "react";
import { Slot } from "@radix-ui/react-slot";

interface DescribedTriggerProps extends HTMLAttributes<HTMLElement> {
  // The ids describing the trigger, whether its tooltip is shown or not
  description?: string;
  children: ReactElement;
}

/**
 * The child of a `TooltipTrigger asChild`, described by `description` only.
 * While its tooltip is shown, Radix appends the tooltip to the description of its trigger:
 * when `description` already holds a hidden copy of the tooltip, it would be read twice.
 */
const DescribedTrigger = forwardRef<HTMLElement, DescribedTriggerProps>(
  ({ description, ...props }, ref) => <Slot ref={ref} {...props} aria-describedby={description} />
);
DescribedTrigger.displayName = "DescribedTrigger";

export default DescribedTrigger;
