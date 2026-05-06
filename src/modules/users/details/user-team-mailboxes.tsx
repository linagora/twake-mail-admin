import { useCallback, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, LogOut } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useIsAllowed } from "@/lib/proxy-resolver-context";
import { useFetchData } from "@/hooks/use-fetch-data";
import { getUserTeamMailboxes } from "../api-client";
import { removeTeamMailboxMember } from "@/modules/domains/api-client";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/hooks/use-confirm";
import ErrorDisplayer from "@/components/custom/error-displayer";

interface Props {
  username: string;
}

export default function UserTeamMailboxes({ username }: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const confirm = useConfirm();
  const canView = useIsAllowed("GET", "/users/{username}/team-mailboxes");
  const canLeave = useIsAllowed("DELETE", "/domains/{domain}/team-mailboxes/{mailbox}/members/{member}");

  const fetchMailboxes = useCallback(() => getUserTeamMailboxes(username), [username]);
  const {
    data: mailboxes,
    isLoading,
    error,
    refresh,
  } = useFetchData<{ name: string; emailAddress: string }[]>(canView ? fetchMailboxes : null);

  const [open, setOpen] = useState(false);

  const sorted = useMemo(() => {
    if (!mailboxes) return [];
    return [...mailboxes].sort((a, b) => a.name.localeCompare(b.name));
  }, [mailboxes]);

  if (!canView) return null;

  const handleLeave = async (mb: { name: string; emailAddress: string }) => {
    const domain = mb.emailAddress.split("@")[1];
    const confirmed = await confirm({
      header: t("users.teamMailboxes.leaveTitle"),
      message: t("users.teamMailboxes.leaveConfirm", { username, emailAddress: mb.emailAddress }),
    });
    if (!confirmed) return;
    try {
      await removeTeamMailboxMember(domain, mb.name, username);
      toast({ title: t("users.teamMailboxes.left", { emailAddress: mb.emailAddress }) });
      await refresh();
    } catch (err) {
      toast({
        title: t("users.teamMailboxes.errorLeaving"),
        description: <ErrorDisplayer error={err} />,
      });
    }
  };

  return (
    <div className="mt-6">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-md font-semibold hover:text-blue-600 transition"
      >
        {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        {t("users.teamMailboxes.title")}
        {mailboxes && (
          <span className="text-sm font-normal text-gray-500">
            ({mailboxes.length})
          </span>
        )}
      </button>

      {open && (
        <div className="mt-2">
          {isLoading && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-2">
              <div className="h-[58px] rounded-2 animate-pulse bg-gray-200" />
            </div>
          )}
          {error && <p className="text-red-500 mt-2">Error: {error}</p>}

          {mailboxes && (
            <div>
              {sorted.map((mb, index) => (
                <div
                  key={mb.emailAddress}
                  className="space-y-1 p-4 bg-gray-50 rounded-2 my-2 flex justify-between items-center"
                >
                  <h4 className="text-sm font-medium leading-none">
                    <span className="text-gray-500 mr-2">{index + 1}/</span>
                    {mb.emailAddress}
                  </h4>
                  {canLeave && (
                    <button
                      onClick={() => handleLeave(mb)}
                      className="flex items-center gap-1 px-2 py-1 text-sm text-red-600 rounded-md hover:bg-gray-200"
                      title="Leave team mailbox"
                    >
                      <LogOut className="w-4 h-4" />
                      {t("users.teamMailboxes.leave")}
                    </button>
                  )}
                </div>
              ))}
              {mailboxes.length === 0 && (
                <p className="mt-2 text-sm text-gray-500">{t("users.teamMailboxes.empty")}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
