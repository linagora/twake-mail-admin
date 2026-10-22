import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useFetchData } from "@/hooks/use-fetch-data";
import { getQuotaExtraSummary } from "./api-client";

interface AggregatedExtraQuotasProps {
  formatCount: (count: number | null) => string;
  formatSize: (bytes: number | null) => string;
}

// The summary scans every user with a specific quota: it is only fetched once the section is opened.
export default function AggregatedExtraQuotas({ formatCount, formatSize }: AggregatedExtraQuotasProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { data, isLoading, error } = useFetchData(open ? getQuotaExtraSummary : null);

  return (
    <div className="p-4 bg-gray-50 rounded-2 space-y-3">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-sm font-semibold hover:text-blue-600 transition"
      >
        {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        {t("globalQuota.aggregatedExtra")}
      </button>
      {open && (isLoading ? (
        <div className="h-[58px] rounded-2 animate-pulse bg-gray-200" />
      ) : error ? (
        <p className="text-sm text-red-500">{t("common.errorPrefix", { message: error })}</p>
      ) : data ? (
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <span className="text-gray-600">{t("globalQuota.totalExtraStorage")}</span>
          <strong>{formatSize(data.totalExtraStorageLimit)}</strong>
          <span className="text-gray-600">{t("globalQuota.totalExtraCount")}</span>
          <strong>{formatCount(data.totalExtraCountLimit)}</strong>
          <span className="text-gray-600">{t("globalQuota.usersUnlimitedStorage")}</span>
          <strong>{data.totalUnlimitedStorage}</strong>
          <span className="text-gray-600">{t("globalQuota.usersUnlimitedCount")}</span>
          <strong>{data.totalUnlimitedCount}</strong>
        </div>
      ) : null)}
    </div>
  );
}
