import { useCallback } from "react";
import { useParams } from "react-router";
import { useIsAllowed } from "@/lib/proxy-resolver-context";
import { useFetchData } from "@/hooks/use-fetch-data";
import { getTeamMailboxFolderSubaddressing, setTeamMailboxFolderSubaddressing } from "../api-client";
import { useToast } from "@/hooks/use-toast";
import ErrorDisplayer from "@/components/custom/error-displayer";
import TeamMailboxFolderExtraAcl from "./team-mailbox-folder-extra-acl";

export default function TeamMailboxFolderDetail() {
  const { domain, mailbox, folder } = useParams();
  const { toast } = useToast();
  const canToggleSubaddressing = useIsAllowed("PUT", "/domains/{domain}/team-mailboxes/{mailbox}/mailboxes/{folderName}/subaddressing");

  const fetchSubaddressing = useCallback(
    () => getTeamMailboxFolderSubaddressing(domain!, mailbox!, folder!),
    [domain, mailbox, folder]
  );
  const { data, isLoading, error, refresh } = useFetchData<{ enabled: boolean }>(fetchSubaddressing);

  const handleToggle = async () => {
    if (data === undefined || data === null) return;
    const next = !data.enabled;
    try {
      await setTeamMailboxFolderSubaddressing(domain!, mailbox!, folder!, next);
      toast({ title: next ? "Sub-addressing enabled" : "Sub-addressing disabled" });
      await refresh();
    } catch (err) {
      toast({
        title: "Error updating sub-addressing",
        description: <ErrorDisplayer error={err} />,
      });
    }
  };

  return (
    <div className="mt-4 p-4 bg-white rounded-2">
      <h3 className="text-lg font-semibold">Team Mailbox Folder</h3>
      <p className="text-gray-500 text-sm">{folder} — {mailbox}@{domain}</p>

      <div className="mt-6">
        {isLoading && (
          <div className="h-16 w-full rounded-2 animate-pulse bg-gray-200" />
        )}
        {error && <p className="text-red-500 mt-2">Error: {error}</p>}

        {data !== undefined && data !== null && !isLoading && (
          <button
            onClick={canToggleSubaddressing ? handleToggle : undefined}
            style={!canToggleSubaddressing ? { cursor: 'default', opacity: 0.6 } : undefined}
            className={`w-full flex items-center justify-between px-6 py-4 rounded-2 border-2 transition-colors ${
              data.enabled
                ? "bg-blue-50 border-blue-400 hover:bg-blue-100"
                : "bg-gray-50 border-gray-300 hover:bg-gray-100"
            }`}
          >
            <div className="text-left">
              <p className="text-base font-semibold">Sub-addressing</p>
              <p className="text-sm text-gray-500 mt-0.5">
                {data.enabled
                  ? `Emails to ${mailbox}+${folder}@${domain} are delivered to this folder`
                  : "Sub-addressing delivery to this folder is disabled"}
              </p>
            </div>
            <div
              className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors ${
                data.enabled ? "bg-blue-500" : "bg-gray-300"
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                  data.enabled ? "translate-x-8" : "translate-x-1"
                }`}
              />
            </div>
          </button>
        )}
      </div>
      <TeamMailboxFolderExtraAcl domain={domain!} mailbox={mailbox!} folder={folder!} />
    </div>
  );
}
