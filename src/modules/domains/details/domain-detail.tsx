import { useParams } from "react-router";
import DomainQuotaSection from "./domain-quota";
import DomainAliases from "./domain-aliases";
import DomainTeamMailboxes from "./domain-team-mailboxes";
import DomainContacts from "./domain-contacts";
import DomainTasks from "./domain-tasks";

export default function DomainDetail() {
  const { domain } = useParams();

  return (
    <div className="mt-4 p-4 bg-white rounded-2">
      <h3 className="text-lg font-semibold">Domain Details</h3>
      <p>Domain: {domain}</p>

      <DomainQuotaSection domain={domain!} />
      <DomainAliases domain={domain!} />
      <DomainTeamMailboxes domain={domain!} />
      <DomainContacts domain={domain!} />
      <DomainTasks domain={domain!} />
    </div>
  );
}
