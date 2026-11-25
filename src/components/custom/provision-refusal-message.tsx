import { useTranslation } from "react-i18next";
import ErrorDisplayer from "@/components/custom/error-displayer";

interface Props {
  param: "source" | "folder";
  domain: string;
  error: unknown;
}

/** Names the provisioning field WebAdmin refused, above the server message. */
const ProvisionRefusalMessage = ({ param, domain, error }: Props) => {
  const { t } = useTranslation();
  return (
    <div className="space-y-1">
      <p>{t(`provisionTemplates.refused.${param}`, { domain })}</p>
      <ErrorDisplayer error={error} />
    </div>
  );
};

export default ProvisionRefusalMessage;
