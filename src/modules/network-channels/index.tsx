import { Outlet } from "react-router";
import Header from "@/components/custom/header";

const headerSubTitle = "Network channels currently active on the server.";

const docuUrl =
  "https://james.staged.apache.org/james-project/3.10.0/servers/distributed/operate/webadmin.html#_server_channels";

export default function NetworkChannels() {
  return (
    <div className="p-4 w-fit">
      <Header
        headerSubTitle={headerSubTitle}
        docuUrl={docuUrl}
      />
      <Outlet />
    </div>
  );
}
