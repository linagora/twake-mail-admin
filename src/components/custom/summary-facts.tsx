import { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useRevealSection } from "./collapsible-section";

/** A chip of the summary under a detail page's title: it opens its section and scrolls to it. */
export function Fact({ section, children }: { section: string; children: ReactNode }) {
  const reveal = useRevealSection();
  return (
    <button
      type="button"
      onClick={() => reveal(section)}
      className="text-left text-sm px-3 py-1.5 rounded-md border bg-white hover:bg-gray-50 hover:border-blue-400 transition"
    >
      {children}
    </button>
  );
}

export const Strip = ({ children }: { children: ReactNode }) => (
  <div className="mt-3 flex flex-wrap items-center gap-2">{children}</div>
);

const countOf = (value: unknown) => (typeof value === "number" ? value : undefined);

/** A fact read from the section of the page that counted it, once it did. */
export function CountFact({ section, count, labelKey }: { section: string; count: unknown; labelKey: string }) {
  const { t } = useTranslation();
  const value = countOf(count);
  return value === undefined ? null : <Fact section={section}>{t(labelKey, { count: value })}</Fact>;
}
