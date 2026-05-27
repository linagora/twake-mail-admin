import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Plus, Trash2, Save, Loader2, RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useIsAllowed } from "@/lib/proxy-resolver-context";
import { useFetchData } from "@/hooks/use-fetch-data";
import { getUserJmapSettings, updateUserJmapSettings } from "../api-client";
import { useToast } from "@/hooks/use-toast";
import ErrorDisplayer from "@/components/custom/error-displayer";
import { Button } from "@/components/ui/button";

const KEY_REGEX = /^[a-zA-Z0-9.\-_#]{1,255}$/;

interface Row {
  id: number;
  key: string;
  value: string;
}

let nextId = 0;

function settingsToRows(settings: Record<string, string>): Row[] {
  return Object.entries(settings).map(([key, value]) => ({ id: nextId++, key, value }));
}

interface Props {
  username: string;
}

export default function UserJmapSettings({ username }: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();

  const canView = useIsAllowed("GET", "/users/{username}/jmap/settings");
  const canUpdate = useIsAllowed("PUT", "/users/{username}/jmap/settings");

  const [open, setOpen] = useState(false);

  const fetchSettings = useCallback(() => getUserJmapSettings(username), [username]);
  const { data: settings, isLoading, error, refresh } = useFetchData<Record<string, string>>(
    open && canView ? fetchSettings : null
  );

  const [rows, setRows] = useState<Row[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<number, string>>({});

  useEffect(() => {
    if (settings) {
      setRows(settingsToRows(settings));
      setDirty(false);
      setValidationErrors({});
    }
  }, [settings]);

  if (!canView) return null;

  const handleReset = () => {
    if (settings) {
      setRows(settingsToRows(settings));
      setDirty(false);
      setValidationErrors({});
    }
  };

  const updateRow = (id: number, field: "key" | "value", val: string) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: val } : r)));
    if (field === "key") {
      setValidationErrors((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
    setDirty(true);
  };

  const addRow = () => {
    setRows((prev) => [...prev, { id: nextId++, key: "", value: "" }]);
    setDirty(true);
  };

  const removeRow = (id: number) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
    setValidationErrors((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setDirty(true);
  };

  const handleSave = async () => {
    const errors: Record<number, string> = {};
    const seenKeys = new Set<string>();

    for (const row of rows) {
      if (!row.key.trim()) {
        errors[row.id] = t("users.jmapSettings.keyRequired");
        continue;
      }
      if (!KEY_REGEX.test(row.key)) {
        errors[row.id] = t("users.jmapSettings.invalidKeyDesc");
        continue;
      }
      if (seenKeys.has(row.key)) {
        errors[row.id] = t("users.jmapSettings.keyAlreadyExists");
        continue;
      }
      seenKeys.add(row.key);
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    setSaving(true);
    try {
      const map: Record<string, string> = {};
      for (const row of rows) {
        map[row.key] = row.value;
      }
      await updateUserJmapSettings(username, map);
      toast({ title: t("users.jmapSettings.saved") });
      await refresh();
    } catch (err) {
      toast({ title: t("users.jmapSettings.errorSaving"), description: <ErrorDisplayer error={err} /> });
    } finally {
      setSaving(false);
    }
  };

  const savedCount = settings ? Object.keys(settings).length : null;

  return (
    <div className="mt-6">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-2 text-md font-semibold hover:text-blue-600 transition"
        >
          {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          {t("users.jmapSettings.title")}
          {savedCount !== null && (
            <span className="text-sm font-normal text-gray-500">({savedCount})</span>
          )}
        </button>
      </div>

      {open && (
        <div className="mt-2">
          {isLoading && (
            <div className="h-[40px] rounded-2 animate-pulse bg-gray-200" />
          )}
          {error && <p className="text-red-500 mt-2">Error: {error}</p>}

          {settings && (
            <div className="mt-2 space-y-1">
              {rows.length === 0 && !canUpdate && (
                <p className="text-sm text-gray-500">{t("users.jmapSettings.empty")}</p>
              )}

              {rows.map((row) => (
                <div key={row.id} className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <input
                      type="text"
                      value={row.key}
                      onChange={(e) => updateRow(row.id, "key", e.target.value)}
                      placeholder={t("users.jmapSettings.keyPlaceholder")}
                      disabled={!canUpdate}
                      className={`w-full px-3 py-1.5 border rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-600 ${
                        validationErrors[row.id] ? "border-red-400" : ""
                      }`}
                    />
                    {validationErrors[row.id] && (
                      <p className="text-xs text-red-500 mt-0.5">{validationErrors[row.id]}</p>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <input
                      type="text"
                      value={row.value}
                      onChange={(e) => updateRow(row.id, "value", e.target.value)}
                      placeholder={t("users.jmapSettings.valuePlaceholder")}
                      disabled={!canUpdate}
                      className="w-full px-3 py-1.5 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-600"
                    />
                  </div>
                  {canUpdate && (
                    <button
                      onClick={() => removeRow(row.id)}
                      className="mt-0.5 p-1.5 rounded-md hover:bg-gray-200 flex-shrink-0"
                      title={t("users.jmapSettings.removeRow")}
                    >
                      <Trash2 className="w-3.5 h-3.5 text-red-500" />
                    </button>
                  )}
                </div>
              ))}

              {canUpdate && (
                <div className="flex items-center justify-between pt-2">
                  <button
                    onClick={addRow}
                    className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {t("users.jmapSettings.addRow")}
                  </button>
                  {dirty && (
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={handleReset} disabled={saving}>
                        <RotateCcw className="w-3.5 h-3.5 mr-1" />
                        {t("common.cancel")}
                      </Button>
                      <Button size="sm" onClick={handleSave} disabled={saving}>
                        {saving
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                          : <Save className="w-3.5 h-3.5 mr-1" />}
                        {t("common.save")}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
