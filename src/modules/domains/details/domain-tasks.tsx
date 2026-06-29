import { useState } from "react";
import { Link } from "react-router";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { deleteAllUsersData, applyDomainSignatureTemplates, provisionDomainTemplates } from "../api-client";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/hooks/use-confirm";
import ErrorDisplayer from "@/components/custom/error-displayer";
import ProvisionTemplatesForm, { ProvisionTemplatesValues } from "@/components/custom/provision-templates-form";
import { Button } from "@/components/ui/button";
import { useIsAllowed } from "@/lib/proxy-resolver-context";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { appConfig } from "@/lib/config";

interface Props {
  domain: string;
  defaultOpen?: boolean;
}

export default function DomainTasks({ domain, defaultOpen }: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const confirm = useConfirm();
  const canApplySignatures = useIsAllowed("POST", "/domains/{domain}/signature-templates?action=apply");
  const canDeleteData = useIsAllowed("POST", "/domains/{domain}?action=deleteData");
  const canProvisionTemplates = useIsAllowed("POST", "/domains/{domain}/templates");

  const [open, setOpen] = useState(defaultOpen ?? false);
  const [applyLoading, setApplyLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [provisionLoading, setProvisionLoading] = useState(false);

  const showApply = appConfig.application === 'MAIL' && canApplySignatures;
  const showProvision = appConfig.application === 'MAIL' && canProvisionTemplates;
  const hasAnyTask = showApply || showProvision || canDeleteData;

  const handleApplySignatureTemplates = async () => {
    const confirmed = await confirm({
      header: t("domains.tasks.applySignaturesTitle"),
      message: t("domains.tasks.applySignaturesConfirm", { domain }),
    });
    if (!confirmed) return;

    setApplyLoading(true);
    try {
      const result = await applyDomainSignatureTemplates(domain);
      toast({
        title: t("domains.tasks.applySignaturesSuccess"),
        description: t("domains.tasks.applySignaturesResult", { applied: result.applied, skipped: result.skipped, error: result.error }),
      });
    } catch (err) {
      toast({
        title: t("domains.tasks.errorApplyingSignatures"),
        description: <ErrorDisplayer error={err} />,
      });
    } finally {
      setApplyLoading(false);
    }
  };

  const handleProvisionTemplates = async () => {
    let values: ProvisionTemplatesValues = { sourceUser: "", folderName: "", overwriteExisting: false, prune: false, usersPerSecond: "1" };

    try {
      const result = await confirm({
        header: t("domains.tasks.provisionTemplatesTitle"),
        message: (
          <ProvisionTemplatesForm showUsersPerSecond onChange={(v) => { values = v; }} />
        ),
      });
      if (!result) return;

      if (!values.sourceUser.trim()) {
        toast({ title: t("provisionTemplates.sourceUserRequired") });
        return;
      }

      setProvisionLoading(true);
      const { taskId } = await provisionDomainTemplates(domain, {
        from: values.sourceUser.trim(),
        folderName: values.folderName.trim() || undefined,
        overwriteExisting: values.overwriteExisting,
        prune: values.prune,
        usersPerSecond: values.usersPerSecond.trim() || undefined,
      });
      toast({
        title: t("common.taskStarted"),
        description: <p><Link className="text-blue-500 hover:underline" to={`/task/${taskId}`}>{t("common.taskLink", { taskId })}</Link></p>,
      });
    } catch (err) {
      toast({
        title: t("domains.tasks.errorProvisionTemplates"),
        description: <ErrorDisplayer error={err} />,
      });
    } finally {
      setProvisionLoading(false);
    }
  };

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

  if (!hasAnyTask) return null;

  return (
    <div className="mt-6">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-md font-semibold hover:text-blue-600 transition"
      >
        {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        {t("domains.tasks.title")}
      </button>

      {open && (
        <div className="mt-2 space-y-2">
          {showApply && (
            <div className="flex justify-between items-center p-4 bg-gray-50 rounded-2">
              <div>
                <p className="text-sm font-medium">{t("domains.tasks.applySignatures")}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t("domains.tasks.applySignaturesDesc")}
                </p>
              </div>
              <TooltipProvider>
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <Button
                      className="bg-orange-500 hover:bg-orange-600 rounded-sm"
                      onClick={handleApplySignatureTemplates}
                      disabled={applyLoading}
                    >
                      {applyLoading && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
                      {t("common.run")}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    curl -XPOST /domains/{domain}/signature-templates?action=apply
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          )}

          {showProvision && (
            <div className="flex justify-between items-center p-4 bg-gray-50 rounded-2">
              <div>
                <p className="text-sm font-medium">{t("domains.tasks.provisionTemplates")}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t("domains.tasks.provisionTemplatesDesc")}
                </p>
              </div>
              <TooltipProvider>
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <Button
                      className="bg-green-400 hover:bg-green-500 rounded-sm"
                      onClick={handleProvisionTemplates}
                      disabled={provisionLoading}
                    >
                      {provisionLoading && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
                      {t("common.run")}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    curl -XPOST /domains/{domain}/templates?action=provision&amp;from=&#123;sourceUser&#125;
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          )}

          {canDeleteData && (
            <div className="flex justify-between items-center p-4 bg-gray-50 rounded-2">
              <div>
                <p className="text-sm font-medium">{t("domains.tasks.deleteAllData")}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t("domains.tasks.deleteAllDataDesc")}
                </p>
              </div>
              <TooltipProvider>
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <Button
                      className="bg-red-600 hover:bg-red-700 rounded-sm"
                      onClick={handleDeleteAllUsersData}
                      disabled={deleting}
                    >
                      {deleting && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
                      {t("common.run")}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    curl -XPOST /domains/{domain}?action=deleteData
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
