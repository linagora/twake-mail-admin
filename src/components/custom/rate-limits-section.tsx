import { useCallback, useEffect, useId, useState } from "react";
import { ChevronDown, ChevronRight, Loader2, Save } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
import ErrorDisplayer from "@/components/custom/error-displayer";
import { Button } from "@/components/ui/button";
import {
  RATE_LIMIT_KEYS,
  RateLimitInputs,
  RateLimits,
  invalidRateLimitKeys,
  isValidRateLimitInput,
  normalizeRateLimits,
  parseRateLimitInputs,
  toRateLimitInputs,
  toRateLimitsPayload,
} from "./rate-limits";

const EMPTY: RateLimits = normalizeRateLimits(null);
const EMPTY_INPUTS: RateLimitInputs = toRateLimitInputs(EMPTY);

interface Props {
  fetchRateLimits: () => Promise<RateLimits>;
  updateRateLimits: (limits: Partial<RateLimits>) => Promise<void>;
  defaultOpen?: boolean;
  canUpdate?: boolean;
}

export default function RateLimitsSection({ fetchRateLimits, updateRateLimits, defaultOpen, canUpdate = true }: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const idPrefix = useId();
  const [open, setOpen] = useState(defaultOpen ?? false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<RateLimitInputs>({ ...EMPTY_INPUTS });
  const [loaded, setLoaded] = useState<RateLimits>({ ...EMPTY });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = normalizeRateLimits(await fetchRateLimits());
      setForm(toRateLimitInputs(data));
      setLoaded(data);
    } catch {
      setForm({ ...EMPTY_INPUTS });
      setLoaded({ ...EMPTY });
    } finally {
      setLoading(false);
    }
  }, [fetchRateLimits]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const handleChange = (key: keyof RateLimits, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (invalidRateLimitKeys(form).length > 0) {
      toast({ title: t("rateLimits.invalid"), description: t("rateLimits.invalidDesc") });
      return;
    }
    const limits = parseRateLimitInputs(form);
    setSaving(true);
    try {
      await updateRateLimits(toRateLimitsPayload(limits, loaded));
      setLoaded(limits);
      toast({ title: t("rateLimits.updated") });
    } catch (err) {
      toast({
        title: t("rateLimits.errorUpdating"),
        description: <ErrorDisplayer error={err} />,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-6">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-md font-semibold hover:text-blue-600 transition"
      >
        {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        {t("rateLimits.sectionTitle")}
      </button>

      {open && (
        <div className="mt-2">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-2">
              <div className="h-[58px] rounded-2 animate-pulse bg-gray-200" />
            </div>
          ) : (
            <div className="p-4 bg-gray-50 rounded-2 space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-x-6 gap-y-3">
                {RATE_LIMIT_KEYS.map((key) => (
                  <div key={key} className="flex items-center justify-between gap-3">
                    <label htmlFor={`${idPrefix}-${key}`} className="text-sm text-gray-600 whitespace-nowrap">
                      {t(`rateLimits.${key}`)}
                    </label>
                    <input
                      id={`${idPrefix}-${key}`}
                      type="number"
                      min={-1}
                      step={1}
                      value={form[key]}
                      onChange={(e) => handleChange(key, e.target.value)}
                      placeholder={t("rateLimits.noLimit")}
                      aria-invalid={!isValidRateLimitInput(form[key])}
                      className="w-28 px-3 py-1.5 border aria-invalid:border-red-500 rounded-md text-sm text-right focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-400">{t("rateLimits.noLimitHint")}</p>
              {canUpdate && (
                <div className="flex justify-end">
                  <Button size="sm" onClick={handleSave} disabled={saving}>
                    {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
                    {t("common.save")}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
