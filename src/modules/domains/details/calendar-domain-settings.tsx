import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Save, Loader2, RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useIsAllowed } from "@/lib/proxy-resolver-context";
import { useFetchData } from "@/hooks/use-fetch-data";
import { getDomainSettings, updateDomainSettings } from "../api-client";
import { DomainSettings, DomainSettingsValues } from "../types";
import { useToast } from "@/hooks/use-toast";
import ErrorDisplayer from "@/components/custom/error-displayer";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Radix selects cannot hold an empty value, so a sentinel represents "null"
// (i.e. clear the setting and fall back to the system default).
const DEFAULT_SENTINEL = "__default__";

interface Props {
  domain: string;
  defaultOpen?: boolean;
}

interface Option {
  value: string;
  label: string;
}

function toValues(s: DomainSettings): DomainSettingsValues {
  return {
    userSearchMode: s.userSearchMode,
    resourceSearchEnabled: s.resourceSearchEnabled,
    defaultCalendarPublicVisibility: s.defaultCalendarPublicVisibility,
  };
}

function SettingRow({
  label,
  defaultLabel,
  value,
  options,
  disabled,
  onChange,
}: {
  label: string;
  defaultLabel: string;
  value: string;
  options: Option[];
  disabled: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium">{label}</label>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger className="w-[240px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={DEFAULT_SENTINEL}>{defaultLabel}</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export default function CalendarDomainSettings({ domain, defaultOpen = false }: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();

  const canView = useIsAllowed("GET", "/domains/{domain}/settings");
  const canUpdate = useIsAllowed("PUT", "/domains/{domain}/settings");

  const [open, setOpen] = useState(defaultOpen);

  const fetchSettings = useCallback(() => getDomainSettings(domain), [domain]);
  const { data: settings, isLoading, error, refresh } = useFetchData<DomainSettings>(
    open && canView ? fetchSettings : null
  );

  const [values, setValues] = useState<DomainSettingsValues | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings) {
      setValues(toValues(settings));
      setDirty(false);
    }
  }, [settings]);

  if (!canView) return null;

  const handleReset = () => {
    if (settings) {
      setValues(toValues(settings));
      setDirty(false);
    }
  };

  const updateField = <K extends keyof DomainSettingsValues>(
    field: K,
    val: DomainSettingsValues[K]
  ) => {
    setValues((prev) => (prev ? { ...prev, [field]: val } : prev));
    setDirty(true);
  };

  const handleSave = async () => {
    if (!values) return;
    setSaving(true);
    try {
      await updateDomainSettings(domain, values);
      toast({ title: t("domains.domainSettings.saved") });
      await refresh();
    } catch (err) {
      toast({
        title: t("domains.domainSettings.errorSaving"),
        description: <ErrorDisplayer error={err} />,
      });
    } finally {
      setSaving(false);
    }
  };

  const userSearchModeOptions: Option[] = (["enabled", "limited", "disabled"] as const).map(
    (v) => ({ value: v, label: t(`domains.domainSettings.userSearchModeOptions.${v}`) })
  );
  const visibilityOptions: Option[] = (["read", "private"] as const).map((v) => ({
    value: v,
    label: t(`domains.domainSettings.visibilityOptions.${v}`),
  }));
  const booleanOptions: Option[] = (["true", "false"] as const).map((v) => ({
    value: v,
    label: t(`domains.domainSettings.booleanOptions.${v}`),
  }));

  const defaultLabel = t("domains.domainSettings.useDefault");

  return (
    <div className="mt-6">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-2 text-md font-semibold hover:text-blue-600 transition"
        >
          {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          {t("domains.domainSettings.title")}
        </button>
      </div>

      {open && (
        <div className="mt-2">
          {isLoading && <div className="h-[40px] rounded-2 animate-pulse bg-gray-200" />}
          {error && <p className="text-red-500 mt-2">Error: {error}</p>}

          {settings && values && (
            <div className="mt-2 space-y-4 max-w-xl">
              <SettingRow
                label={t("domains.domainSettings.userSearchMode")}
                defaultLabel={defaultLabel}
                value={values.userSearchMode ?? DEFAULT_SENTINEL}
                options={userSearchModeOptions}
                disabled={!canUpdate}
                onChange={(v) =>
                  updateField(
                    "userSearchMode",
                    v === DEFAULT_SENTINEL ? null : (v as DomainSettingsValues["userSearchMode"])
                  )
                }
              />

              <SettingRow
                label={t("domains.domainSettings.resourceSearchEnabled")}
                defaultLabel={defaultLabel}
                value={
                  values.resourceSearchEnabled === null
                    ? DEFAULT_SENTINEL
                    : String(values.resourceSearchEnabled)
                }
                options={booleanOptions}
                disabled={!canUpdate}
                onChange={(v) =>
                  updateField(
                    "resourceSearchEnabled",
                    v === DEFAULT_SENTINEL ? null : v === "true"
                  )
                }
              />

              <SettingRow
                label={t("domains.domainSettings.defaultCalendarPublicVisibility")}
                defaultLabel={defaultLabel}
                value={values.defaultCalendarPublicVisibility ?? DEFAULT_SENTINEL}
                options={visibilityOptions}
                disabled={!canUpdate}
                onChange={(v) =>
                  updateField(
                    "defaultCalendarPublicVisibility",
                    v === DEFAULT_SENTINEL
                      ? null
                      : (v as DomainSettingsValues["defaultCalendarPublicVisibility"])
                  )
                }
              />

              <div className="rounded-md border bg-gray-50 p-3 text-sm">
                <p className="font-medium text-gray-700 mb-1">
                  {t("domains.domainSettings.effective")}
                </p>
                <ul className="space-y-0.5 text-gray-600">
                  <li className="flex justify-between gap-4">
                    <span>{t("domains.domainSettings.userSearchMode")}</span>
                    <span className="font-medium">
                      {t(`domains.domainSettings.userSearchModeOptions.${settings.resolved.userSearchMode}`)}
                    </span>
                  </li>
                  <li className="flex justify-between gap-4">
                    <span>{t("domains.domainSettings.resourceSearchEnabled")}</span>
                    <span className="font-medium">
                      {t(`domains.domainSettings.booleanOptions.${String(settings.resolved.resourceSearchEnabled)}`)}
                    </span>
                  </li>
                  <li className="flex justify-between gap-4">
                    <span>{t("domains.domainSettings.defaultCalendarPublicVisibility")}</span>
                    <span className="font-medium">
                      {t(`domains.domainSettings.visibilityOptions.${settings.resolved.defaultCalendarPublicVisibility}`)}
                    </span>
                  </li>
                </ul>
              </div>

              {canUpdate && dirty && (
                <div className="flex gap-2 pt-1">
                  <Button variant="outline" size="sm" onClick={handleReset} disabled={saving}>
                    <RotateCcw className="w-3.5 h-3.5 mr-1" />
                    {t("common.cancel")}
                  </Button>
                  <Button size="sm" onClick={handleSave} disabled={saving}>
                    {saving ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                    ) : (
                      <Save className="w-3.5 h-3.5 mr-1" />
                    )}
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
