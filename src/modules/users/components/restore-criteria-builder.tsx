import { useState, useEffect, useId } from "react";
import { Plus, Trash2, Info } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { datetimeLocalToIso, isoToDatetimeLocal } from "@/lib/datetime-local";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RestoreCriterion } from "../types";

const FIELD_CONFIG: Record<string, { operators: string[]; inputType: string }> = {
  messageId: {
    operators: ["equals"],
    inputType: "text",
  },
  subject: {
    operators: ["contains", "containsIgnoreCase", "equals", "equalsIgnoreCase"],
    inputType: "text",
  },
  deliveryDate: {
    operators: ["beforeOrEquals", "afterOrEquals"],
    inputType: "datetime-local",
  },
  deletionDate: {
    operators: ["beforeOrEquals", "afterOrEquals"],
    inputType: "datetime-local",
  },
  sender: {
    operators: ["equals"],
    inputType: "text",
  },
  recipients: {
    operators: ["contains"],
    inputType: "text",
  },
  hasAttachment: {
    operators: ["equals"],
    inputType: "checkbox",
  },
  originMailboxes: {
    operators: ["contains"],
    inputType: "text",
  },
};

const FIELD_NAMES = Object.keys(FIELD_CONFIG);

const getInputType = (fieldName: string) => {
  return FIELD_CONFIG[fieldName]?.inputType || "text";
};

interface CriterionRow {
  fieldName: string;
  operator: string;
  value: string;
}

interface Props {
  onChange: (criteria: RestoreCriterion[], limit: number | undefined, isValid: boolean) => void;
  /** Mark the empty controls of the incomplete criteria as invalid. */
  flagIncomplete?: boolean;
  /**
   * Show the hint telling why incomplete criteria block the request. Off when the host reports
   * it itself, such as a confirmation dialog showing the error returned by its validator.
   */
  showIncompleteMessage?: boolean;
}

const isComplete = (c: CriterionRow) => Boolean(c.fieldName && c.operator && c.value);

