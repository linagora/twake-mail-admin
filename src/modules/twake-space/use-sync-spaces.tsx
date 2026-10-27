import { useTranslation } from "react-i18next";
import { useConfirm } from "@/hooks/use-confirm";
import { useToast } from "@/hooks/use-toast";
import FormTaskContent from "@/modules/common-tasks/components/form-task-content";
import { requestSpacesSync } from "./api-client";
import { EVERY_SPACE, SpaceSyncScope, explainStatus, syncScopeProblem, syncSpacesCommand } from "./space";
import SyncSpacesForm from "./sync-spaces-form";

/**
 * Opens the dialog requesting a sync of the Twake spaces, prefilled with a scope. The server
 * only publishes the request: the toast says it was requested, not that it completed.
 */
export function useSyncSpaces() {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const { toast } = useToast();

  return async (initialScope: SpaceSyncScope = EVERY_SPACE) => {
    let scope = initialScope;
    return confirm({
      header: t("twakeSpace.sync.title"),
      confirmLabel: t("twakeSpace.sync.confirmLabel"),
      message: (
        <FormTaskContent
          initialValues={initialScope}
          renderForm={(onChange) => <SyncSpacesForm initialValues={initialScope} onChange={onChange} />}
          buildCommand={syncSpacesCommand}
          onChange={(values) => { scope = values; }}
        />
      ),
      validate: () => {
        const problem = syncScopeProblem(scope);
        return problem && t(problem);
      },
      action: async () => {
        // Without the Twake Space extension, the route does not exist
        await requestSpacesSync(scope).catch(explainStatus(404, t("twakeSpace.unavailable")));
        toast({ title: t("twakeSpace.sync.requested") });
      },
    });
  };
}
