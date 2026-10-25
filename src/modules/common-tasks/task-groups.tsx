import { ReactNode, useId, useState } from "react";
import { Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { TaskGroup, taskDescriptionKey } from "./types";
import type { TaskRisk } from "@/components/custom/run-task-button";

export interface TaskEntry {
  nameKey: string;
  group: TaskGroup;
  // Orders the rows of a group: the safe ones first, then caution, then destructive
  risk?: TaskRisk;
  node: ReactNode;
}

const RISK_ORDER: Record<TaskRisk, number> = { safe: 0, caution: 1, destructive: 2 };
const riskRank = (entry: TaskEntry) => RISK_ORDER[entry.risk ?? "safe"];

interface Props {
  entries: TaskEntry[];
  order: TaskGroup[];
}

/**
 * Common Tasks grouped by purpose, with a filter on names and descriptions. Within a group the
 * safe tasks come first, then the ones to run with care. A group whose tasks are all hidden by
 * the permissions disappears with them.
 */
export default function TaskGroups({ entries, order }: Props) {
  const { t } = useTranslation();
  const filterId = useId();
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const matches = (entry: TaskEntry) =>
    !q || `${t(entry.nameKey)} ${t(taskDescriptionKey(entry.nameKey))}`.toLowerCase().includes(q);
  const visible = entries.filter(matches);

  return (
    <div className="mt-4 space-y-6">
      <div className="relative max-w-sm">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
        <label htmlFor={filterId} className="sr-only">{t("commonTasks.filter")}</label>
        <input
          id={filterId}
          type="search"
          value={query}
          placeholder={t("commonTasks.filter")}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full border rounded-md pl-8 pr-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500"
        />
      </div>
      {visible.length === 0 && (
        <p className="text-sm text-muted-foreground">{t("commonTasks.noMatch", { q: query.trim() })}</p>
      )}
      {order.map((group) => {
        // Stable: within a risk, the rows keep their order
        const groupEntries = visible.filter((entry) => entry.group === group).sort((a, b) => riskRank(a) - riskRank(b));
        if (groupEntries.length === 0) return null;
        return (
          // Hidden when the permissions leave none of its rows
          <section key={group} className="[&:not(:has([data-task-row]))]:hidden" aria-labelledby={`${filterId}-${group}`}>
            <h2 id={`${filterId}-${group}`} className="text-lg font-semibold mb-2">{t(`commonTasks.group.${group}`)}</h2>
            <div className="grid grid-cols-1 gap-2">
              {groupEntries.map((entry) => <div key={entry.nameKey} className="contents">{entry.node}</div>)}
            </div>
          </section>
        );
      })}
    </div>
  );
}
