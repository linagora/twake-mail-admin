import { useTranslation } from "react-i18next";
import ErrorDisplayer from "@/components/custom/error-displayer";

interface Props {
  param: "processor" | "queue";
  error: unknown;
}

/** Names the reprocessing field WebAdmin refused and says that no mail was moved, above the server message. */
const ReprocessRefusalMessage = ({ param, error }: Props) => {
  const { t } = useTranslation();
  return (
    <div className="space-y-1">
      <p>{t(`mailRepositories.reprocessRefused.${param}`)}</p>
      <ErrorDisplayer error={error} />
    </div>
  );
};

export default ReprocessRefusalMessage;
