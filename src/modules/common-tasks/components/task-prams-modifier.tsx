import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TaskParam } from "../types";
import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  PARAM_DESCRIPTIONS,
  paramEmptyKey,
  paramHelpKey,
  paramLabelKey,
  paramUnitKey,
  paramValueKey,
} from "../param-descriptions";

const DURATION_UNITS = ["h", "d", "w", "m", "y"] as const;

const DEFAULT_DURATION_UNIT = "d";
const DURATION_PATTERN = /^(\d+)([hdwmy])$/;

// Radix forbids an empty item value: the "no value" option of a select goes through this one.
const EMPTY_OPTION = "__empty__";

// Splits a duration default such as "30d" into the amount and unit shown by the
// duration field, so that the field and the command preview agree from the start.
const parseDuration = (value: TaskParam["defaultValue"]): { amount: string; unit: string } => {
  const match = typeof value === "string" ? DURATION_PATTERN.exec(value) : null;
  return match
    ? { amount: match[1], unit: match[2] }
    : { amount: "", unit: DEFAULT_DURATION_UNIT };
};

interface Props {
  params: TaskParam[];
  handleChangeParam: (key: string, value: string | boolean) => void;
}

/**
 * The parameters of a task as a labelled form: translated label, "(optional)" or a
 * required "*", raw query
 * key, field, unit and help. Rarely needed parameters go into a closed "Advanced options".
 */
