import { useCallback, useId, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useFetchData } from "@/hooks/use-fetch-data";
import { getDomainAliases, addDomainAlias, removeDomainAlias } from "../api-client";
import { GetDomainAliasesResponseType } from "../types";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/hooks/use-confirm";
import ErrorDisplayer from "@/components/custom/error-displayer";
import { useIsAllowed } from "@/lib/proxy-resolver-context";
import { SectionToggle, useSectionOpen } from "@/components/custom/collapsible-section";
import FormDialog, { FIELD_CLASS } from "@/components/custom/form-dialog";

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

  const [open, setOpen, openContentId] = useSectionOpen("aliases", defaultOpen ?? false);
  const [newAlias, setNewAlias] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const fieldId = useId();

  const sorted = useMemo(() => {
    if (!aliases) return [];
    return [...aliases].sort((a, b) => a.source.localeCompare(b.source));
  }, [aliases]);

  if (!canView) return null;

  // A refusal is shown in the modal, which then stays open with the typed alias
  const handleAdd = async () => {
    const source = newAlias.trim();
    await addDomainAlias(domain, source);
    toast({ title: t("domains.aliases.added") });
    setNewAlias("");
    await refresh();
  };

  const handleRemove = async (source: string) => {
    const confirmed = await confirm({
      header: t("domains.aliases.removeTitle"),
      destructive: true,
      confirmLabel: t("common.remove"),
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
        <SectionToggle open={open} onToggle={() => setOpen(!open)} controls={openContentId}>
          {t("domains.aliases.title")}
          {aliases && (
            <span className="text-sm font-normal text-gray-500">
              ({aliases.length})
            </span>
          )}
        </SectionToggle>
        {canAdd && (
          <button
            onClick={() => { setOpen(true); setNewAlias(""); setShowCreate(true); }}
            className="p-1 rounded-md hover:bg-gray-200 transition"
            title={t("domains.aliases.addTooltip")}
          >
            <Plus className="w-4 h-4" />
          </button>
        )}
      </div>

      {open && (
        <div id={openContentId} className="mt-2">
          {isLoading && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-2">
              <div className="h-[58px] rounded-2 animate-pulse bg-gray-200" />
            </div>
          )}
          {error && <p className="text-red-500 mt-2">{t("common.errorPrefix", { message: error })}</p>}

          {aliases && (
            <div>
              {sorted.map((alias, index) => (
                <div
                  key={alias.source}
                  className="space-y-1 p-4 bg-gray-50 rounded-2 my-2 flex justify-between items-center gap-2 transition-colors hover:bg-gray-100"
                >
                  <h4 className="min-w-0 text-sm font-medium leading-none break-all">
                    <span className="text-gray-500 mr-2">{index + 1}/</span>
                    {alias.source}
                  </h4>
                  {canRemove && (
                    <button
                      onClick={() => handleRemove(alias.source)}
                      className="shrink-0 p-2 rounded-md hover:bg-gray-200"
                      title={t("domains.aliases.removeTooltip")}
                      aria-label={t("domains.aliases.removeNamed", { item: alias.source })}
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

      <FormDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title={t("domains.aliases.addTooltip")}
        submitLabel={t("common.add")}
        submitDisabled={!newAlias.trim()}
        onSubmit={handleAdd}
      >
        <div>
          <label htmlFor={fieldId} className="text-sm font-medium">{t("domains.domainName")}</label>
          <input
            id={fieldId}
            type="text"
            autoFocus
            value={newAlias}
            onChange={(e) => setNewAlias(e.target.value)}
            placeholder={t("domains.aliases.sourcePlaceholder")}
            className={FIELD_CLASS}
          />
        </div>
      </FormDialog>
    </div>
  );
}
