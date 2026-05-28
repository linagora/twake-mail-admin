import { useCallback } from "react";
import { useParams } from "react-router";
import { useTranslation } from "react-i18next";
import DomainQuotaSection from "./domain-quota";
import DomainAliases from "./domain-aliases";
import DomainTeamMailboxes from "./domain-team-mailboxes";
import DomainContacts from "./domain-contacts";
import DomainTasks from "./domain-tasks";
import DomainSignatureTemplates from "./domain-signature-templates";
import DomainJmapReport from "./domain-jmap-report";
import RateLimitsSection from "@/components/custom/rate-limits-section";
import { getDomainRateLimits, updateDomainRateLimits } from "../api-client";
import { useIsAllowed } from "@/lib/proxy-resolver-context";
import { appConfig } from "@/lib/config";

export default function DomainDetail() {
  const { t } = useTranslation();
  const { domain } = useParams();
  const canUpdateRateLimits = useIsAllowed("PUT", "/domains/{domain}/ratelimits");

  const fetchRateLimits = useCallback(() => getDomainRateLimits(domain!), [domain]);
  const updateRateLimits = useCallback((limits: any) => updateDomainRateLimits(domain!, limits), [domain]);

  return (
    <div className="mt-4 p-4 bg-white rounded-2">
      <h3 className="text-lg font-semibold">{t("domains.title")}</h3>
      <p>{t("domains.label", { domain })}</p>

      <DomainQuotaSection domain={domain!} />
      <DomainAliases domain={domain!} />
      <DomainTeamMailboxes domain={domain!} />
      <DomainContacts domain={domain!} />
      {appConfig.application === 'MAIL' && <DomainSignatureTemplates domain={domain!} />}
      <RateLimitsSection fetchRateLimits={fetchRateLimits} updateRateLimits={updateRateLimits} canUpdate={canUpdateRateLimits} />
      <DomainJmapReport domain={domain!} />
      <DomainTasks domain={domain!} />
    </div>
  );
}
