import { useCallback, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useFetchData } from "@/hooks/use-fetch-data";
import { getDomainAliases, addDomainAlias, removeDomainAlias } from "../api-client";
import { GetDomainAliasesResponseType } from "../types";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/hooks/use-confirm";
import ErrorDisplayer from "@/components/custom/error-displayer";
import { useIsAllowed } from "@/lib/proxy-resolver-context";

interface Props {
  domain: string;
  defaultOpen?: boolean;
}

export default function DomainAliases({ domain, defaultOpen }: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const confirm = useConfirm();
  const canView = useIsAllowed("GET", "/domains/{domain}/aliases");
  const canAdd = useIsAllowed("PUT", "/domains/{domain}/aliases/{source}");
  const canRemove = useIsAllowed("DELETE", "/domains/{domain}/aliases/{source}");

  const fetchAliases = useCallback(() => getDomainAliases(domain), [domain]);
  const {
    data: aliases,
    isLoading,
    error,
    refresh,
  } = useFetchData<GetDomainAliasesResponseType>(canView ? fetchAliases : null);

  const [open, setOpen] = useState(defaultOpen ?? false);
  const [newAlias, setNewAlias] = useState("");
  const [showCreateInput, setShowCreateInput] = useState(false);

  const sorted = useMemo(() => {
    if (!aliases) return [];
    return [...aliases].sort((a, b) => a.source.localeCompare(b.source));
  }, [aliases]);

  if (!canView) return null;

  const handleAdd = async () => {
    const source = newAlias.trim();
    if (!source) return;
    try {
      await addDomainAlias(domain, source);
      toast({ title: t("domains.aliases.added") });
      setNewAlias("");
      setShowCreateInput(false);
      await refresh();
    } catch (err) {
      toast({
        title: t("domains.aliases.errorAdding"),
        description: <ErrorDisplayer error={err} />,
      });
    }
  };

  const handleRemove = async (source: string) => {
    const confirmed = await confirm({
      header: t("domains.aliases.removeTitle"),
      message: t("domains.aliases.removeConfirm", { source, domain }),
    });
    if (!confirmed) return;
    try {
      await removeDomainAlias(domain, source);
      toast({ title: t("domains.aliases.removed") });
      await refresh();
    } catch (err) {
      toast({
        title: t("domains.aliases.errorRemoving"),
        description: <ErrorDisplayer error={err} />,
      });
    }
  };

  return (
    <div className="mt-6">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-2 text-md font-semibold hover:text-blue-600 transition"
        >
          {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          {t("domains.aliases.title")}
          {aliases && (
            <span className="text-sm font-normal text-gray-500">
              ({aliases.length})
            </span>
          )}
        </button>
        {open && canAdd && (
          <button
            onClick={() => setShowCreateInput(!showCreateInput)}
            className="p-1 rounded-md hover:bg-gray-200 transition"
            title={t("domains.aliases.addTooltip")}
          >
            <Plus className="w-4 h-4" />
          </button>
        )}
      </div>

      {open && (
        <div className="mt-2">
          {showCreateInput && (
            <div className="flex gap-2 mt-2 mb-2">
              <input
                type="text"
                value={newAlias}
                onChange={(e) => setNewAlias(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                placeholder={t("domains.aliases.sourcePlaceholder")}
                className="flex-1 px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleAdd}
                disabled={!newAlias.trim()}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t("common.add")}
              </button>
            </div>
          )}

          {isLoading && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-2">
              <div className="h-[58px] rounded-2 animate-pulse bg-gray-200" />
            </div>
          )}
          {error && <p className="text-red-500 mt-2">Error: {error}</p>}

          {aliases && (
            <div>
              {sorted.map((alias, index) => (
                <div
                  key={alias.source}
                  className="space-y-1 p-4 bg-gray-50 rounded-2 my-2 flex justify-between items-center"
                >
                  <h4 className="text-sm font-medium leading-none">
                    <span className="text-gray-500 mr-2">{index + 1}/</span>
                    {alias.source}
                  </h4>
                  {canRemove && (
                    <button
                      onClick={() => handleRemove(alias.source)}
                      className="p-2 rounded-md hover:bg-gray-200"
                      title={t("domains.aliases.removeTooltip")}
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </button>
                  )}
                </div>
              ))}
              {aliases.length === 0 && (
                <p className="mt-2 text-sm text-gray-500">{t("domains.aliases.empty")}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
