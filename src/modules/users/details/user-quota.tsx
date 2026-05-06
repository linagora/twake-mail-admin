import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useIsAllowed } from "@/lib/proxy-resolver-context";
import { useFetchData } from "@/hooks/use-fetch-data";
import { getUserQuota, updateUserQuotaSize, deleteUserQuotaSize } from "../api-client";
import { UserQuota as UserQuotaType, QuotaValues } from "../types";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/hooks/use-confirm";
import { Button } from "@/components/ui/button";
import ErrorDisplayer from "@/components/custom/error-displayer";

function formatSize(bytes: number | null): string {
  if (bytes === null) return "not set";
  if (bytes === -1) return "unlimited";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatCount(count: number | null): string {
  if (count === null) return "not set";
  if (count === -1) return "unlimited";
  return count.toLocaleString();
}

function QuotaRow({ label, values, countLabel, sizeLabel }: { label: string; values: QuotaValues | null; countLabel: string; sizeLabel: string }) {
  if (!values) return null;
  return (
    <div className="flex justify-between items-center py-1">
      <span className="text-sm text-gray-600 capitalize">{label}</span>
      <span className="text-sm">
        <span className="mr-4">{countLabel} <strong>{formatCount(values.count)}</strong></span>
        {sizeLabel} <strong>{formatSize(values.size)}</strong>
      </span>
    </div>
  );
}

interface Props {
  username: string;
}

export default function UserQuota({ username }: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const confirm = useConfirm();
  const canView = useIsAllowed("GET", "/quota/users/{username}");
  const canUpdate = useIsAllowed("PUT", "/quota/users/{username}/size");
  const canReset = useIsAllowed("DELETE", "/quota/users/{username}/size");
  const [open, setOpen] = useState(false);
  const [sizeInput, setSizeInput] = useState("");
  const [sizeUnit, setSizeUnit] = useState<"B" | "KB" | "MB" | "GB">("GB");
  const [showSizeEdit, setShowSizeEdit] = useState(false);

  const fetchQuota = useCallback(() => getUserQuota(username), [username]);
  const {
    data: quota,
    isLoading,
    error,
    refresh,
  } = useFetchData<UserQuotaType>(canView ? fetchQuota : null);

  if (!canView) return null;

  const toBytes = (value: number, unit: string): number => {
    if (value === -1) return -1;
    switch (unit) {
      case "KB": return value * 1024;
      case "MB": return value * 1024 * 1024;
      case "GB": return value * 1024 * 1024 * 1024;
      default: return value;
    }
  };

  const handleUpdateSize = async () => {
    const raw = parseFloat(sizeInput);
    if (isNaN(raw) || (raw < -1) || raw === 0) {
      toast({ title: t("common.invalidSize"), description: t("common.invalidSizeDesc") });
      return;
    }
    const value = Math.round(toBytes(raw, sizeUnit));
    try {
      await updateUserQuotaSize(username, value);
      toast({ title: t("common.quotaSizeUpdated") });
      setSizeInput("");
      setShowSizeEdit(false);
      await refresh();
    } catch (err) {
      toast({ title: t("common.errorUpdatingQuota"), description: <ErrorDisplayer error={err} /> });
    }
  };

  const handleResetSize = async () => {
    const confirmed = await confirm({
      header: t("common.resetQuotaSize"),
      message: t("users.quota.resetConfirm", { username }),
    });
    if (!confirmed) return;
    try {
      await deleteUserQuotaSize(username);
      toast({ title: t("common.quotaSizeReset") });
      await refresh();
    } catch (err) {
      toast({ title: t("common.errorResettingQuota"), description: <ErrorDisplayer error={err} /> });
    }
  };

  return (
    <div className="mt-6">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-md font-semibold hover:text-blue-600 transition"
      >
        {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        {t("users.quota.title")}
      </button>

      {open && (
        <div className="mt-2">
          {isLoading && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-2">
              <div className="h-[58px] rounded-2 animate-pulse bg-gray-200" />
              <div className="h-[58px] rounded-2 animate-pulse bg-gray-200" />
            </div>
          )}
          {error && <p className="text-red-500 mt-2">{t("common.errorPrefix", { message: error })}</p>}

          {quota && (
            <div className="p-4 bg-gray-50 rounded-2 space-y-3">
              <div>
                <h4 className="text-sm font-semibold mb-1">{t("common.occupation")}</h4>
                <div className="flex justify-between items-center py-1">
                  <span className="text-sm text-gray-600">{t("common.used")}</span>
                  <span className="text-sm">
                    <span className="mr-4">{t("common.count")} <strong>{formatCount(quota.occupation.count)}</strong></span>
                    {t("common.size")} <strong>{formatSize(quota.occupation.size)}</strong>
                  </span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-sm text-gray-600">{t("common.ratio")}</span>
                  <span className="text-sm">
                    <span className="mr-4">{t("common.count")} <strong>{(quota.occupation.ratio.count * 100).toFixed(1)}%</strong></span>
                    <span className="mr-4">{t("common.size")} <strong>{(quota.occupation.ratio.size * 100).toFixed(1)}%</strong></span>
                    Max: <strong>{(quota.occupation.ratio.max * 100).toFixed(1)}%</strong>
                  </span>
                </div>
                <div className="mt-1 w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${quota.occupation.ratio.max > 0.9 ? "bg-red-500" : quota.occupation.ratio.max > 0.7 ? "bg-yellow-500" : "bg-green-500"}`}
                    style={{ width: `${Math.min(quota.occupation.ratio.max * 100, 100)}%` }}
                  />
                </div>
              </div>

              <hr className="border-gray-200" />

              <div>
                <h4 className="text-sm font-semibold mb-1">{t("common.limits")}</h4>
                <QuotaRow label={t("common.computedEffective")} values={quota.computed} countLabel={t("common.count")} sizeLabel={t("common.size")} />
                <QuotaRow label={t("users.quota.user")} values={quota.user} countLabel={t("common.count")} sizeLabel={t("common.size")} />
                <QuotaRow label={t("common.domain")} values={quota.domain} countLabel={t("common.count")} sizeLabel={t("common.size")} />
                <QuotaRow label={t("common.global")} values={quota.global} countLabel={t("common.count")} sizeLabel={t("common.size")} />
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
                {canReset && (
                  <Button
                    variant="outline"
                    className="rounded-sm"
                    onClick={handleResetSize}
                  >
                    {t("common.resetToDomainDefault")}
                  </Button>
                )}
              </div>

              {showSizeEdit && (
                <div className="flex gap-2 mt-2">
                  <input
                    type="number"
                    value={sizeInput}
                    onChange={(e) => setSizeInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleUpdateSize()}
                    placeholder={t("common.sizeUnlimited")}
                    className="flex-1 px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <select
                    value={sizeUnit}
                    onChange={(e) => setSizeUnit(e.target.value as "B" | "KB" | "MB" | "GB")}
                    className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
          )}
        </div>
      )}
    </div>
  );
}
