import { Outlet, useParams } from "react-router";
import { useTranslation } from "react-i18next";
import Header from "@/components/custom/header";
import { appConfig } from "@/lib/config";

const docuUrl =
  "https://james.staged.apache.org/james-project/3.10.0/servers/distributed/operate/webadmin.html#_create_a_domain";

export default function Domains() {
  const { t } = useTranslation();
  const { domain } = useParams();
  const subtitleKey = appConfig.application === 'CALENDAR' ? "domains.subtitleCalendar" : "domains.subtitleMail";

  return (
    <div className="p-4 w-fit">
      <Header
        headerTitle={t("sidebar.domains")}
        headerSubTitle={t(subtitleKey)}
        docuUrl={docuUrl}
        enableBackBtn={!!domain}
      />
      <Outlet />
    </div>
  );
}
