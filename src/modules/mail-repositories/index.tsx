import { Outlet } from "react-router";
import Header from "@/components/custom/header";

const headerTitle = "Mail Repositories";

const headerSubTitle =
  "Mail repositories store emails along with their processing context, allowing to later resume the mail processing.";

const docuUrl =
  "https://james.staged.apache.org/james-project/3.9.0/servers/distributed/operate/webadmin.html#_administrating_mail_repositories";

export default function MailRepositories() {
  return (
    <div className="p-4">
      <Header
        headerTitle={headerTitle}
        headerSubTitle={headerSubTitle}
        docuUrl={docuUrl}
      />
      <Outlet />
    </div>
  );
}
