import { ReactNode } from "react";

/** A list of objects, one short row each: many fit on a screen and screen readers read a list. */
export function CompactList({ children }: { children: ReactNode }) {
  return <ul className="mt-2 bg-white rounded-2">{children}</ul>;
}

/** A row of a CompactList: its number in a fixed column, then the object and its actions. */
export function CompactRow({ number, children }: { number: number; children: ReactNode }) {
  return (
    <li className="flex items-center gap-3 px-3 py-2 border-b last:border-b-0 text-sm transition-colors hover:bg-gray-50">
      {/* On the first line of the object, should it wrap */}
      <span className="w-10 shrink-0 self-start text-right text-gray-500 tabular-nums">{number}.</span>
      {children}
    </li>
  );
}
