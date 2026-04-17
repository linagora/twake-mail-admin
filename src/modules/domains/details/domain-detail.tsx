import { useCallback } from "react";
import { useParams } from "react-router";
import DomainQuotaSection from "./domain-quota";
import DomainAliases from "./domain-aliases";
import DomainTeamMailboxes from "./domain-team-mailboxes";
import DomainContacts from "./domain-contacts";
import DomainTasks from "./domain-tasks";
import RateLimitsSection from "@/components/custom/rate-limits-section";
import { getDomainRateLimits, updateDomainRateLimits } from "../api-client";
import { useIsAllowed } from "@/lib/proxy-resolver-context";

export default function DomainDetail() {
  const { domain } = useParams();
  const canUpdateRateLimits = useIsAllowed("PUT", "/domains/{domain}/ratelimits");

  const fetchRateLimits = useCallback(() => getDomainRateLimits(domain!), [domain]);
  const updateRateLimits = useCallback((limits: any) => updateDomainRateLimits(domain!, limits), [domain]);

  return (
    <div className="mt-4 p-4 bg-white rounded-2">
      <h3 className="text-lg font-semibold">Domain Details</h3>
      <p>Domain: {domain}</p>

      <DomainQuotaSection domain={domain!} />
      <DomainAliases domain={domain!} />
      <DomainTeamMailboxes domain={domain!} />
      <DomainContacts domain={domain!} />
      <RateLimitsSection fetchRateLimits={fetchRateLimits} updateRateLimits={updateRateLimits} canUpdate={canUpdateRateLimits} />
      <DomainTasks domain={domain!} />
    </div>
  );
}
