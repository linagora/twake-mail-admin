import { Outlet } from "react-router";
import { useTranslation } from "react-i18next";
import Header from "@/components/custom/header";

const docuUrl =
  "https://github.com/linagora/tmail-backend/pull/2489";

export default function MailingLists() {
  const { t } = useTranslation();
  return (
    <div className="p-4 w-fit">
      <Header
        headerTitle={t("sidebar.mailingLists")}
        headerSubTitle={t("mailingLists.subtitle")}
        docuUrl={docuUrl}
      />
      <Outlet />
    </div>
  );
}
