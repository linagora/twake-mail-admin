import { useCallback, useId, useRef } from "react";
import { useParams } from "react-router";
import { useTranslation } from "react-i18next";
import { useIsAllowed } from "@/lib/proxy-resolver-context";
import { useFetchData } from "@/hooks/use-fetch-data";
import { getTeamMailboxFolderSubaddressing, setTeamMailboxFolderSubaddressing } from "../api-client";
import { useToast } from "@/hooks/use-toast";
import ErrorDisplayer from "@/components/custom/error-displayer";
import TeamMailboxFolderExtraAcl from "./team-mailbox-folder-extra-acl";
import Header from "@/components/custom/header";
import { useBreadcrumbs } from "@/hooks/use-breadcrumbs";
import { ExpandCollapseAll, SectionsProvider } from "@/components/custom/collapsible-section";

export default function TeamMailboxFolderDetail() {
  const { t } = useTranslation();
  const { domain, mailbox, folder } = useParams();
  const breadcrumbs = useBreadcrumbs();
  const { toast } = useToast();
  const idPrefix = useId();
  const canToggleSubaddressing = useIsAllowed("PUT", "/domains/{domain}/team-mailboxes/{mailbox}/mailboxes/{folderName}/subaddressing");

  const fetchSubaddressing = useCallback(
    () => getTeamMailboxFolderSubaddressing(domain!, mailbox!, folder!),
    [domain, mailbox, folder]
  );
  const { data, isLoading, error, refreshSilently } = useFetchData<{ enabled: boolean }>(fetchSubaddressing);
  // A second press while a change is being saved would send the same value again
  const isSaving = useRef(false);

  // The switch is reloaded silently: it stays mounted, so it keeps the keyboard focus after a change
  const handleToggle = async () => {
    if (data === undefined || data === null || isSaving.current) return;
    const next = !data.enabled;
    isSaving.current = true;
    try {
      await setTeamMailboxFolderSubaddressing(domain!, mailbox!, folder!, next);
      toast({ title: next ? t("domains.folders.subaddressingEnabled") : t("domains.folders.subaddressingDisabled") });
      await refreshSilently();
    } catch (err) {
      toast({
        title: t("domains.folders.errorSubaddressing"),
        description: <ErrorDisplayer error={err} />,
      });
    } finally {
      isSaving.current = false;
    }
  };

  return (
    <SectionsProvider page="teamMailboxFolder">
    <Header headerTitle={folder} headerSubTitle={t("domains.folders.detailKind")} breadcrumb={breadcrumbs.teamMailbox(domain!, mailbox!)} actions={<ExpandCollapseAll />} />
    <div className="mt-4 p-4 bg-white rounded-2">

      <div className="mt-6">
        {isLoading && (
          <div className="h-16 w-full rounded-2 animate-pulse bg-gray-200" />
        )}
        {error && <p className="text-red-500 mt-2">{t("common.errorPrefix", { message: error })}</p>}

        {data !== undefined && data !== null && !isLoading && (
          <button
            type="button"
            role="switch"
            aria-checked={data.enabled}
            aria-labelledby={`${idPrefix}-label`}
            aria-describedby={`${idPrefix}-description`}
            disabled={!canToggleSubaddressing}
            onClick={handleToggle}
            style={!canToggleSubaddressing ? { cursor: 'default', opacity: 0.6 } : undefined}
            className={`w-full flex items-center justify-between px-6 py-4 rounded-2 border-2 transition-colors ${
              data.enabled
                ? "bg-blue-50 border-blue-400 hover:bg-blue-100"
                : "bg-gray-50 border-gray-300 hover:bg-gray-100"
            }`}
          >
            <div className="text-left">
              <p id={`${idPrefix}-label`} className="text-base font-semibold">{t("domains.folders.subaddressing")}</p>
              <p id={`${idPrefix}-description`} className="text-sm text-gray-500 mt-0.5">
                {data.enabled
                  ? t("domains.folders.subaddressingEnabledDesc", { mailbox, folder, domain })
                  : t("domains.folders.subaddressingDisabledDesc")}
              </p>
            </div>
            <div
              className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors ${
                data.enabled ? "bg-blue-500" : "bg-gray-300"
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
                  data.enabled ? "translate-x-8" : "translate-x-1"
                }`}
              />
            </div>
          </button>
        )}
      </div>
      <TeamMailboxFolderExtraAcl domain={domain!} mailbox={mailbox!} folder={folder!} />
    </div>
    </SectionsProvider>
  );
}
