import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useIsAllowed } from "@/lib/proxy-resolver-context";
import { useFetchData } from "@/hooks/use-fetch-data";
import { getGlobalQuota, updateGlobalQuota, deleteGlobalQuotaSize } from "./api-client";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/hooks/use-confirm";
import ErrorDisplayer from "@/components/custom/error-displayer";
import Header from "@/components/custom/header";
import { Button } from "@/components/ui/button";
import ExploreUserQuota from "@/components/custom/explore-user-quota";
import QuotaUsageSumSection from "@/components/custom/quota-usage-sum";
import UsersWithSpecificQuotas from "./users-with-specific-quotas";
import AggregatedExtraQuotas from "./aggregated-extra-quotas";
import i18n from "i18next";
import { currentLocale } from "@/i18n/locale";
import { formatByteSize } from "@/i18n/format-size";

const docuUrl = "https://james.staged.apache.org/james-project/3.10.0/servers/distributed/operate/webadmin.html#_administrating_quotas";

function formatSize(bytes: number | null): string {
  if (bytes === null) return i18n.t("common.notSet");
  if (bytes === -1) return i18n.t("common.unlimited");
  return formatByteSize(bytes);
}

function formatCount(count: number | null): string {
  if (count === null) return i18n.t("common.notSet");
  if (count === -1) return i18n.t("common.unlimited");
  return count.toLocaleString(currentLocale());
}

function toBytes(value: number, unit: string): number {
  if (value === -1) return -1;
  switch (unit) {
    case "KB": return value * 1024;
    case "MB": return value * 1024 * 1024;
    case "GB": return value * 1024 * 1024 * 1024;
    default: return value;
  }
}

export default function GlobalQuota() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const confirm = useConfirm();
  const canUpdate = useIsAllowed("PUT", "/quota");
  const canRemove = useIsAllowed("DELETE", "/quota/size");
  const canViewSummary = useIsAllowed("GET", "/reports/quota/users/sum?hasSpecificQuota");
  const canViewSpecificQuotas = useIsAllowed("GET", "/reports/quota/users?hasSpecificQuota");

  // Only the global quota is loaded with the page: the reports are fetched when their section is opened
  const { data: quota, isLoading, error, refresh } = useFetchData(getGlobalQuota);

  const [showSizeEdit, setShowSizeEdit] = useState(false);
  const [sizeInput, setSizeInput] = useState("");
  const [sizeUnit, setSizeUnit] = useState<"B" | "KB" | "MB" | "GB">("GB");

  const handleUpdateSize = async () => {
    const raw = parseFloat(sizeInput);
    if (isNaN(raw) || raw < -1 || raw === 0) {
      toast({ title: t("common.invalidSize"), description: t("common.invalidSizeDesc") });
      return;
    }
    const bytes = Math.round(toBytes(raw, sizeUnit));
    try {
      await updateGlobalQuota({
        count: quota?.count ?? null,
        size: bytes,
      });
      toast({ title: t("globalQuota.updated") });
      setSizeInput("");
      setShowSizeEdit(false);
      refresh();
    } catch (err) {
      toast({ title: t("globalQuota.errorUpdating"), description: <ErrorDisplayer error={err} /> });
    }
  };

  const handleRemoveSize = async () => {
    const confirmed = await confirm({
      header: t("globalQuota.removeSizeLimit"),
      message: t("globalQuota.removeConfirm"),
    });
    if (!confirmed) return;
    try {
      await deleteGlobalQuotaSize();
      toast({ title: t("globalQuota.removed") });
      refresh();
    } catch (err) {
      toast({ title: t("globalQuota.errorRemoving"), description: <ErrorDisplayer error={err} /> });
    }
  };

  return (
    <div className="p-4 w-fit max-w-full">
      <Header headerTitle={t("globalQuota.title")} headerSubTitle={t("globalQuota.subtitle")} docuUrl={docuUrl} />

      <div className="mt-4">
        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="h-[58px] rounded-2 animate-pulse bg-gray-200" />
            <div className="h-[58px] rounded-2 animate-pulse bg-gray-200" />
          </div>
        )}
        {error && <p className="text-red-500 mt-2">{t("common.errorPrefix", { message: error })}</p>}

        {quota && (
          <div className="space-y-6">
            {/* Current global quota */}
            <div className="p-4 bg-gray-50 rounded-2 space-y-3">
              <h4 className="text-sm font-semibold">{t("globalQuota.currentQuota")}</h4>
              <div className="flex justify-between items-center py-1">
                <span className="text-sm text-gray-600">{t("globalQuota.count")}</span>
                <strong className="text-sm">{formatCount(quota.count)}</strong>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-sm text-gray-600">{t("globalQuota.size")}</span>
                <strong className="text-sm">{formatSize(quota.size)}</strong>
              </div>

              <hr className="border-gray-200" />

              <div className="flex items-center gap-2 flex-wrap">
                {canUpdate && (
                  <Button
                    variant="outline"
                    className="rounded-sm"
                    onClick={() => setShowSizeEdit(!showSizeEdit)}
                  >
                    {t("common.updateSizeLimit")}
                  </Button>
                )}
                {canRemove && quota.size != null && (
                  <Button
                    variant="outline"
                    className="rounded-sm"
                    onClick={handleRemoveSize}
                  >
                    {t("globalQuota.removeSizeLimit")}
                  </Button>
                )}
              </div>

              {showSizeEdit && (
                <div className="flex gap-2 mt-2">
                  <input
                    autoFocus
                    type="number"
                    value={sizeInput}
                    onChange={(e) => setSizeInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleUpdateSize()}
                    placeholder={t("common.sizeUnlimited")}
                    aria-label={t("common.sizeLimit")}
                    className="flex-1 px-4 py-2 border rounded-md focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                  <select
                    value={sizeUnit}
                    onChange={(e) => setSizeUnit(e.target.value as "B" | "KB" | "MB" | "GB")}
                    aria-label={t("common.sizeUnit")}
                    className="px-3 py-2 border rounded-md focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="B">B</option>
                    <option value="KB">KB</option>
                    <option value="MB">MB</option>
                    <option value="GB">GB</option>
                  </select>
                  <button
                    onClick={handleUpdateSize}
                    disabled={!sizeInput.trim()}
                    className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {t("common.save")}
                  </button>
                </div>
              )}
            </div>

            {canViewSummary && <AggregatedExtraQuotas formatCount={formatCount} formatSize={formatSize} />}

            {canViewSpecificQuotas && (
              <UsersWithSpecificQuotas formatCount={formatCount} formatSize={formatSize} />
            )}
          </div>
        )}

        <QuotaUsageSumSection />
        <ExploreUserQuota />
      </div>
    </div>
  );
}
