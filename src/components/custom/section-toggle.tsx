import { ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

interface SectionToggleProps {
  open: boolean;
  onToggle: () => void;
  // Id of the content, rendered while open; while closed, an empty hidden element holds it
  controls?: string;
  children: ReactNode;
}

/** The title button of a section: chevron, title and count, with its disclosure state exposed. */
export default function SectionToggle({ open, onToggle, controls, children }: SectionToggleProps) {
  const Chevron = open ? ChevronDown : ChevronRight;
  return (
    <>
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-controls={controls}
      // Revealed from the summary strip: its title stays clear of the sticky header of the page,
      // which sits under the 48 px menu bar on a phone
      className="flex items-center gap-2 text-md font-semibold text-left hover:text-blue-600 transition scroll-mt-28 md:scroll-mt-16"
    >
      <Chevron className="w-4 h-4 shrink-0" aria-hidden="true" />
      {children}
    </button>
    {/* The content is mounted only once opened, so that a closed section fetches nothing */}
    {!open && controls && <div id={controls} hidden />}
    </>
  );
}
