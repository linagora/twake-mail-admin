import { Outlet, useParams } from "react-router";
import { useTranslation } from "react-i18next";
import Header from "@/components/custom/header";

const docuUrl =
  "https://james.staged.apache.org/james-project/3.10.0/servers/distributed/operate/webadmin.html#_administrating_mail_repositories";

export default function MailRepositories() {
  const { t } = useTranslation();
  const { id } = useParams();

  return (
    <div className="p-4 w-fit">
      <Header
        headerTitle={t("sidebar.mailRepositories")}
        headerSubTitle={t("mailRepositories.subtitle")}
        docuUrl={docuUrl}
        enableBackBtn={!!id}
      />
      <Outlet />
    </div>
  );
}
