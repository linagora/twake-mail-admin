import CalendarDomainResources from "@/modules/domains/details/calendar-domain-resources";
import { useDomain } from "../domain-context";
import { useTranslation } from "react-i18next";

export default function CalendarResourcesPage() {
  const { t } = useTranslation();
  const domain = useDomain();
  return (
    <div className="mt-4 p-4 bg-white rounded-2">
      <h3 className="text-lg font-semibold mb-2">{t("domainAdminPages.calendarResources")}</h3>
      <CalendarDomainResources
        domain={domain}
        defaultOpen
        resourceLink={(resourceId) => `/resources/resource/${encodeURIComponent(resourceId)}`}
      />
    </div>
  );
}
