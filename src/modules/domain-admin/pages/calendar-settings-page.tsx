import CalendarDomainSettings from "@/modules/domains/details/calendar-domain-settings";
import { useDomain } from "../domain-context";
import { useTranslation } from "react-i18next";

export default function CalendarSettingsPage() {
  const { t } = useTranslation();
  const domain = useDomain();
  return (
    <div className="mt-4 p-4 bg-white rounded-2">
      <h3 className="text-lg font-semibold mb-2">{t("domainAdminPages.calendarSettings")}</h3>
      <CalendarDomainSettings domain={domain} defaultOpen />
    </div>
  );
}
