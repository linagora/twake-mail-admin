import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { getDomainQuota, updateDomainQuota } from "../api-client";
import { DomainQuota, DomainQuotaValues } from "../types";
import { useToast } from "@/hooks/use-toast";
import ErrorDisplayer from "@/components/custom/error-displayer";
import { Button } from "@/components/ui/button";
import ExploreUserQuota from "@/components/custom/explore-user-quota";
import { useIsAllowed } from "@/lib/proxy-resolver-context";

interface Props {
  domain: string;
  defaultOpen?: boolean;
}

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

function QuotaRow({ label, values }: { label: string; values: DomainQuotaValues | null }) {
  if (!values) return null;
  return (
    <div className="flex justify-between items-center py-1">
      <span className="text-sm text-gray-600 capitalize">{label}</span>
      <span className="text-sm">
        <span className="mr-4">Count: <strong>{formatCount(values.count)}</strong></span>
        Size: <strong>{formatSize(values.size)}</strong>
      </span>
    </div>
  );
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

export default function DomainQuotaSection({ domain, defaultOpen }: Props) {
  const { toast } = useToast();
  const canView = useIsAllowed("GET", "/quota/domains/{domain}");
  const canUpdate = useIsAllowed("PUT", "/quota/domains/{domain}");
  const [open, setOpen] = useState(defaultOpen ?? false);
  const [loading, setLoading] = useState(false);
  const [quota, setQuota] = useState<DomainQuota | null>(null);
  const [showSizeEdit, setShowSizeEdit] = useState(false);
  const [sizeInput, setSizeInput] = useState("");
  const [sizeUnit, setSizeUnit] = useState<"B" | "KB" | "MB" | "GB">("GB");

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
    if (open) fetchQuota();
  }, [open, fetchQuota]);

  if (!canView) return null;

  const handleUpdateSize = async () => {
    const raw = parseFloat(sizeInput);
    if (isNaN(raw) || (raw < -1) || raw === 0) {
      toast({ title: "Invalid size", description: "Enter a positive number or -1 for unlimited." });
      return;
    }
    const bytes = Math.round(toBytes(raw, sizeUnit));
    try {
      await updateDomainQuota(domain, {
        count: quota?.domain?.count ?? null,
        size: bytes,
      });
      toast({ title: "Domain quota size updated" });
      setSizeInput("");
      setShowSizeEdit(false);
      await fetchQuota();
    } catch (err) {
      toast({ title: "Error updating quota size", description: <ErrorDisplayer error={err} /> });
    }
  };

  return (
    <div className="mt-6">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-md font-semibold hover:text-blue-600 transition"
      >
        {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        Quota
      </button>

      {open && (
        <div className="mt-2">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-2">
              <div className="h-[58px] rounded-2 animate-pulse bg-gray-200" />
            </div>
          ) : quota ? (
            <div className="p-4 bg-gray-50 rounded-2 space-y-3">
              <div>
                <h4 className="text-sm font-semibold mb-1">Limits</h4>
                <QuotaRow label="Computed (effective)" values={quota.computed} />
                <QuotaRow label="Domain" values={quota.domain} />
                <QuotaRow label="Global" values={quota.global} />
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
          ) : (
            <p className="text-sm text-muted-foreground">Could not load quota.</p>
          )}

        </div>
      )}

      {open && <ExploreUserQuota domain={domain} />}
    </div>
  );
}
