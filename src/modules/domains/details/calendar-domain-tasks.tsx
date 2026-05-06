import { useState } from "react";
import { Link } from "react-router";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { deleteAllUsersData, syncDomainMembers } from "../api-client";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/hooks/use-confirm";
import ErrorDisplayer from "@/components/custom/error-displayer";
import { Button } from "@/components/ui/button";
import { useIsAllowed } from "@/lib/proxy-resolver-context";
import { useTranslation } from "react-i18next";

interface Props {
  domain: string;
  defaultOpen?: boolean;
}

export default function CalendarDomainTasks({ domain, defaultOpen = false }: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const confirm = useConfirm();
  const canDeleteData = useIsAllowed("POST", "/domains/{domain}?action=deleteData");
  const canSyncMembers = useIsAllowed("POST", "/addressbook/domain-members/{domain}");
  const [open, setOpen] = useState(defaultOpen);
  const [deleting, setDeleting] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const handleDeleteAllUsersData = async () => {
    const confirmed = await confirm({
      header: t("domains.tasks.deleteAllDataTitle"),
      message: t("domains.tasks.deleteAllDataConfirm", { domain }),
    });
    if (!confirmed) return;

    setDeleting(true);
    try {
      const { taskId } = await deleteAllUsersData(domain);
      toast({
        title: t("common.taskStarted"),
        description: <p>{t("domains.calendarTasks.taskLabel")} <Link className="text-blue-500 hover:underline" to={`/task/${taskId}`}>{taskId}</Link></p>,
      });
    } catch (err) {
      toast({ title: t("domains.tasks.errorDeletingData"), description: <ErrorDisplayer error={err} /> });
    } finally {
      setDeleting(false);
    }
  };

  const handleSyncDomainMembers = async () => {
    const confirmed = await confirm({
      header: t("domains.calendarTasks.syncTitle"),
      message: t("domains.calendarTasks.syncConfirm", { domain }),
    });
    if (!confirmed) return;

    setSyncing(true);
    try {
      const { taskId } = await syncDomainMembers(domain);
      toast({
        title: t("common.taskStarted"),
        description: <p>{t("domains.calendarTasks.taskLabel")} <Link className="text-blue-500 hover:underline" to={`/task/${taskId}`}>{taskId}</Link></p>,
      });
    } catch (err) {
      toast({ title: t("domains.calendarTasks.errorSyncing"), description: <ErrorDisplayer error={err} /> });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="mt-6">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-md font-semibold hover:text-blue-600 transition"
      >
        {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        {t("domains.calendarTasks.title")}
      </button>

      {open && (canSyncMembers || canDeleteData) && (
        <div className="mt-2 p-4 bg-gray-50 rounded-2 space-y-4">
          {canSyncMembers && (
            <>
              <Button
                className="bg-green-400 hover:bg-green-500 rounded-sm w-full"
                onClick={handleSyncDomainMembers}
                disabled={syncing}
              >
                {syncing && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
                {t("domains.calendarTasks.syncButton")}
              </Button>
              <p className="text-xs text-muted-foreground">
                {t("domains.calendarTasks.syncDesc")}
              </p>
            </>
          )}
          {canDeleteData && (
            <>
              <Button
                className="bg-red-600 hover:bg-red-700 rounded-sm w-full"
                onClick={handleDeleteAllUsersData}
                disabled={deleting}
              >
                {deleting && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
                {t("domains.tasks.deleteAllData")}
              </Button>
              <p className="text-xs text-muted-foreground">
                {t("domains.tasks.deleteAllDataDesc")}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
