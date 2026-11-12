import { useState } from "react";
import { useTranslation } from "react-i18next";
import TaskRow from "@/components/custom/task-row";
import { deleteAllUsersData, applyDomainSignatureTemplates, provisionDomainTemplates } from "../api-client";
import { useToast } from "@/hooks/use-toast";
import { useTaskCreatedToast } from "@/hooks/use-task-created-toast";
import { useConfirm } from "@/hooks/use-confirm";
import ErrorDisplayer from "@/components/custom/error-displayer";
import ProvisionTemplatesForm, { ProvisionTemplatesValues } from "@/components/custom/provision-templates-form";
import { provisionSourceError } from "@/components/custom/provision-source";
import { useIsAllowed } from "@/lib/proxy-resolver-context";
import { appConfig } from "@/lib/config";
import ConfirmTaskContent from "@/modules/common-tasks/components/confirm-task-content";
import FormTaskContent from "@/modules/common-tasks/components/form-task-content";
import { deleteAllUsersDataCommand, provisionDomainTemplatesCommand } from "./domain-task-commands";
import { SectionToggle, useSectionOpen } from "@/components/custom/collapsible-section";
import { taskTypeLabel } from "@/modules/tasks/task-summary";

const INITIAL_PROVISION_VALUES: ProvisionTemplatesValues = { sourceUser: "", folderName: "", overwriteExisting: false, prune: false, usersPerSecond: "1" };

interface Props {
  domain: string;
  defaultOpen?: boolean;
}

export default function DomainTasks({ domain, defaultOpen }: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const toastTaskCreated = useTaskCreatedToast();
  const confirm = useConfirm();
  const canApplySignatures = useIsAllowed("POST", "/domains/{domain}/signature-templates?action=apply");
  const canDeleteData = useIsAllowed("POST", "/domains/{domain}?action=deleteData");
  const canProvisionTemplates = useIsAllowed("POST", "/domains/{domain}/templates?action=provision&from={sourceUser}");

  const [open, setOpen, openContentId] = useSectionOpen("tasks", defaultOpen ?? false);
  const [applyLoading, setApplyLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
    let values = INITIAL_PROVISION_VALUES;

    await confirm({
      header: t("domains.tasks.provisionTemplatesTitle"),
      message: (
        <FormTaskContent
          initialValues={values}
          renderForm={(onChange) => <ProvisionTemplatesForm showUsersPerSecond onChange={onChange} />}
          buildCommand={(v) => provisionDomainTemplatesCommand(domain, v)}
          onChange={(v) => { values = v; }}
        />
      ),
      validate: () => {
        const error = provisionSourceError(values.sourceUser.trim(), domain, appConfig.mode === "DOMAIN");
        return error ? t(error, { domain }) : null;
      },
      action: async () => {
        const { taskId } = await provisionDomainTemplates(domain, {
          from: values.sourceUser.trim(),
          folderName: values.folderName.trim() || undefined,
          overwriteExisting: values.overwriteExisting,
          prune: values.prune,
          usersPerSecond: values.usersPerSecond.trim() || undefined,
        });
        toastTaskCreated(taskId, undefined, taskTypeLabel(t, "DomainTemplatesProvisionTask"));
      },
    });
  };

  const handleDeleteAllUsersData = async () => {
    const confirmed = await confirm({
      header: t("domains.tasks.deleteAllDataTitle"),
      destructive: true,
      confirmLabel: t("confirm.deleteData"),
      typeToConfirm: domain,
      typeToConfirmIgnoreCase: true,
      message: (
        <ConfirmTaskContent
          message={<p>{t("domains.tasks.deleteAllDataConfirm", { domain })}</p>}
          command={deleteAllUsersDataCommand(domain)}
        />
      ),
    });
    if (!confirmed) return;

    setDeleting(true);
    try {
      const { taskId } = await deleteAllUsersData(domain);
      toastTaskCreated(taskId, undefined, taskTypeLabel(t, "DeleteUsersDataOfDomainTask"));
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
      <SectionToggle open={open} onToggle={() => setOpen(!open)} controls={openContentId}>
        {t("domains.tasks.title")}
      </SectionToggle>

      {open && (
        <div id={openContentId} className="mt-2 space-y-2">
          {showProvision && (
            <TaskRow
              title={t("domains.tasks.provisionTemplates")}
              description={t("domains.tasks.provisionTemplatesDesc")}
              risk="caution"
              command={provisionDomainTemplatesCommand(domain, INITIAL_PROVISION_VALUES)}
              onRun={handleProvisionTemplates}
            />
          )}

          {showApply && (
            <TaskRow
              title={t("domains.tasks.applySignatures")}
              description={t("domains.tasks.applySignaturesDesc")}
              risk="caution"
              command={`curl -XPOST /domains/${domain}/signature-templates?action=apply`}
              onRun={handleApplySignatureTemplates}
              disabled={applyLoading}
              loading={applyLoading}
            />
          )}

          {canDeleteData && (
            <TaskRow
              title={t("domains.tasks.deleteAllData")}
              description={t("domains.tasks.deleteAllDataDesc")}
              risk="destructive"
              command={`curl -XPOST /domains/${domain}?action=deleteData`}
              onRun={handleDeleteAllUsersData}
              disabled={deleting}
              loading={deleting}
            />
          )}
        </div>
      )}
    </div>
  );
}
