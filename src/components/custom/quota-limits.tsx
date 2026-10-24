import { ReactNode, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useConfirm } from "@/hooks/use-confirm";
import { useToast } from "@/hooks/use-toast";
import { currentLocale } from "@/i18n/locale";
import { formatByteSize } from "@/i18n/format-size";
import ErrorDisplayer from "./error-displayer";
import FormDialog from "./form-dialog";

/** A count or size limit: null when none is set at this level, -1 when unlimited. */
export interface QuotaLimitValues {
  count: number | null;
  size: number | null;
}

export const NO_LIMITS: QuotaLimitValues = { count: null, size: null };

/** The WebAdmin calls of one quota level, each limit set and removed on its own. */
export interface QuotaLimitsApi {
  putCount: (count: number) => Promise<void>;
  deleteCount: () => Promise<void>;
  putSize: (size: number) => Promise<void>;
  deleteSize: () => Promise<void>;
}

const UNITS = { B: 1, KB: 1024, MB: 1024 ** 2, GB: 1024 ** 3 } as const;
type Unit = keyof typeof UNITS;
// Spelled in the UI language, as the sizes shown around: "Mo" in French
const UNIT_LABEL_KEYS: Record<Unit, string> = { B: "common.bytes", KB: "common.kb", MB: "common.mb", GB: "common.gb" };

const hasAtMostOneDecimal = (value: number) => Math.abs(value * 10 - Math.round(value * 10)) < 1e-9;

/** The largest unit giving a whole or one-decimal number: 50 MB is "50" "MB", not "0.05" "GB". */
export function toSizeField(bytes: number): { value: string; unit: Unit } {
  for (const unit of ["GB", "MB", "KB"] as const) {
    const value = bytes / UNITS[unit];
    if (value >= 1 && hasAtMostOneDecimal(value)) return { value: String(Math.round(value * 10) / 10), unit };
  }
  return { value: String(bytes), unit: "B" };
}

interface LimitField {
  value: string;
  unlimited: boolean;
}

const fieldOf = (limit: number | null, toValue: (n: number) => string): LimitField => ({
  value: limit === null || limit === -1 ? "" : toValue(limit),
  unlimited: limit === -1,
});

/** What the operator typed: a limit, -1 for unlimited, null for none at this level, undefined when invalid. */
function parse(field: LimitField, multiplier = 1): number | null | undefined {
  if (field.unlimited) return -1;
  const raw = field.value.trim();
  if (raw === "") return null;
  const n = Number(raw);
  // A message count is whole; a size may be fractional in its unit, but at least one byte
  if (!Number.isFinite(n) || (multiplier === 1 && !Number.isInteger(n))) return undefined;
  const limit = Math.round(n * multiplier);
  return limit >= 1 ? limit : undefined;
}

// Sent only when the limit changed: a value is put, an emptied field removes the limit
async function sendChange(next: number | null | undefined, current: number | null, put: (n: number) => Promise<void>, remove: () => Promise<void>) {
  if (next === undefined || next === current) return;
  await (next === null ? remove() : put(next));
}

// The size field of a limit: its value in the most readable unit, MB when there is none
function sizeFieldOf(size: number | null): { field: LimitField; unit: Unit } {
  if (size === null || size === -1) return { field: { value: "", unlimited: size === -1 }, unit: "MB" };
  const { value, unit } = toSizeField(size);
  return { field: { value, unlimited: false }, unit };
}

// KB and B only when the current limit needs them
const unitChoices = (unit: Unit): readonly Unit[] => (unit === "B" || unit === "KB" ? ["B", "KB", "MB", "GB"] : ["MB", "GB"]);

type Parents = { label: string; values: QuotaLimitValues }[];

// What an emptied field falls back to: the nearest level setting this limit, if any
const inheritedFrom = (parents: Parents, key: keyof QuotaLimitValues) => parents.find((p) => p.values[key] !== null);

interface LimitRowProps {
  id: string;
  label: string;
  field: LimitField;
  onChange: (field: LimitField) => void;
  hint: string;
  unitSelect?: ReactNode;
}

/** One limit: its value (and unit), an Unlimited box, and what applies when it is left empty. */
function LimitRow({ id, label, field, onChange, hint, unitSelect }: LimitRowProps) {
  const { t } = useTranslation();
  return (
    <fieldset className="space-y-1">
      <legend className="text-sm font-medium">{label}</legend>
      <div className="flex flex-wrap items-center gap-2">
        <input
          id={id}
          type="number"
          min="1"
          aria-label={label}
          value={field.value}
          disabled={field.unlimited}
          onChange={(e) => onChange({ ...field, value: e.target.value })}
          className="flex-1 min-w-32 px-3 py-2 border rounded-md text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
        />
        {unitSelect}
        <div className="flex items-center gap-1">
          <Checkbox
            id={`${id}-unlimited`}
            checked={field.unlimited}
            onCheckedChange={(checked) => onChange({ ...field, unlimited: checked === true })}
          />
          <label htmlFor={`${id}-unlimited`} className="text-sm cursor-pointer select-none">{t("quotaLimits.unlimited")}</label>
        </div>
      </div>
      <p className="text-xs text-gray-500">{hint}</p>
    </fieldset>
  );
}

