import { Outlet, useParams } from "react-router";
import Header from "@/components/custom/header";
import { appConfig } from "@/lib/config";

const headerTitle = "Users";

const docuUrl =
  "https://james.staged.apache.org/james-project/3.10.0/servers/distributed/operate/webadmin.html#_administrating_users";

export default function Users() {
  const { username } = useParams();
  const headerSubTitle = appConfig.application === 'CALENDAR'
    ? "Manage users registered on the calendar server."
    : "Manage users registered on the mail server.";

  return (
    <div className="p-4 w-fit">
      <Header
        headerTitle={headerTitle}
        headerSubTitle={headerSubTitle}
        docuUrl={docuUrl}
        enableBackBtn={!!username}
      />
      <Outlet />
    </div>
  );
}
