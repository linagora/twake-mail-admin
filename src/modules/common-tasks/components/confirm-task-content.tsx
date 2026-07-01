import { ReactNode, useState } from "react";
import { TaskParam } from "../types";
import TaskParamsModifier from "./task-prams-modifier";
import { useTranslation } from "react-i18next";

interface Props {
  message: string | ReactNode;
  command: string;
  params?: TaskParam[];
  getParamValues: (key: string, value: string | boolean) => void;
}

// Builds the command preview by reflecting the user's custom parameters into the
// base command: a parameter already present in the command URL is overridden in
// place (avoiding duplicates like `eventsPerSecond=100eventsPerSecond=100`),
// otherwise it is appended to the query string. Falsy values are dropped to match
// what is actually sent to the backend.
const buildCommandPreview = (
  command: string,
  customParams: Record<string, string | boolean>
): string => {
  return Object.entries(customParams).reduce((result, [key, value]) => {
    if (!value) {
      return result;
    }
    const existing = new RegExp(`([?&]${key}=)[^&"']*`);
    if (existing.test(result)) {
      return result.replace(existing, (_match, prefix) => `${prefix}${value}`);
    }
    const separator = result.includes("?") ? "&" : "?";
    return `${result}${separator}${key}=${value}`;
  }, command);
};

const ConfirmTaskContent = ({
  message,
  command,
  params,
  getParamValues,
}: Props) => {
  const { t } = useTranslation();
  const [customParams, setCustomParams] = useState<Record<string, string | boolean>>({});

  const handleChangeParam = (key: string, value: string | boolean) => {
    setCustomParams((prev) => ({ ...prev, [key]: value }));
    getParamValues(key, value);
  };

  return (
    <div className="overflow-hidden">
      {message}
      {params?.length && (
        <>
          <p>
            {params?.length > 1
              ? t("confirmTask.modifyThese", "You can modify these parameters:")
              : t("confirmTask.modifyThis", "You can modify this parameter:")}
          </p>
          <div className="p-4">
            <TaskParamsModifier
              params={params}
              handleChangeParam={handleChangeParam}
            />
          </div>
        </>
      )}
      <p className="break-words">
        {t("confirmTask.command", "Command:")}:{" "}
        {buildCommandPreview(command, customParams)}
      </p>
    </div>
  );
};

export default ConfirmTaskContent;
