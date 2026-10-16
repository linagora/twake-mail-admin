import { Outlet } from "react-router";
import { useTranslation } from "react-i18next";
import Header from "@/components/custom/header";
import { calendarWebadminDoc } from "@/lib/calendar-docs";

export default function RegisteredUsers() {
  const { t } = useTranslation();
  return (
    <div className="p-4 w-fit max-w-full">
      <Header headerTitle={t("sidebar.registeredUsers")} headerSubTitle={t("registeredUsers.subtitle")} docuUrl={calendarWebadminDoc("calendar-users-routes")} />
      <Outlet />
    </div>
  );
}
