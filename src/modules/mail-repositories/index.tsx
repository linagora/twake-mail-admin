import { Outlet, useParams } from "react-router";
import Header from "@/components/custom/header";

const headerTitle = "Mail Repositories";

const headerSubTitle =
  "Mail repositories store emails along with their processing context, allowing to later resume the mail processing.";

const docuUrl =
  "https://james.staged.apache.org/james-project/3.10.0/servers/distributed/operate/webadmin.html#_administrating_mail_repositories";

export default function MailRepositories() {
  const { id } = useParams();

  return (
    <div className="p-4 w-fit">
      <Header
        headerTitle={headerTitle}
        headerSubTitle={headerSubTitle}
        docuUrl={docuUrl}
        enableBackBtn={!!id}
      />
      <Outlet />
    </div>
  );
}