export default function RestoreCriteriaBuilder({ onChange, flagIncomplete = false, showIncompleteMessage = true }: Props) {
  const { t } = useTranslation();
  const limitId = useId();
  const [criteria, setCriteria] = useState<CriterionRow[]>([]);
  const [limit, setLimit] = useState<string>("");

  useEffect(() => {
    const parsedLimit = limit ? parseInt(limit, 10) : undefined;
    onChange(
      criteria.filter(isComplete),
      Number.isNaN(parsedLimit) ? undefined : parsedLimit,
      criteria.every(isComplete)
    );
  }, [criteria, limit]);

  const addCriterion = () => {
    setCriteria([...criteria, { fieldName: "", operator: "", value: "" }]);
  };

  const removeCriterion = (index: number) => {
    setCriteria(criteria.filter((_, i) => i !== index));
  };

  const updateCriterion = (
    index: number,
    field: keyof CriterionRow,
    value: string
  ) => {
    setCriteria(
      criteria.map((c, i) => {
        if (i !== index) return c;
        if (field === "fieldName") {
          return { fieldName: value, operator: "", value: "" };
        }
        if (field === "operator" && getInputType(c.fieldName) === "checkbox" && !c.value) {
          return { ...c, operator: value, value: "false" };
        }
        return { ...c, [field]: value };
      })
    );
  };

  const getOperators = (fieldName: string) => {
    return FIELD_CONFIG[fieldName]?.operators || [];
  };

  return (
    <div className="space-y-4 w-full">
      <p className="text-sm text-muted-foreground">
        {t("users.deletedVault.criteria.description")}
      </p>

      {criteria.map((criterion, index) => {
        const inputType = getInputType(criterion.fieldName);
        const operators = getOperators(criterion.fieldName);
        const flagged = flagIncomplete && !isComplete(criterion);

        // The value and its remove button wrap to their own line when the selects leave them too little room
        return (
          <div key={index} className="flex flex-wrap items-center gap-2 min-w-0">
            <div className="flex gap-2 min-w-0">
              <Select
                value={criterion.fieldName}
                onValueChange={(v) => updateCriterion(index, "fieldName", v)}
              >
                <SelectTrigger
                  className="w-[160px] min-w-0 aria-invalid:border-red-500"
                  aria-invalid={flagged && !criterion.fieldName}
                  aria-label={t("users.deletedVault.criteria.fieldPlaceholder")}
                >
                  <SelectValue placeholder={t("users.deletedVault.criteria.fieldPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {FIELD_NAMES.map((name) => (
                    <SelectItem key={name} value={name}>
                      {t(`users.deletedVault.${name}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={criterion.operator}
                onValueChange={(v) => updateCriterion(index, "operator", v)}
                disabled={!criterion.fieldName}
              >
                <SelectTrigger
                  className="w-[180px] min-w-0 aria-invalid:border-red-500"
                  aria-invalid={flagged && !criterion.operator}
                  aria-label={t("users.deletedVault.criteria.operatorPlaceholder")}
                >
                  <SelectValue placeholder={t("users.deletedVault.criteria.operatorPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {operators.map((op) => (
                    <SelectItem key={op} value={op}>
                      {t(`users.deletedVault.operators.${op}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-1 basis-48 items-center gap-2 min-w-0">
              {inputType === "checkbox" ? (
                <div className="flex flex-1 items-center gap-2">
                  <Checkbox
                    checked={criterion.value === "true"}
                    onCheckedChange={(checked) =>
                      updateCriterion(
                        index,
                        "value",
                        checked ? "true" : "false"
                      )
                    }
                    disabled={!criterion.operator}
                    aria-invalid={flagged && !criterion.value}
                    aria-label={t("users.deletedVault.criteria.valuePlaceholder")}
                  />
                  <span className="text-sm" aria-hidden="true">
                    {criterion.value === "true" ? "true" : "false"}
                  </span>
                </div>
              ) : inputType === "datetime-local" ? (
                <Input
                  type="datetime-local"
                  className="flex-1 min-w-0 aria-invalid:border-red-500"
                  aria-label={t("users.deletedVault.criteria.valuePlaceholder")}
                  aria-invalid={flagged && !criterion.value}
                  disabled={!criterion.operator}
                  value={isoToDatetimeLocal(criterion.value)}
                  onChange={(e) =>
                    updateCriterion(
                      index,
                      "value",
                      datetimeLocalToIso(e.target.value)
                    )
                  }
                />
              ) : (
                <Input
                  type="text"
                  className="flex-1 min-w-0 aria-invalid:border-red-500"
                  placeholder={t("users.deletedVault.criteria.valuePlaceholder")}
                  aria-invalid={flagged && !criterion.value}
                  disabled={!criterion.operator}
                  value={criterion.value}
                  onChange={(e) =>
                    updateCriterion(index, "value", e.target.value)
                  }
                />
              )}

              <Button
                variant="ghost"
                size="icon"
                className="shrink-0"
                onClick={() => removeCriterion(index)}
                aria-label={t("users.deletedVault.criteria.removeCriterion")}
                title={t("users.deletedVault.criteria.removeCriterion")}
              >
                <Trash2 className="w-4 h-4 text-red-500" />
              </Button>
            </div>
          </div>
        );
      })}

      {showIncompleteMessage && !criteria.every(isComplete) && (
        // A hint while the criteria are being typed, not an error: calm colour, polite announcement
        <p role="status" className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Info className="w-4 h-4 shrink-0" aria-hidden="true" />
          {t("users.deletedVault.criteria.incomplete")}
        </p>
      )}

      <Button variant="outline" size="sm" onClick={addCriterion}>
        <Plus className="w-4 h-4 mr-1" />
        {t("users.deletedVault.criteria.addCriterion")}
      </Button>

      <div className="flex items-center gap-2 pt-2 border-t">
        <label htmlFor={limitId} className="text-sm font-medium">{t("users.deletedVault.criteria.limitLabel")}</label>
        <Input
          id={limitId}
          type="number"
          className="w-[120px]"
          placeholder={t("users.deletedVault.criteria.noLimit")}
          min={1}
          value={limit}
          onChange={(e) => setLimit(e.target.value)}
        />
      </div>
    </div>
  );
}