const TaskParamsModifier = ({ params, handleChangeParam }: Props) => {
  const { t, i18n } = useTranslation();
  const idPrefix = useId();
  const fieldId = (key: string) => `${idPrefix}-${key}`;
  const helpId = (key: string) => `${idPrefix}-${key}-help`;
  const [formData, setFormData] = useState<Record<string, string | boolean>>(() => {
    const initialData: Record<string, string | boolean> = {};
    params?.forEach(param => {
      initialData[param.key] = param.defaultValue ?? "";
    });
    return initialData;
  });

  const [durationParts, setDurationParts] = useState<Record<string, { amount: string; unit: string }>>(() => {
    const initial: Record<string, { amount: string; unit: string }> = {};
    params?.forEach(param => {
      if (param.type === "duration") {
        initial[param.key] = parseDuration(param.defaultValue);
      }
    });
    return initial;
  });

  useEffect(() => {
    for (const key in formData) {
      handleChangeParam(key, formData[key]);
    }
  }, [formData]);

  const handleChange = (key: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handleDurationChange = (key: string, amount: string, unit: string) => {
    setDurationParts(prev => ({ ...prev, [key]: { amount, unit } }));
    const combined = amount ? `${amount}${unit}` : "";
    setFormData(prev => ({ ...prev, [key]: combined }));
  };

  const handleRemoveDuration = (key: string) => {
    setDurationParts(prev => ({ ...prev, [key]: { amount: "", unit: DEFAULT_DURATION_UNIT } }));
    setFormData(prev => ({ ...prev, [key]: "" }));
  };

  // An unknown parameter keeps showing its key, rather than a missing translation
  const label = (param: TaskParam) => {
    const key = param.labelKey ?? paramLabelKey(param.key);
    return i18n?.exists?.(key) ? t(key) : param.key;
  };
  const help = (param: TaskParam): string | null => {
    if (param.helpKey) return t(param.helpKey);
    return PARAM_DESCRIPTIONS[param.key]?.help ? t(paramHelpKey(param.key)) : null;
  };
  const unit = (param: TaskParam): string | null =>
    PARAM_DESCRIPTIONS[param.key]?.unit ? t(paramUnitKey(param.key)) : null;
  const optionLabel = (param: TaskParam, value: string) => {
    if (value === "") return t(paramEmptyKey(PARAM_DESCRIPTIONS[param.key]?.empty ?? "any"));
    const description = PARAM_DESCRIPTIONS[param.key];
    return description?.values || value === "true" || value === "false" ? t(paramValueKey(param.key, value)) : value;
  };
  const defaultPlaceholder = (param: TaskParam) =>
    typeof param.defaultValue === "string" && param.defaultValue
      ? t("commonTasks.params.defaultPlaceholder", { value: param.defaultValue })
      : undefined;

  const suggestionsId = (key: string) => `${idPrefix}-${key}-suggestions`;

  const renderField = (param: TaskParam) => {
    const required = param.optional === false;
    const helpText = help(param);
    const describedBy = helpText ? helpId(param.key) : undefined;
    const unitText = unit(param);
    const hasSuggestions = (param.suggestions?.length ?? 0) > 0;
    return (
      <div className="min-w-0">
        {param.type === "input" && (
          <div className="flex items-center gap-2">
            <Input
              id={fieldId(param.key)}
              aria-describedby={describedBy}
              aria-required={required || undefined}
              list={hasSuggestions ? suggestionsId(param.key) : undefined}
              autoComplete={hasSuggestions ? "off" : undefined}
              value={formData[param.key] as string}
              placeholder={defaultPlaceholder(param)}
              onChange={e => handleChange(param.key, e.target.value)}
            />
            {hasSuggestions && (
              <datalist id={suggestionsId(param.key)}>
                {param.suggestions?.map(suggestion => <option key={suggestion} value={suggestion} />)}
              </datalist>
            )}
            {unitText && <span className="text-sm text-muted-foreground whitespace-nowrap">{unitText}</span>}
          </div>
        )}
        {param.type === "checkbox" && (
          <Checkbox
            id={fieldId(param.key)}
            aria-describedby={describedBy}
            className="mt-1"
            checked={formData[param.key] as boolean}
            onCheckedChange={checked => handleChange(param.key, checked === true)}
          />
        )}
        {param.type === "select" && param.values && (
          <Select
            value={(formData[param.key] as string) || EMPTY_OPTION}
            onValueChange={value => handleChange(param.key, value === EMPTY_OPTION ? "" : value)}
          >
            <SelectTrigger id={fieldId(param.key)} aria-describedby={describedBy} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {/* Without a value, the server applies its default: a real option, not a placeholder */}
              {[...(param.values.includes("") ? [] : [""]), ...param.values].map(option => (
                <SelectItem key={option || EMPTY_OPTION} value={option || EMPTY_OPTION}>
                  {optionLabel(param, option)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {param.type === "duration" && (
          <div className="flex items-center gap-2">
            <Input
              id={fieldId(param.key)}
              aria-describedby={describedBy}
              aria-required={required || undefined}
              type="number"
              min="0"
              className="flex-1 min-w-20"
              // Empty means "no limit" only where the server accepts the parameter left out
              placeholder={required ? undefined : t("commonTasks.params.noLimit")}
              value={durationParts[param.key]?.amount ?? ""}
              onChange={e => handleDurationChange(param.key, e.target.value, durationParts[param.key]?.unit ?? "d")}
            />
            <Select
              value={durationParts[param.key]?.unit ?? "d"}
              onValueChange={unit => handleDurationChange(param.key, durationParts[param.key]?.amount ?? "", unit)}
            >
              <SelectTrigger className="w-32 shrink-0" aria-label={t("commonTasks.durationUnit", { key: label(param) })}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DURATION_UNITS.map(u => (
                  <SelectItem key={u} value={u}>
                    {t(`commonTasks.units.${u}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* A required value cannot be left out: nothing to clear */}
            {!required && (
              <Button
                variant="ghost"
                size="icon"
                aria-label={t("commonTasks.clearParam", { key: label(param) })}
                onClick={() => handleRemoveDuration(param.key)}
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        )}
        {helpText && <p id={helpId(param.key)} className="text-xs text-muted-foreground mt-1">{helpText}</p>}
      </div>
    );
  };

  const renderRows = (rows: TaskParam[]) => (
    <div className="grid grid-cols-1 sm:grid-cols-[minmax(10rem,14rem)_minmax(0,1fr)] gap-x-3 gap-y-1 sm:gap-y-3 items-start">
      {rows.map(param => (
        <div key={param.key} className="contents">
          <div className="pt-0 sm:pt-2 mt-2 sm:mt-0">
            <label htmlFor={fieldId(param.key)} className="text-sm font-medium">
              {label(param)}
              {param.optional === false ? (
                <> <span className="text-red-500">*</span></>
              ) : (
                <span className="font-normal text-muted-foreground"> ({t("common.optional")})</span>
              )}
            </label>
            {/* Keeps the link with the command preview and the WebAdmin documentation */}
            <div className="font-mono text-xs text-muted-foreground">{param.key}</div>
          </div>
          {renderField(param)}
        </div>
      ))}
    </div>
  );

  const basic = params?.filter(param => !param.advanced) ?? [];
  const advanced = params?.filter(param => param.advanced) ?? [];

  return (
    // Marks the dialog that holds it, which then widens to fit the label and field columns
    <div data-task-params className="space-y-3">
      {basic.length > 0 && renderRows(basic)}
      {advanced.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground">{t("common.advancedOptions")}</summary>
          <div className="mt-2">{renderRows(advanced)}</div>
        </details>
      )}
    </div>
  );
};

export default TaskParamsModifier;
