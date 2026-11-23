import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useIsAllowed } from "@/lib/proxy-resolver-context";
import { useFetchData } from "@/hooks/use-fetch-data";
import { getTeamMailboxQuota, updateTeamMailboxQuotaSize, deleteTeamMailboxQuotaSize, updateTeamMailboxQuotaCount, deleteTeamMailboxQuotaCount } from "../api-client";
import { TeamMailboxQuota as TeamMailboxQuotaType } from "../types";
import QuotaLimits, { NO_LIMITS, QuotaLimitsApi } from "@/components/custom/quota-limits";
import { QuotaLevel, QuotaLevelRows, QuotaOccupation } from "@/components/custom/quota-levels";
import { SectionToggle, useSectionOpen } from "@/components/custom/collapsible-section";

interface Props {
  domain: string;
  mailbox: string;
}

export default function TeamMailboxQuota({ domain, mailbox }: Props) {
  const { t } = useTranslation();
  const canView = useIsAllowed("GET", "/domains/{domain}/team-mailboxes/{mailbox}/quota");
  const canUpdateSize = useIsAllowed("PUT", "/domains/{domain}/team-mailboxes/{mailbox}/quota/limit/size");
  const canUpdateCount = useIsAllowed("PUT", "/domains/{domain}/team-mailboxes/{mailbox}/quota/limit/count");
  const canReset = useIsAllowed("DELETE", "/domains/{domain}/team-mailboxes/{mailbox}/quota/limit/size");
  const [open, setOpen, openContentId] = useSectionOpen("quota");
  const limitsApi = useMemo<QuotaLimitsApi>(() => ({
    putCount: (count) => updateTeamMailboxQuotaCount(domain, mailbox, count),
    deleteCount: () => deleteTeamMailboxQuotaCount(domain, mailbox),
    putSize: (size) => updateTeamMailboxQuotaSize(domain, mailbox, size),
    deleteSize: () => deleteTeamMailboxQuotaSize(domain, mailbox),
  }), [domain, mailbox]);

  const fetchQuota = useCallback(() => getTeamMailboxQuota(domain, mailbox), [domain, mailbox]);
  const { data: quota, isLoading, error, refresh } = useFetchData<TeamMailboxQuotaType>(canView ? fetchQuota : null);

  if (!canView) return null;
  const levels: QuotaLevel[] = quota ? [
    { source: "teamMailbox", label: t("domains.teamMailboxQuota.teamMailbox"), values: quota.teamMailbox },
    { source: "domain", label: t("quota.domainLevel", { domain }), values: quota.domain, domain },
    { source: "global", label: t("common.global"), values: quota.global },
  ] : [];

  return (
    <div className="mt-6">
      <SectionToggle open={open} onToggle={() => setOpen(!open)} controls={openContentId}>
        {t("domains.teamMailboxQuota.title")}
      </SectionToggle>

      {open && (
        <div id={openContentId} className="mt-2">
          {isLoading && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-2">
              <div className="h-[58px] rounded-2 animate-pulse bg-gray-200" />
              <div className="h-[58px] rounded-2 animate-pulse bg-gray-200" />
            </div>
          )}
          {error && <p className="text-red-500 mt-2">{t("common.errorPrefix", { message: error })}</p>}

          {quota && (
            <div className="p-4 bg-gray-50 rounded-2 space-y-3">
              <QuotaOccupation occupation={quota.occupation} levels={levels} />

              <hr className="border-gray-200" />

              <div>
                <h4 className="text-sm font-semibold mb-1">{t("common.limits")}</h4>
                <QuotaLevelRows levels={levels} />
              </div>

              <hr className="border-gray-200" />

              <QuotaLimits
                target={`${mailbox}@${domain}`}
                current={quota.teamMailbox ?? NO_LIMITS}
                parents={[
                  { label: t("quotaLimits.parentDomain"), values: quota.domain ?? NO_LIMITS },
                  { label: t("quotaLimits.parentGlobal"), values: quota.global ?? NO_LIMITS },
                ]}
                api={limitsApi}
                canEditCount={canUpdateCount}
                canEditSize={canUpdateSize}
                canRemove={canReset}
                removeLabel={t("quotaLimits.removeSpecific")}
                removeConfirm={t("domains.teamMailboxQuota.resetConfirm", { mailbox, domain })}
                onChanged={refresh}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