interface Props {
  // Named in the dialog title: the user, the domain, the team mailbox, "all users"
  target: string;
  // The limits set at this level
  current: QuotaLimitValues;
  // The levels a limit is inherited from when none is set here, nearest first (none at the global level)
  parents?: Parents;
  api: QuotaLimitsApi;
  canEditCount: boolean;
  canEditSize: boolean;
  canRemove: boolean;
  removeLabel: string;
  removeConfirm: string;
  onChanged: () => void;
}

/**
 * "Edit limits" and "Remove specific limits" of a quota section, the same at the user,
 * team mailbox, domain and global levels: both limits are edited together, prefilled with
 * the current ones, in a modal.
 */
export default function QuotaLimits({ target, current, parents = [], api, canEditCount, canEditSize, canRemove, removeLabel, removeConfirm, onChanged }: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const confirm = useConfirm();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState<LimitField>({ value: "", unlimited: false });
  const [size, setSize] = useState<LimitField>({ value: "", unlimited: false });
  const [unit, setUnit] = useState<Unit>("MB");

  const canEdit = canEditCount || canEditSize;
  const canRemoveHere = canRemove && (current.count !== null || current.size !== null);

  const openDialog = () => {
    setCount(fieldOf(current.count, String));
    const sizeField = sizeFieldOf(current.size);
    setSize(sizeField.field);
    setUnit(sizeField.unit);
    setOpen(true);
  };

  const nextCount = () => (canEditCount ? parse(count) : current.count);
  const nextSize = () => (canEditSize ? parse(size, UNITS[unit]) : current.size);

  const validate = () => (nextCount() === undefined ? t("quotaLimits.invalidCount")
    : nextSize() === undefined ? t("quotaLimits.invalid")
    : null);

  const handleSave = async () => {
    await sendChange(nextCount(), current.count, api.putCount, api.deleteCount);
    await sendChange(nextSize(), current.size, api.putSize, api.deleteSize);
    toast({ title: t("quotaLimits.updated") });
    onChanged();
  };

  const handleRemove = async () => {
    if (!(await confirm({ header: removeLabel, message: removeConfirm }))) return;
    try {
      await sendChange(null, current.count, api.putCount, api.deleteCount);
      await sendChange(null, current.size, api.putSize, api.deleteSize);
      toast({ title: t("quotaLimits.removed") });
      onChanged();
    } catch (err) {
      toast({ title: t("common.errorResettingQuota"), description: <ErrorDisplayer error={err} /> });
    }
  };

  const inheritHint = (key: keyof QuotaLimitValues, format: (n: number) => string) => {
    const parent = inheritedFrom(parents, key);
    if (!parent) return t("quotaLimits.noLimitHint");
    const limit = parent.values[key]!;
    return t("quotaLimits.inheritHint", { parent: parent.label, value: limit === -1 ? t("common.unlimited") : format(limit) });
  };

  if (!canEdit && !canRemoveHere) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {canEdit && <Button variant="outline" className="rounded-sm" onClick={openDialog}>{t("quotaLimits.edit")}</Button>}
      {canRemoveHere && <Button variant="outline" className="rounded-sm" onClick={handleRemove}>{removeLabel}</Button>}
      <FormDialog
        open={open}
        onClose={() => setOpen(false)}
        title={t("quotaLimits.title", { target })}
        submitLabel={t("common.save")}
        validate={validate}
        onSubmit={handleSave}
      >
        {canEditCount && (
          <LimitRow id={`${id}-count`} label={t("quotaLimits.count")} field={count} onChange={setCount}
            hint={inheritHint("count", (n) => n.toLocaleString(currentLocale()))} />
        )}
        {canEditSize && (
          <LimitRow id={`${id}-size`} label={t("quotaLimits.size")} field={size} onChange={setSize}
            hint={inheritHint("size", formatByteSize)}
            unitSelect={
              <select
                aria-label={t("common.sizeUnit")}
                value={unit}
                disabled={size.unlimited}
                onChange={(e) => setUnit(e.target.value as Unit)}
                className="px-3 py-2 border rounded-md text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              >
                {unitChoices(unit).map((u) => <option key={u} value={u}>{t(UNIT_LABEL_KEYS[u])}</option>)}
              </select>
            } />
        )}
      </FormDialog>
    </div>
  );
}
