import { useParams } from "react-router";
import CalendarDomainAdmins from "./calendar-domain-admins";
import CalendarDomainResources from "./calendar-domain-resources";
import CalendarDomainTasks from "./calendar-domain-tasks";

export default function CalendarDomainDetail() {
  const { domain } = useParams();

  return (
    <div className="mt-4 p-4 bg-white rounded-2">
      <h3 className="text-lg font-semibold">Domain Details</h3>
      <p>Domain: {domain}</p>

      <CalendarDomainAdmins domain={domain!} />
      <CalendarDomainResources domain={domain!} />
      <CalendarDomainTasks domain={domain!} />
    </div>
  );
}
