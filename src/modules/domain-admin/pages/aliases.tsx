import DomainAliases from "@/modules/domains/details/domain-aliases";
import { useDomain } from "../domain-context";
import { useTranslation } from "react-i18next";

export default function AliasesPage() {
  const { t } = useTranslation();
  const domain = useDomain();
  return (
    <div className="mt-4 p-4 bg-white rounded-2">
      <h3 className="text-lg font-semibold mb-2">{t("domainAdminPages.aliases")}</h3>
      <DomainAliases domain={domain} defaultOpen />
    </div>
  );
}
