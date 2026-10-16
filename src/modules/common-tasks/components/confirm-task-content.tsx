import { ReactNode, useState } from "react";
import { TaskParam } from "../types";
import TaskParamsModifier from "./task-prams-modifier";
import { useTranslation } from "react-i18next";

interface Props {
  message: string | ReactNode;
  command: string;
  params?: TaskParam[];
  getParamValues?: (key: string, value: string | boolean) => void;
}

// Builds the command preview by reflecting the user's custom parameters into the
// base command: a parameter already present in the command URL is overridden in
// place (avoiding duplicates like `eventsPerSecond=100eventsPerSecond=100`),
// otherwise it is appended to the query string, inside the closing quote of a
// quoted URL. Falsy values are dropped, including from the base command, to match
// what is actually sent to the backend.
const TRAILING_QUOTE = /["']$/;

// Removes `key=value` from the query string, keeping the separator of the
// following parameter: `?key=1&b=2` -> `?b=2`, `?a=1&key=2` -> `?a=1`.
const removeQueryParam = (command: string, key: string): string =>
  command.replace(
    new RegExp(`([?&])${key}=[^&"']*(&)?`),
    (_match, separator, nextSeparator) => (nextSeparator ? separator : "")
  );

const appendQueryParam = (command: string, key: string, value: string | boolean): string => {
  const closingQuote = TRAILING_QUOTE.exec(command)?.[0] ?? "";
  const url = command.slice(0, command.length - closingQuote.length);
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}${key}=${value}${closingQuote}`;
};

const buildCommandPreview = (
  command: string,
  customParams: Record<string, string | boolean>
): string => {
  return Object.entries(customParams).reduce((result, [key, value]) => {
    if (!value) {
      return removeQueryParam(result, key);
    }
    const existing = new RegExp(`([?&]${key}=)[^&"']*`);
    if (existing.test(result)) {
      return result.replace(existing, (_match, prefix) => `${prefix}${value}`);
    }
    return appendQueryParam(result, key, value);
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
    getParamValues?.(key, value);
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
