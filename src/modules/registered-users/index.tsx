import { Outlet } from "react-router";
import { useTranslation } from "react-i18next";
import Header from "@/components/custom/header";

export default function RegisteredUsers() {
  const { t } = useTranslation();
  return (
    <div className="p-4 w-fit">
      <Header headerTitle={t("sidebar.registeredUsers")} headerSubTitle={t("registeredUsers.subtitle")} docuUrl="" />
      <Outlet />
    </div>
  );
}
