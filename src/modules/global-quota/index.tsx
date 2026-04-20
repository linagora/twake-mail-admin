import { useCallback, useState } from "react";
import { useIsAllowed } from "@/lib/proxy-resolver-context";
import { useFetchData } from "@/hooks/use-fetch-data";
import { getGlobalQuota, updateGlobalQuota, getUsersWithSpecificQuotas, getQuotaExtraSummary } from "./api-client";
import { GlobalQuotaValues, UserSpecificQuota, QuotaExtraSummary } from "./types";
import { useToast } from "@/hooks/use-toast";
import ErrorDisplayer from "@/components/custom/error-displayer";
import Header from "@/components/custom/header";
import { Button } from "@/components/ui/button";
import ExploreUserQuota from "@/components/custom/explore-user-quota";

const headerSubTitle = "Global quota applied to all users by default.";
const docuUrl = "https://james.staged.apache.org/james-project/3.9.0/servers/distributed/operate/webadmin.html#_administrating_quotas";

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
  const { toast } = useToast();
  const canUpdate = useIsAllowed("PUT", "/quota");

  const fetchAll = useCallback(async () => {
    const [quota, users, summary] = await Promise.all([
      getGlobalQuota(),
      getUsersWithSpecificQuotas(),
      getQuotaExtraSummary(),
    ]);
    return { quota, users, summary };
  }, []);

  const { data, isLoading, error, refresh } = useFetchData<{
    quota: GlobalQuotaValues;
    users: UserSpecificQuota[];
    summary: QuotaExtraSummary;
  }>(fetchAll);

  const [showSizeEdit, setShowSizeEdit] = useState(false);
  const [sizeInput, setSizeInput] = useState("");
  const [sizeUnit, setSizeUnit] = useState<"B" | "KB" | "MB" | "GB">("GB");

  const handleUpdateSize = async () => {
    const raw = parseFloat(sizeInput);
    if (isNaN(raw) || raw < -1 || raw === 0) {
      toast({ title: "Invalid size", description: "Enter a positive number or -1 for unlimited." });
      return;
    }
    const bytes = Math.round(toBytes(raw, sizeUnit));
    try {
      await updateGlobalQuota({
        count: data?.quota.count ?? null,
        size: bytes,
      });
      toast({ title: "Global quota size updated" });
      setSizeInput("");
      setShowSizeEdit(false);
      refresh();
    } catch (err) {
      toast({ title: "Error updating global quota", description: <ErrorDisplayer error={err} /> });
    }
  };

  return (
    <div className="p-4 w-fit">
      <Header headerSubTitle={headerSubTitle} docuUrl={docuUrl} />

      <div className="mt-4">
        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="h-[58px] rounded-2 animate-pulse bg-gray-200" />
            <div className="h-[58px] rounded-2 animate-pulse bg-gray-200" />
          </div>
        )}
        {error && <p className="text-red-500 mt-2">Error: {error}</p>}

        {data && (
          <div className="space-y-6">
            {/* Current global quota */}
            <div className="p-4 bg-gray-50 rounded-2 space-y-3">
              <h4 className="text-sm font-semibold">Current global quota</h4>
              <div className="flex justify-between items-center py-1">
                <span className="text-sm text-gray-600">Count</span>
                <strong className="text-sm">{formatCount(data.quota.count)}</strong>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-sm text-gray-600">Size</span>
                <strong className="text-sm">{formatSize(data.quota.size)}</strong>
              </div>

              <hr className="border-gray-200" />

              {canUpdate && (
                <Button
                  variant="outline"
                  className="rounded-sm"
                  onClick={() => setShowSizeEdit(!showSizeEdit)}
                >
                  Update size limit
                </Button>
              )}

              {showSizeEdit && (
                <div className="flex gap-2 mt-2">
                  <input
                    type="number"
                    value={sizeInput}
                    onChange={(e) => setSizeInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleUpdateSize()}
                    placeholder="-1 for unlimited"
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
                    Save
                  </button>
                </div>
              )}
            </div>

            {/* Aggregated extra quotas */}
            <div className="p-4 bg-gray-50 rounded-2 space-y-3">
              <h4 className="text-sm font-semibold">Aggregated extra quotas</h4>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <span className="text-gray-600">Total extra storage:</span>
                <strong>{formatSize(data.summary.totalExtraStorageLimit)}</strong>
                <span className="text-gray-600">Total extra count:</span>
                <strong>{formatCount(data.summary.totalExtraCountLimit)}</strong>
                <span className="text-gray-600">Users with unlimited storage:</span>
                <strong>{data.summary.totalUnlimitedStorage}</strong>
                <span className="text-gray-600">Users with unlimited count:</span>
                <strong>{data.summary.totalUnlimitedCount}</strong>
              </div>
            </div>

            {/* Users with specific quotas */}
            <div className="p-4 bg-gray-50 rounded-2 space-y-3">
              <h4 className="text-sm font-semibold">Users with specific quotas ({data.users.length})</h4>
              {data.users.length === 0 ? (
                <p className="text-sm text-muted-foreground">No users have specific quotas.</p>
              ) : (
                <div className="space-y-1">
                  {data.users.map((u, i) => (
                    <div key={u.user} className="flex justify-between items-center py-1 text-sm">
                      <span>
                        <span className="text-gray-500 mr-2">{i + 1}/</span>
                        <a
                          href={`/users/user/${encodeURIComponent(u.user)}`}
                          className="text-blue-600 hover:underline"
                        >
                          {u.user}
                        </a>
                      </span>
                      <span>
                        <span className="mr-4">Count: <strong>{formatCount(u.countLimit)}</strong></span>
                        Size: <strong>{formatSize(u.storageLimit)}</strong>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <ExploreUserQuota />
      </div>
    </div>
  );
}
