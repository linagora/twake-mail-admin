import { Outlet, useParams } from "react-router";
import { useTranslation } from "react-i18next";
import Header from "@/components/custom/header";

const docuUrl =
  "https://james.staged.apache.org/james-project/3.10.0/servers/distributed/operate/webadmin.html#_event_dead_letter";

export default function EventDeadletter() {
  const { t } = useTranslation();
  const { id } = useParams();

  return (
    <div className="p-4">
      <Header
        headerTitle={t("sidebar.eventDeadLetter")}
        headerSubTitle={t("eventDeadletter.subtitle")}
        docuUrl={docuUrl}
        enableBackBtn={!!id}
      />
      <Outlet />
    </div>
  );
}
