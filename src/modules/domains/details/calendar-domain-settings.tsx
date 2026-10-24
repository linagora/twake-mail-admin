import { useCallback, useEffect, useId, useState } from "react";
import { Save, Loader2, RotateCcw } from "lucide-react";
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
import { SectionToggle, useSectionOpen } from "@/components/custom/collapsible-section";

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
    calendarPublicVisibilitySettingEnabled: s.calendarPublicVisibilitySettingEnabled,
  };
}

export function SettingRow({
  label,
  hint,
  defaultLabel,
  value,
  options,
  disabled,
  onChange,
}: {
  label: string;
  // What the setting changes for the users of the domain
  hint?: string;
  defaultLabel: string;
  value: string;
  options: Option[];
  disabled: boolean;
  onChange: (v: string) => void;
}) {
  const triggerId = useId();
  const hintId = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={triggerId} className="text-sm font-medium">{label}</label>
      {hint && <p id={hintId} className="text-xs text-gray-500">{hint}</p>}
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger id={triggerId} className="w-[240px]" aria-describedby={hint ? hintId : undefined}>
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

type Field = keyof DomainSettingsValues;

// Each setting: the key of its option labels, and its values as the select holds them
const FIELDS: { field: Field; optionsKey: string; values: string[] }[] = [
  { field: "userSearchMode", optionsKey: "userSearchModeOptions", values: ["enabled", "limited", "disabled"] },
  { field: "resourceSearchEnabled", optionsKey: "booleanOptions", values: ["true", "false"] },
  { field: "defaultCalendarPublicVisibility", optionsKey: "visibilityOptions", values: ["read", "private"] },
  { field: "calendarPublicVisibilitySettingEnabled", optionsKey: "booleanOptions", values: ["true", "false"] },
];

const BOOLEAN_FIELDS: Field[] = ["resourceSearchEnabled", "calendarPublicVisibilitySettingEnabled"];

const toSelect = (value: DomainSettingsValues[Field]): string => (value === null ? DEFAULT_SENTINEL : String(value));

const fromSelect = (field: Field, value: string): DomainSettingsValues[Field] =>
  value === DEFAULT_SENTINEL ? null : BOOLEAN_FIELDS.includes(field) ? value === "true" : (value as DomainSettingsValues[Field]);

export default function CalendarDomainSettings({ domain, defaultOpen = false }: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();

  const canView = useIsAllowed("GET", "/domains/{domain}/settings");
  const canUpdate = useIsAllowed("PUT", "/domains/{domain}/settings");

  const [open, setOpen, openContentId] = useSectionOpen("settings", defaultOpen);

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

  const updateField = (field: Field, val: DomainSettingsValues[Field]) => {
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

  const optionLabel = (optionsKey: string, value: string) => t(`domains.domainSettings.${optionsKey}.${value}`);

  // The system default is known only while nothing is stored: the resolved value is then that default
  const systemDefault = (field: Field, optionsKey: string): string | null =>
    settings && settings[field] === null ? optionLabel(optionsKey, String(settings.resolved[field])) : null;

  const defaultLabel = (field: Field, optionsKey: string) => {
    const value = systemDefault(field, optionsKey);
    return value ? t("domains.domainSettings.useDefaultWithValue", { value }) : t("domains.domainSettings.useDefault");
  };

  // What applies once saved: the value picked, or the system default it falls back to
  const effective = (field: Field, optionsKey: string): { label: string; pending: boolean } => {
    if (!settings || !values) return { label: "", pending: false };
    const picked = values[field];
    if (picked === settings[field]) return { label: optionLabel(optionsKey, String(settings.resolved[field])), pending: false };
    const label = picked === null
      ? systemDefault(field, optionsKey) ?? t("domains.domainSettings.useDefault")
      : optionLabel(optionsKey, String(picked));
    return { label, pending: true };
  };

  return (
    <div className="mt-6">
      <div className="flex items-center gap-2">
        <SectionToggle open={open} onToggle={() => setOpen(!open)} controls={openContentId}>
          {t("domains.domainSettings.title")}
        </SectionToggle>
      </div>

      {open && (
        <div id={openContentId} className="mt-2">
          {isLoading && <div className="h-[40px] rounded-2 animate-pulse bg-gray-200" />}
          {error && <p className="text-red-500 mt-2">{t("common.errorPrefix", { message: error })}</p>}

          {settings && values && (
            <div className="mt-2 space-y-4 max-w-xl">
              {FIELDS.map(({ field, optionsKey, values: choices }) => (
                <SettingRow
                  key={field}
                  label={t(`domains.domainSettings.${field}`)}
                  hint={t(`domains.domainSettings.hints.${field}`)}
                  defaultLabel={defaultLabel(field, optionsKey)}
                  value={toSelect(values[field])}
                  options={choices.map((value) => ({ value, label: optionLabel(optionsKey, value) }))}
                  disabled={!canUpdate}
                  onChange={(v) => updateField(field, fromSelect(field, v))}
                />
              ))}

              {/* Right under the selects, visible as soon as a change is made */}
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

              <div className="rounded-md border bg-gray-50 p-3 text-sm">
                <p className="font-medium text-gray-700 mb-1">
                  {t("domains.domainSettings.effective")}
                </p>
                <ul className="space-y-0.5 text-gray-600">
                  {FIELDS.map(({ field, optionsKey }) => {
                    const { label, pending } = effective(field, optionsKey);
                    return (
                      <li key={field} className="flex justify-between gap-4">
                        <span>{t(`domains.domainSettings.${field}`)}</span>
                        <span className="font-medium">
                          {label}
                          {pending && <> <span className="font-normal text-gray-500">{t("domains.domainSettings.notSaved")}</span></>}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
