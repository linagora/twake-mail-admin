import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Trash2 } from "lucide-react";
import { useIsAllowed } from "@/lib/proxy-resolver-context";
import { useFetchData } from "@/hooks/use-fetch-data";
import { useUserMappingsRevision } from "./user-mappings-revision";
import { getUserAliases, addUserAlias, removeUserAlias } from "../api-client";
import { GetUserAliasesResponseType } from "../types";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/hooks/use-confirm";
import ErrorDisplayer from "@/components/custom/error-displayer";
import { SectionToggle, useSectionFact, useSectionOpen } from "@/components/custom/collapsible-section";
import FormDialog, { FIELD_CLASS } from "@/components/custom/form-dialog";
import { SourceLine, useSourceCheck } from "@/components/custom/address-checks";

interface Props {
  username: string;
}

export default function UserAliases({ username }: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const confirm = useConfirm();
  const canView = useIsAllowed("GET", "/address/aliases/{username}");
  const canAdd = useIsAllowed("PUT", "/address/aliases/{username}/sources/{source}");
  const canRemove = useIsAllowed("DELETE", "/address/aliases/{username}/sources/{source}");

  const { revision, notifyMappingsChanged } = useUserMappingsRevision();
  const fetchAliases = useCallback(() => getUserAliases(username), [username]);
  const {
    data: aliases,
    isLoading,
    error,
  } = useFetchData<GetUserAliasesResponseType>(canView ? fetchAliases : null, revision);

  const [open, setOpen, openContentId] = useSectionOpen("aliases");
  useSectionFact("aliases", aliases?.length);
  const [newAlias, setNewAlias] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const aliasCheck = useSourceCheck(newAlias);

  const sorted = useMemo(() => {
    if (!aliases) return [];
    return [...aliases].sort((a, b) => a.source.localeCompare(b.source));
  }, [aliases]);

  if (!canView) return null;

  // A refusal throws: the modal shows it and keeps the typed alias
  const handleAdd = async () => {
    await addUserAlias(username, newAlias.trim());
    toast({ title: t("users.aliases.added") });
    setNewAlias("");
    notifyMappingsChanged();
  };

  const handleRemove = async (alias: string) => {
    const confirmed = await confirm({
      header: t("users.aliases.removeTitle"),
      destructive: true,
      confirmLabel: t("common.remove"),
      message: t("users.aliases.removeConfirm", { alias, username }),
    });
    if (!confirmed) return;
    try {
      await removeUserAlias(username, alias);
      toast({ title: t("users.aliases.removed") });
      notifyMappingsChanged();
    } catch (err) {
      toast({
        title: t("users.aliases.errorRemoving"),
        description: <ErrorDisplayer error={err} />,
      });
    }
  };

  return (
    <div className="mt-6">
      <div className="flex items-center gap-2">
        <SectionToggle open={open} onToggle={() => setOpen(!open)} controls={openContentId}>
          {t("users.aliases.title")}
          {aliases && (
            <span className="text-sm font-normal text-gray-500">
              ({aliases.length})
            </span>
          )}
        </SectionToggle>
        {canAdd && (
          <button
            type="button"
            onClick={() => { setOpen(true); setNewAlias(""); setShowAddDialog(true); }}
            className="p-1 rounded-md hover:bg-gray-200 transition"
            title={t("users.aliases.addTooltip")}
          >
            <Plus className="w-4 h-4" />
          </button>
        )}
      </div>

      <FormDialog
        open={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        title={t("users.aliases.addTooltip")}
        submitLabel={t("common.add")}
        submitDisabled={!newAlias.trim() || aliasCheck.blocking}
        onSubmit={handleAdd}
      >
        <div>
          <label htmlFor="add-alias-address" className="text-sm font-medium">{t("users.aliases.fieldLabel")}</label>
          <input
            type="text"
            autoFocus
            value={newAlias}
            onChange={(e) => setNewAlias(e.target.value)}
            id="add-alias-address"
            placeholder={t("users.aliases.placeholder")}
            className={FIELD_CLASS}
          />
          <SourceLine source={newAlias} destination={username} status={aliasCheck.status} />
        </div>
      </FormDialog>

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
                      title={t("users.aliases.removeTooltip")}
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </button>
                  )}
                </div>
              ))}
              {aliases.length === 0 && (
                <p className="mt-2 text-sm text-gray-500">{t("users.aliases.empty")}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
