import { ReactNode, useEffect, useState } from "react";
import { TaskParam } from "../types";
import TaskParamsModifier from "./task-prams-modifier";
import { buildCommandPreview } from "./command-preview";
import { useTranslation } from "react-i18next";
import { useConfirmAppearance, useFocusCancelOnOpen } from "@/components/custom/confirm-provider";

interface Props {
  message: string | ReactNode;
  command: string;
  params?: TaskParam[];
  getParamValues?: (key: string, value: string | boolean) => void;
  // Shown between the parameters and the command, e.g. a warning computed from the values
  notice?: (values: Record<string, string | boolean>) => ReactNode;
}

// A box ticked by default is sent unticked as "false": the preview shows it too
const previewValues = (params: TaskParam[] | undefined, values: Record<string, string | boolean>) =>
  Object.fromEntries(Object.entries(values).map(([key, value]) => {
    const param = params?.find((p) => p.key === key);
    return [key, param?.type === "checkbox" && param.defaultValue === true && value === false ? "false" : value];
  }));

const ConfirmTaskContent = ({
  message,
  command,
  params,
  getParamValues,
  notice,
}: Props) => {
  const { t } = useTranslation();
  const [customParams, setCustomParams] = useState<Record<string, string | boolean>>({});
  // Every parameter has a server default: the dialog opens on Cancel, unless one is required
  useFocusCancelOnOpen(!params?.some((param) => param.optional === false));
  // The button says what it does, unless the dialog already named its action
  const setAppearance = useConfirmAppearance();
  useEffect(() => {
    setAppearance((current) => (current.confirmLabel ? {} : { confirmLabel: t("confirmTask.start") }));
  }, [setAppearance, t]);

  const handleChangeParam = (key: string, value: string | boolean) => {
    setCustomParams((prev) => ({ ...prev, [key]: value }));
    getParamValues?.(key, value);
  };

  return (
    <div className="overflow-hidden space-y-3">
      {message}
      {params && params.length > 0 && (
        <TaskParamsModifier
          params={params}
          handleChangeParam={handleChangeParam}
        />
      )}
      {notice?.(customParams)}
      <p className="break-words text-sm">
        <span className="font-medium">{t("confirmTask.commandLabel")}</span>{" "}
        <code className="font-mono text-xs">{buildCommandPreview(command, previewValues(params, customParams))}</code>
      </p>
    </div>
  );
};

export default ConfirmTaskContent;
