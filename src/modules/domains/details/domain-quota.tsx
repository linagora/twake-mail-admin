import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { getDomainQuota, updateDomainQuotaSize, deleteDomainQuotaSize, updateDomainQuotaCount, deleteDomainQuotaCount } from "../api-client";
import { DomainQuota } from "../types";
import QuotaLimits, { NO_LIMITS, QuotaLimitsApi } from "@/components/custom/quota-limits";
import ExploreUserQuota from "@/components/custom/explore-user-quota";
import QuotaUsageSumSection from "@/components/custom/quota-usage-sum";
import { useIsAllowed } from "@/lib/proxy-resolver-context";
import { QuotaLevelRows } from "@/components/custom/quota-levels";
import { SectionToggle, useSectionOpen } from "@/components/custom/collapsible-section";

interface Props {
  domain: string;
  defaultOpen?: boolean;
}

export default function DomainQuotaSection({ domain, defaultOpen }: Props) {
  const { t } = useTranslation();
  const canView = useIsAllowed("GET", "/quota/domains/{domain}");
  const canUpdateSize = useIsAllowed("PUT", "/quota/domains/{domain}/size");
  const canUpdateCount = useIsAllowed("PUT", "/quota/domains/{domain}/count");
  const canReset = useIsAllowed("DELETE", "/quota/domains/{domain}/size");
  const [open, setOpen, openContentId] = useSectionOpen("quota", defaultOpen ?? false);
  const [loading, setLoading] = useState(false);
  const [quota, setQuota] = useState<DomainQuota | null>(null);
  const limitsApi = useMemo<QuotaLimitsApi>(() => ({
    putCount: (count) => updateDomainQuotaCount(domain, count),
    deleteCount: () => deleteDomainQuotaCount(domain),
    putSize: (size) => updateDomainQuotaSize(domain, size),
    deleteSize: () => deleteDomainQuotaSize(domain),
  }), [domain]);

  const fetchQuota = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getDomainQuota(domain);
      setQuota(data);
    } catch {
      setQuota(null);
    } finally {
      setLoading(false);
    }
  }, [domain]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetches when the section is opened: the loading flag is set as the request starts
    if (open) fetchQuota();
  }, [open, fetchQuota]);

  if (!canView) return null;

  return (
    <div className="mt-6">
      <SectionToggle open={open} onToggle={() => setOpen(!open)} controls={openContentId}>
        {t("domains.quota.title")}
      </SectionToggle>

      {open && (
        <div id={openContentId} className="mt-2">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-2">
              <div className="h-[58px] rounded-2 animate-pulse bg-gray-200" />
            </div>
          ) : quota ? (
            <div className="p-4 bg-gray-50 rounded-2 space-y-3">
              <div>
                <h4 className="text-sm font-semibold mb-1">{t("common.perUserLimit")}</h4>
                <QuotaLevelRows levels={[
                  { source: "domain", label: t("quota.domainLevel", { domain }), values: quota.domain, domain },
                  { source: "global", label: t("common.global"), values: quota.global },
                ]} />
              </div>

              <hr className="border-gray-200" />

              <QuotaLimits
                target={domain}
                current={quota.domain ?? NO_LIMITS}
                parents={[{ label: t("quotaLimits.parentGlobal"), values: quota.global ?? NO_LIMITS }]}
                api={limitsApi}
                canEditCount={canUpdateCount}
                canEditSize={canUpdateSize}
                canRemove={canReset}
                removeLabel={t("quotaLimits.removeDomain")}
                removeConfirm={t("domains.quota.resetConfirm", { domain })}
                onChanged={fetchQuota}
              />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t("domains.quota.couldNotLoad")}</p>
          )}

        </div>
      )}

      {open && <QuotaUsageSumSection domain={domain} />}
      {open && <ExploreUserQuota domain={domain} />}
    </div>
  );
}
