import { Outlet, useParams } from "react-router";
import Header from "@/components/custom/header";

const headerSubTitle = "Manage domains registered on the mail server.";

const docuUrl =
  "https://james.staged.apache.org/james-project/3.9.0/servers/distributed/operate/webadmin.html#_create_a_domain";

export default function Domains() {
  const { domain } = useParams();

  return (
    <div className="p-4 w-fit">
      <Header
        headerSubTitle={headerSubTitle}
        docuUrl={docuUrl}
        enableBackBtn={!!domain}
      />
      <Outlet />
    </div>
  );
}
