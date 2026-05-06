import { Outlet } from "react-router";
import { useTranslation } from "react-i18next";
import Header from "@/components/custom/header";

const docuUrl =
  "https://james.staged.apache.org/james-project/3.10.0/servers/distributed/operate/webadmin.html#_listing_all_mappings";

export default function Mappings() {
  const { t } = useTranslation();
  return (
    <div className="p-4 w-fit">
      <Header
        headerTitle={t("sidebar.mappings")}
        headerSubTitle={t("mappings.subtitle")}
        docuUrl={docuUrl}
      />
      <Outlet />
    </div>
  );
}
