import { Outlet, useParams } from "react-router";
import Header from "@/components/custom/header";

const headerTitle = "Event Deadletter";

const headerSubTitle =
  "Event deadletter store events and allow to resume their execution.";

const docuUrl =
  "https://james.staged.apache.org/james-project/3.10.0/servers/distributed/operate/webadmin.html#_event_dead_letter";

export default function EventDeadletter() {
  const { id } = useParams();

  return (
    <div className="p-4">
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
