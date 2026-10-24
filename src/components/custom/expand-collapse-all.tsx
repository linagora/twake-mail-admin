import { useContext } from "react";
import { useTranslation } from "react-i18next";
import { ChevronsDownUp, ChevronsUpDown } from "lucide-react";
import { SectionIdsContext } from "./section-contexts";
import { useWriteSection } from "./use-write-section";

const ALL_ACTIONS = [
  { open: true, labelKey: "common.expandAll", Icon: ChevronsUpDown },
  { open: false, labelKey: "common.collapseAll", Icon: ChevronsDownUp },
];

/** "Expand all" / "Collapse all" for the sections of the enclosing SectionsProvider. */
export default function ExpandCollapseAll() {
  const { t } = useTranslation();
  const writeSection = useWriteSection();
  const sections = useContext(SectionIdsContext);
  // A page without sections (e.g. an unregistered user) has nothing to expand
  if (!sections || sections.current.size === 0) return null;
  return (
    <div className="flex gap-3 text-sm">
      {ALL_ACTIONS.map(({ open, labelKey, Icon }) => (
        <button key={labelKey} type="button" className="inline-flex items-center text-blue-600 hover:underline" title={t(labelKey)}
          onClick={() => sections.current.forEach((_, id) => writeSection(id, open))}>
          {/* Only where the room is short, e.g. the sticky bar on a phone: see Header */}
          <Icon data-compact-icon className="hidden w-5 h-5" aria-hidden="true" />
          <span data-action-label>{t(labelKey)}</span>
        </button>
      ))}
    </div>
  );
}
