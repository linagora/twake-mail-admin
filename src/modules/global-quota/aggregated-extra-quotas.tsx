import { useTranslation } from "react-i18next";
import { useFetchData } from "@/hooks/use-fetch-data";
import { getQuotaExtraSummary } from "./api-client";
import { SectionToggle, useSectionOpen } from "@/components/custom/collapsible-section";

interface AggregatedExtraQuotasProps {
  formatCount: (count: number | null) => string;
  formatSize: (bytes: number | null) => string;
}

// The summary scans every user with a specific quota: it is only fetched once the section is opened.
export default function AggregatedExtraQuotas({ formatCount, formatSize }: AggregatedExtraQuotasProps) {
  const { t } = useTranslation();
  const [open, setOpen, openContentId] = useSectionOpen("aggregated-extra-quotas");
  const { data, isLoading, error } = useFetchData(open ? getQuotaExtraSummary : null);

  return (
    <div>
      <SectionToggle open={open} onToggle={() => setOpen(!open)} controls={openContentId}>
        {t("globalQuota.aggregatedExtra")}
      </SectionToggle>
      {open && <div id={openContentId} className="mt-2">{isLoading ? (
        <div className="h-[58px] rounded-2 animate-pulse bg-gray-200" />
      ) : error ? (
        <p className="text-sm text-red-500">{t("common.errorPrefix", { message: error })}</p>
      ) : data ? (
        <div className="p-4 bg-gray-50 rounded-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <span className="text-gray-600">{t("globalQuota.totalExtraStorage")}</span>
          <strong>{formatSize(data.totalExtraStorageLimit)}</strong>
          <span className="text-gray-600">{t("globalQuota.totalExtraCount")}</span>
          <strong>{formatCount(data.totalExtraCountLimit)}</strong>
          <span className="text-gray-600">{t("globalQuota.usersUnlimitedStorage")}</span>
          <strong>{data.totalUnlimitedStorage}</strong>
          <span className="text-gray-600">{t("globalQuota.usersUnlimitedCount")}</span>
          <strong>{data.totalUnlimitedCount}</strong>
        </div>
      ) : null}</div>}
    </div>
  );
}
