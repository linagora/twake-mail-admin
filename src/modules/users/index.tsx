import { Outlet, useParams } from "react-router";
import Header from "@/components/custom/header";

const headerTitle = "Users";

const headerSubTitle = "Manage users registered on the mail server.";

const docuUrl =
  "https://james.staged.apache.org/james-project/3.9.0/servers/distributed/operate/webadmin.html#_administrating_users";

export default function Users() {
  const { username } = useParams();

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
