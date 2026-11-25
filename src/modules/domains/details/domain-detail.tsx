import { useCallback, useState } from "react";
import { Link, useParams } from "react-router";
import { TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import DomainQuotaSection from "./domain-quota";
import DomainAliases from "./domain-aliases";
import DomainTeamMailboxes, { type TeamMailboxContactChange } from "./domain-team-mailboxes";
import DomainContacts from "./domain-contacts";
import DomainTasks from "./domain-tasks";
import DomainSignatureTemplates from "./domain-signature-templates";
import DomainJmapReport from "./domain-jmap-report";
import { DomainSummary } from "./domain-summary";
import RateLimitsSection from "@/components/custom/rate-limits-section";
import { getDomainRateLimits, updateDomainRateLimits } from "../api-client";
import { useIsAllowed } from "@/lib/proxy-resolver-context";
import { appConfig } from "@/lib/config";
import Header from "@/components/custom/header";
import { useBreadcrumbs } from "@/hooks/use-breadcrumbs";
import { ExpandCollapseAll, SectionsProvider } from "@/components/custom/collapsible-section";
import { useDomainState } from "./use-domain-state";

/** The page of a domain the server does not manage: say so, and offer the way back. */
function NoDomain({ domain }: { domain: string }) {
  const { t } = useTranslation();
  return (
    <div role="alert" className="mt-4 flex gap-2 items-start border-l-4 border-amber-500 bg-amber-50 text-amber-900 p-3 text-sm">
      <TriangleAlert className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
      <div className="min-w-0 space-y-1">
        <p className="[overflow-wrap:anywhere]">{t("domains.noDomain.missing", { domain })}</p>
        <p>
          <Link to="/domains" className="text-blue-600 hover:underline">{t("domains.noDomain.back")}</Link>
        </p>
      </div>
    </div>
  );
}

export default function DomainDetail() {
  const { t } = useTranslation();
  const { domain } = useParams();
  const breadcrumbs = useBreadcrumbs();
  const canUpdateRateLimits = useIsAllowed("PUT", "/domains/{domain}/ratelimits");

  const fetchRateLimits = useCallback(() => getDomainRateLimits(domain!), [domain]);
  const updateRateLimits = useCallback((limits: any) => updateDomainRateLimits(domain!, limits), [domain]);
  const domainState = useDomainState(domain!);
  // A team mailbox comes with a contact: the Domain Contacts section follows its creation and deletion
  const [teamMailboxChange, setTeamMailboxChange] = useState<TeamMailboxContactChange | null>(null);

  if (domainState === "checking" || domainState === "missing") {
    return (
      <>
        <Header
          headerTitle={domain}
          headerSubTitle={t(domainState === "missing" ? "domains.noDomain.kind" : "domains.detailKind")}
          breadcrumb={breadcrumbs.domains()}
        />
        {domainState === "checking"
          ? <div className="h-[58px] mt-4 rounded-2 animate-pulse bg-gray-200" />
          : <NoDomain domain={domain!} />}
      </>
    );
  }

  return (
    <SectionsProvider page="domain">
    <Header headerTitle={domain} headerSubTitle={t("domains.detailKind")} breadcrumb={breadcrumbs.domains()} actions={<ExpandCollapseAll />} />
    <DomainSummary domain={domain!} />
    <div className="mt-4 p-4 bg-white rounded-2">

      <DomainQuotaSection domain={domain!} />
      <DomainAliases domain={domain!} />
      <DomainTeamMailboxes domain={domain!} onChanged={setTeamMailboxChange} />
      <DomainContacts domain={domain!} teamMailboxChange={teamMailboxChange} />
      {appConfig.application === 'MAIL' && <DomainSignatureTemplates domain={domain!} />}
      <RateLimitsSection fetchRateLimits={fetchRateLimits} updateRateLimits={updateRateLimits} canUpdate={canUpdateRateLimits} />
      <DomainJmapReport domain={domain!} />
      <DomainTasks domain={domain!} />
    </div>
    </SectionsProvider>
  );
}
