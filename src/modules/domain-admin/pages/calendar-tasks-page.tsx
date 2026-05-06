import CalendarDomainTasks from "@/modules/domains/details/calendar-domain-tasks";
import { useDomain } from "../domain-context";
import { useTranslation } from "react-i18next";

export default function CalendarTasksPage() {
  const { t } = useTranslation();
  const domain = useDomain();
  return (
    <div className="mt-4 p-4 bg-white rounded-2">
      <h3 className="text-lg font-semibold mb-2">{t("domainAdminPages.calendarTasks")}</h3>
      <CalendarDomainTasks domain={domain} defaultOpen />
    </div>
  );
}
