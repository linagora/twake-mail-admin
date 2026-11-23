import { useCallback, useEffect, useId, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
import ErrorDisplayer from "@/components/custom/error-displayer";
import { Button } from "@/components/ui/button";
import {
  RATE_LIMIT_KEYS,
  RateLimitInputs,
  RateLimits,
  invalidRateLimitKeys,
  normalizeRateLimits,
  parseRateLimitInputs,
  toRateLimitInputs,
  toRateLimitsPayload,
} from "./rate-limits";
import { SectionToggle, useSectionOpen } from "@/components/custom/collapsible-section";

const EMPTY: RateLimits = normalizeRateLimits(null);
const EMPTY_INPUTS: RateLimitInputs = toRateLimitInputs(EMPTY);

interface Props {
  fetchRateLimits: () => Promise<RateLimits>;
  updateRateLimits: (limits: Partial<RateLimits>) => Promise<void>;
  defaultOpen?: boolean;
  canUpdate?: boolean;
}

const withMembership = <T,>(set: ReadonlySet<T>, item: T, member: boolean): ReadonlySet<T> => {
  if (set.has(item) === member) return set;
  const next = new Set(set);
  if (member) next.add(item);
  else next.delete(item);
  return next;
};

export default function RateLimitsSection({ fetchRateLimits, updateRateLimits, defaultOpen, canUpdate = true }: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const idPrefix = useId();
  const [open, setOpen, openContentId] = useSectionOpen("rate-limits", defaultOpen ?? false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<RateLimitInputs>({ ...EMPTY_INPUTS });
  const [loaded, setLoaded] = useState<RateLimits>({ ...EMPTY });
  // A number input reports text it cannot parse (e.g. "abc", "1e") as an empty value: track it apart so that it is
  // refused instead of being saved as "no limit".
  const [unparsable, setUnparsable] = useState<ReadonlySet<keyof RateLimits>>(new Set());
  const invalidKeys = new Set([...invalidRateLimitKeys(form), ...unparsable]);

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
      setUnparsable(new Set());
      setLoading(false);
    }
  }, [fetchRateLimits]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const handleChange = (key: keyof RateLimits, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  // Listens to input, not change: React drops the change event while unparsable text keeps the value empty.
  const handleInput = (key: keyof RateLimits, input: HTMLInputElement) => {
    setUnparsable((prev) => withMembership(prev, key, input.validity?.badInput ?? false));
  };

  const handleSave = async () => {
    if (invalidKeys.size > 0) return;
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
      <SectionToggle open={open} onToggle={() => setOpen(!open)} controls={openContentId}>
        {t("rateLimits.sectionTitle")}
      </SectionToggle>

      {open && (
        <div id={openContentId} className="mt-2">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-2">
              <div className="h-[58px] rounded-2 animate-pulse bg-gray-200" />
            </div>
          ) : (
            <div className="p-4 bg-gray-50 rounded-2 space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-x-6 gap-y-3">
                {RATE_LIMIT_KEYS.map((key) => {
                  const id = `${idPrefix}-${key}`;
                  const invalid = invalidKeys.has(key);
                  return (
                    <div key={key}>
                      <div className="flex items-center justify-between gap-3">
                        <label htmlFor={id} className="min-w-0 text-sm text-gray-600">
                          {t(`rateLimits.${key}`)}
                        </label>
                        <input
                          id={id}
                          type="number"
                          min={-1}
                          step={1}
                          value={form[key]}
                          onChange={(e) => handleChange(key, e.target.value)}
                          onInput={(e) => handleInput(key, e.currentTarget)}
                          placeholder={t("rateLimits.noLimit")}
                          aria-invalid={invalid}
                          aria-describedby={invalid ? `${id}-error` : undefined}
                          className="w-28 shrink-0 px-3 py-1.5 border aria-invalid:border-red-500 rounded-md text-sm text-right focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      {invalid && (
                        <p id={`${id}-error`} role="alert" className="mt-1 text-xs text-right text-red-600">
                          {t("rateLimits.invalidDesc")}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-gray-400">{t("rateLimits.noLimitHint")}</p>
              {canUpdate && (
                <div className="flex justify-end">
                  <Button size="sm" onClick={handleSave} disabled={saving || invalidKeys.size > 0}>
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
