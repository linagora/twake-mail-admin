import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Loader2, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import ErrorDisplayer from "@/components/custom/error-displayer";
import { Button } from "@/components/ui/button";

export interface RateLimits {
  mailsSentPerMinute: number | null;
  mailsSentPerHours: number | null;
  mailsSentPerDays: number | null;
  mailsReceivedPerMinute: number | null;
  mailsReceivedPerHours: number | null;
  mailsReceivedPerDays: number | null;
}

const EMPTY: RateLimits = {
  mailsSentPerMinute: null,
  mailsSentPerHours: null,
  mailsSentPerDays: null,
  mailsReceivedPerMinute: null,
  mailsReceivedPerHours: null,
  mailsReceivedPerDays: null,
};

const FIELDS: { key: keyof RateLimits; label: string }[] = [
  { key: "mailsSentPerMinute", label: "Mails sent / minute" },
  { key: "mailsSentPerHours", label: "Mails sent / hour" },
  { key: "mailsSentPerDays", label: "Mails sent / day" },
  { key: "mailsReceivedPerMinute", label: "Mails received / minute" },
  { key: "mailsReceivedPerHours", label: "Mails received / hour" },
  { key: "mailsReceivedPerDays", label: "Mails received / day" },
];

interface Props {
  fetchRateLimits: () => Promise<RateLimits>;
  updateRateLimits: (limits: RateLimits) => Promise<void>;
}

export default function RateLimitsSection({ fetchRateLimits, updateRateLimits }: Props) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<RateLimits>({ ...EMPTY });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchRateLimits();
      setForm({
        mailsSentPerMinute: data.mailsSentPerMinute ?? null,
        mailsSentPerHours: data.mailsSentPerHours ?? null,
        mailsSentPerDays: data.mailsSentPerDays ?? null,
        mailsReceivedPerMinute: data.mailsReceivedPerMinute ?? null,
        mailsReceivedPerHours: data.mailsReceivedPerHours ?? null,
        mailsReceivedPerDays: data.mailsReceivedPerDays ?? null,
      });
    } catch {
      setForm({ ...EMPTY });
    } finally {
      setLoading(false);
    }
  }, [fetchRateLimits]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const handleChange = (key: keyof RateLimits, value: string) => {
    const trimmed = value.trim();
    setForm((prev) => ({
      ...prev,
      [key]: trimmed === "" ? null : parseInt(trimmed),
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateRateLimits(form);
      toast({ title: "Rate limits updated" });
    } catch (err) {
      toast({
        title: "Error updating rate limits",
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
        Rate Limiting
      </button>

      {open && (
        <div className="mt-2">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-2">
              <div className="h-[58px] rounded-2 animate-pulse bg-gray-200" />
            </div>
          ) : (
            <div className="p-4 bg-gray-50 rounded-2 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
                {FIELDS.map(({ key, label }) => (
                  <div key={key} className="flex items-center justify-between gap-3">
                    <label className="text-sm text-gray-600 whitespace-nowrap">{label}</label>
                    <input
                      type="number"
                      value={form[key] === null ? "" : form[key]}
                      onChange={(e) => handleChange(key, e.target.value)}
                      placeholder="no limit"
                      className="w-28 px-3 py-1.5 border rounded-md text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-400">Leave empty for no limit (null).</p>
              <div className="flex justify-end">
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
                  Save
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
