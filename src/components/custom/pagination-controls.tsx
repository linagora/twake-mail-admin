import { ChevronFirst, ChevronLast, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReactNode } from "react";

interface PaginationControlsProps {
  onFirst: () => void;
  onPrev: () => void;
  onNext: () => void;
  onLast?: () => void;
  disabledPrev: boolean;
  disabledNext: boolean;
  label: ReactNode;
}

export function PaginationControls({
  onFirst, onPrev, onNext, onLast,
  disabledPrev, disabledNext, label,
}: PaginationControlsProps) {
  return (
    <div className="mt-6 flex items-center justify-between gap-4">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onFirst} disabled={disabledPrev}>
          <ChevronFirst className="w-4 h-4" />
          First
        </Button>
        <Button variant="outline" size="sm" onClick={onPrev} disabled={disabledPrev}>
          <ChevronLeft className="w-4 h-4" />
          Previous
        </Button>
      </div>
      <span className="text-sm text-muted-foreground font-medium">{label}</span>
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={onNext} disabled={disabledNext}>
          Next
          <ChevronRight className="w-4 h-4" />
        </Button>
        {onLast && (
          <Button size="sm" onClick={onLast} disabled={disabledNext}>
            Last
            <ChevronLast className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
