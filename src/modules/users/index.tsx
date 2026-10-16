import { Outlet, useParams } from "react-router";
import { useTranslation } from "react-i18next";
import Header from "@/components/custom/header";
import { appConfig } from "@/lib/config";
import { calendarWebadminDoc } from "@/lib/calendar-docs";

const mailDocuUrl =
  "https://james.staged.apache.org/james-project/3.10.0/servers/distributed/operate/webadmin.html#_administrating_users";

export default function Users() {
  const { t } = useTranslation();
  const { username } = useParams();
  const subtitleKey = appConfig.application === 'CALENDAR' ? "users.subtitleCalendar" : "users.subtitle";

  return (
    <div className="p-4 w-fit max-w-full">
      <Header
        headerTitle={t("sidebar.users")}
        headerSubTitle={t(subtitleKey)}
        docuUrl={appConfig.application === 'CALENDAR' ? calendarWebadminDoc("user-calendar-management-routes") : mailDocuUrl}
        enableBackBtn={!!username}
      />
      <Outlet />
    </div>
  );
}
