import { Outlet } from "react-router";
import Header from "@/components/custom/header";

const headerTitle = "Mappings";

const headerSubTitle = "View all recipients rewrite mappings (aliases, groups, domains, forwards).";

const docuUrl =
  "https://james.staged.apache.org/james-project/3.10.0/servers/distributed/operate/webadmin.html#_listing_all_mappings";

export default function Mappings() {
  return (
    <div className="p-4 w-fit">
      <Header
        headerTitle={headerTitle}
        headerSubTitle={headerSubTitle}
        docuUrl={docuUrl}
      />
      <Outlet />
    </div>
  );
}
