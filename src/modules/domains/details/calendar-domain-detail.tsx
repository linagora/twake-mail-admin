import { useParams } from "react-router";
import CalendarDomainAdmins from "./calendar-domain-admins";
import CalendarDomainResources from "./calendar-domain-resources";
import CalendarDomainSettings from "./calendar-domain-settings";
import CalendarDomainTasks from "./calendar-domain-tasks";
import { useTranslation } from "react-i18next";

export default function CalendarDomainDetail() {
  const { t } = useTranslation();
  const { domain } = useParams();

  return (
    <div className="mt-4 p-4 bg-white rounded-2">
      <h3 className="text-lg font-semibold">{t("domains.calendarDetail.title")}</h3>
      <p>{t("domains.calendarDetail.domain", { domain })}</p>

      <CalendarDomainAdmins domain={domain!} />
      <CalendarDomainResources domain={domain!} />
      <CalendarDomainSettings domain={domain!} />
      <CalendarDomainTasks domain={domain!} />
    </div>
  );
}
