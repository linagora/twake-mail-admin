import DomainQuotaSection from "@/modules/domains/details/domain-quota";
import { useDomain } from "../domain-context";
import { useTranslation } from "react-i18next";

export default function QuotaPage() {
  const { t } = useTranslation();
  const domain = useDomain();
  return (
    <div className="mt-4 p-4 bg-white rounded-2">
      <h3 className="text-lg font-semibold mb-2">{t("domainAdminPages.quota")}</h3>
      <DomainQuotaSection domain={domain} defaultOpen />
    </div>
  );
}
