import { Outlet, useParams } from "react-router";
import { useTranslation } from "react-i18next";
import Header from "@/components/custom/header";

const docuUrl =
  "https://github.com/linagora/twake-calendar-side-service/blob/main/docs/apis/webadmin.md#unsent-mails-routes";

export default function UnsentMails() {
  const { t } = useTranslation();
  const { id } = useParams();

  return (
    <div className="p-4">
      <Header
        headerTitle={t("sidebar.unsentMails")}
        headerSubTitle={t("unsentMails.subtitle")}
        docuUrl={docuUrl}
        enableBackBtn={!!id}
      />
      <Outlet />
    </div>
  );
}
