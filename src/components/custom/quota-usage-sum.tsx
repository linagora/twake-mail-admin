import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { apiClient } from "@/lib/apiClient";
import { appConfig } from "@/lib/config";
import { useIsAllowed } from "@/lib/proxy-resolver-context";

interface QuotaUsageSum {
  count: number;
  size: number;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatCount(count: number): string {
  return count.toLocaleString();
}

interface Props {
  domain?: string;
}

export default function QuotaUsageSumSection({ domain }: Props) {
  const { t } = useTranslation();
  const pattern = domain ? "/quota/domains/{domain}" : "/quota/sum";
  const canView = useIsAllowed("GET", pattern);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<QuotaUsageSum | null>(null);
  const [error, setError] = useState(false);

  const fetchSum = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const url = domain ? `/quota/domains/${encodeURIComponent(domain)}` : "/quota/sum";
      const result: QuotaUsageSum = await apiClient.get(url);
      setData(result);
    } catch {
      setData(null);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [domain]);

  useEffect(() => {
    if (open) fetchSum();
  }, [open, fetchSum]);

  if (!canView || appConfig.application !== "MAIL") return null;

  return (
    <div className="mt-6">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-md font-semibold hover:text-blue-600 transition"
      >
        {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        {domain ? t("quotaUsage.domainTitle") : t("quotaUsage.globalTitle")}
      </button>

      {open && (
        <div className="mt-2">
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
                <strong className="text-sm">{formatSize(data.size)}</strong>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
