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

const ConfirmTaskContent = ({
  message,
  command,
  params,
  getParamValues,
}: Props) => {
  const { t } = useTranslation();
  const [customParams, setCustomParams] = useState({});

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
        {customParams
          ? `&${command}${new URLSearchParams(customParams)}`
          : command}
      </p>
    </div>
  );
};

export default ConfirmTaskContent;
