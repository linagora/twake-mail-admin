import { useState } from "react";
import { Link } from "react-router";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { deleteAllUsersData } from "../api-client";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/hooks/use-confirm";
import ErrorDisplayer from "@/components/custom/error-displayer";
import { Button } from "@/components/ui/button";
import { useIsAllowed } from "@/lib/proxy-resolver-context";

interface Props {
  domain: string;
  defaultOpen?: boolean;
}

export default function DomainTasks({ domain, defaultOpen }: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const confirm = useConfirm();
  const canDeleteData = useIsAllowed("POST", "/domains/{domain}?action=deleteData");
  const [open, setOpen] = useState(defaultOpen ?? false);
  const [deleting, setDeleting] = useState(false);

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
        description: <p><Link className="text-blue-500 hover:underline" to={`/task/${taskId}`}>{t("common.taskLink", { taskId })}</Link></p>,
      });
    } catch (err) {
      toast({
        title: t("domains.tasks.errorDeletingData"),
        description: <ErrorDisplayer error={err} />,
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="mt-6">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-md font-semibold hover:text-blue-600 transition"
      >
        {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        {t("domains.tasks.title")}
      </button>

      {open && canDeleteData && (
        <div className="mt-2 p-4 bg-gray-50 rounded-2">
          <Button
            className="bg-red-600 hover:bg-red-700 rounded-sm w-full"
            onClick={handleDeleteAllUsersData}
            disabled={deleting}
          >
            {deleting && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
            {t("domains.tasks.deleteAllData")}
          </Button>
          <p className="text-xs text-muted-foreground mt-2">
            {t("domains.tasks.deleteAllDataDesc")}
          </p>
        </div>
      )}
    </div>
  );
}
