import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { apiClient } from "@/lib/apiClient";
import { appConfig } from "@/lib/config";
import { useIsAllowed } from "@/lib/proxy-resolver-context";
import { currentLocale } from "@/i18n/locale";
import { formatByteSize } from "@/i18n/format-size";
import { parseQuotaUsageSum, type QuotaUsageSum } from "./quota-usage";
import { SectionToggle, useSectionOpen } from "@/components/custom/collapsible-section";

function formatCount(count: number): string {
  return count.toLocaleString(currentLocale());
}

interface Props {
  domain?: string;
}

export default function QuotaUsageSumSection({ domain }: Props) {
  const { t } = useTranslation();
  const pattern = domain ? "/quota/domains/{domain}" : "/quota/sum";
  const canView = useIsAllowed("GET", pattern);
  const [open, setOpen, openContentId] = useSectionOpen("quota-usage-sum");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<QuotaUsageSum | null>(null);
  const [error, setError] = useState(false);

  const fetchSum = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const url = domain ? `/quota/domains/${encodeURIComponent(domain)}` : "/quota/sum";
      const result = parseQuotaUsageSum(await apiClient.get(url));
      setData(result);
      setError(result === null);
    } catch {
      setData(null);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [domain]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetches when the section is opened: the loading flag is set as the request starts
    if (open) fetchSum();
  }, [open, fetchSum]);

  if (!canView || appConfig.application !== "MAIL") return null;

  return (
    <div className="mt-6">
      <SectionToggle open={open} onToggle={() => setOpen(!open)} controls={openContentId}>
        {domain ? t("quotaUsage.domainTitle") : t("quotaUsage.globalTitle")}
      </SectionToggle>

      {open && (
        <div id={openContentId} className="mt-2">
          {loading ? (
            <div className="h-[58px] rounded-2 animate-pulse bg-gray-200" />
          ) : error ? (
            <p className="text-sm text-muted-foreground">{t("quotaUsage.couldNotLoad")}</p>
          ) : data ? (
            <div className="p-4 bg-gray-50 rounded-2 space-y-3">
              <div className="flex justify-between items-center py-1">
                <span className="text-sm text-gray-600">{t("common.count")}</span>
                <strong className="text-sm">{formatCount(data.count)}</strong>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-sm text-gray-600">{t("common.size")}</span>
                <strong className="text-sm">{formatByteSize(data.size)}</strong>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
