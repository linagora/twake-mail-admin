import { useState, useEffect } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
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

interface CriterionRow {
  fieldName: string;
  operator: string;
  value: string;
}

interface Props {
  onChange: (criteria: RestoreCriterion[], limit: number | undefined) => void;
}

export default function RestoreCriteriaBuilder({ onChange }: Props) {
  const [criteria, setCriteria] = useState<CriterionRow[]>([]);
  const [limit, setLimit] = useState<string>("");

  useEffect(() => {
    const validCriteria = criteria.filter(
      (c) => c.fieldName && c.operator && c.value
    );
    const parsedLimit = limit ? parseInt(limit, 10) : undefined;
    onChange(validCriteria, Number.isNaN(parsedLimit) ? undefined : parsedLimit);
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
        return { ...c, [field]: value };
      })
    );
  };

  const getInputType = (fieldName: string) => {
    return FIELD_CONFIG[fieldName]?.inputType || "text";
  };

  const getOperators = (fieldName: string) => {
    return FIELD_CONFIG[fieldName]?.operators || [];
  };

  const formatDateValue = (localValue: string): string => {
    if (!localValue) return "";
    const date = new Date(localValue);
    return date.toISOString();
  };

  const toLocalDatetime = (isoValue: string): string => {
    if (!isoValue) return "";
    try {
      const date = new Date(isoValue);
      const offset = date.getTimezoneOffset();
      const local = new Date(date.getTime() - offset * 60000);
      return local.toISOString().slice(0, 16);
    } catch {
      return "";
    }
  };

  return (
    <div className="space-y-4 w-full">
      <p className="text-sm text-muted-foreground">
        Define criteria to match deleted messages for restoration.
      </p>

      {criteria.map((criterion, index) => {
        const inputType = getInputType(criterion.fieldName);
        const operators = getOperators(criterion.fieldName);

        return (
          <div key={index} className="flex items-center gap-2 min-w-0">
            <Select
              value={criterion.fieldName}
              onValueChange={(v) => updateCriterion(index, "fieldName", v)}
            >
              <SelectTrigger className="w-[160px] shrink-0">
                <SelectValue placeholder="Field" />
              </SelectTrigger>
              <SelectContent>
                {FIELD_NAMES.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={criterion.operator}
              onValueChange={(v) => updateCriterion(index, "operator", v)}
              disabled={!criterion.fieldName}
            >
              <SelectTrigger className="w-[180px] shrink-0">
                <SelectValue placeholder="Operator" />
              </SelectTrigger>
              <SelectContent>
                {operators.map((op) => (
                  <SelectItem key={op} value={op}>
                    {op}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {inputType === "checkbox" ? (
              <div className="flex items-center gap-2 min-w-[100px]">
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
                />
                <span className="text-sm">
                  {criterion.value === "true" ? "true" : "false"}
                </span>
              </div>
            ) : inputType === "datetime-local" ? (
              <Input
                type="datetime-local"
                className="flex-1 min-w-0"
                disabled={!criterion.operator}
                value={toLocalDatetime(criterion.value)}
                onChange={(e) =>
                  updateCriterion(
                    index,
                    "value",
                    formatDateValue(e.target.value)
                  )
                }
              />
            ) : (
              <Input
                type="text"
                className="flex-1"
                placeholder="Value"
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
              onClick={() => removeCriterion(index)}
            >
              <Trash2 className="w-4 h-4 text-red-500" />
            </Button>
          </div>
        );
      })}

      <Button variant="outline" size="sm" onClick={addCriterion}>
        <Plus className="w-4 h-4 mr-1" />
        Add criterion
      </Button>

      <div className="flex items-center gap-2 pt-2 border-t">
        <label className="text-sm font-medium">Limit (optional):</label>
        <Input
          type="number"
          className="w-[120px]"
          placeholder="No limit"
          min={1}
          value={limit}
          onChange={(e) => setLimit(e.target.value)}
        />
      </div>
    </div>
  );
}
