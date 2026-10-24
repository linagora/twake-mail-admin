import { Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export interface ShareeSummary {
  label: string;
  // Their right or role; empty when the chip only lists people, e.g. administrators
  right: string;
}

const LISTED = 5;

const CHIP_CLASS = "inline-flex items-center gap-1 text-xs rounded bg-blue-50 text-blue-700 px-1.5 py-0.5";

/**
 * Who a calendar or an address book is shared with, on its row: "Shared with 2", listing
 * the sharees on hover or focus, and opening the sharing dialog when clicked.
 */
// Without the right to change the sharing, the chip only lists the sharees. `text` replaces
// "Shared with n" (e.g. "2 members"), and `href` makes the chip a link instead of a button.
export default function SharedWithChip({ sharees, onOpen, href, text }: {
  sharees: ShareeSummary[];
  onOpen?: () => void;
  href?: string;
  text?: string;
}) {
  const { t } = useTranslation();
  if (sharees.length === 0) return null;
  const hidden = sharees.length - LISTED;
  const content = (
    <>
      <Users className="w-3 h-3" aria-hidden="true" />
      {text ?? t("common.sharedWith", { count: sharees.length })}
    </>
  );
  return (
    <TooltipProvider>
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>
          {href ? (
            <a href={href} className={`${CHIP_CLASS} hover:bg-blue-100`}>{content}</a>
          ) : onOpen ? (
            <button type="button" onClick={onOpen} className={`${CHIP_CLASS} hover:bg-blue-100`}>{content}</button>
          ) : (
            <span tabIndex={0} className={CHIP_CLASS}>{content}</span>
          )}
        </TooltipTrigger>
        <TooltipContent>
          <ul className="text-xs space-y-0.5">
            {sharees.slice(0, LISTED).map((sharee) => (
              <li key={sharee.label}>{sharee.right ? `${sharee.label} — ${sharee.right}` : sharee.label}</li>
            ))}
            {hidden > 0 && <li>{t("common.andMore", { count: hidden })}</li>}
          </ul>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
