import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TaskParam } from "../types";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

const DURATION_UNITS = [
  { value: "h", label: "Hours" },
  { value: "d", label: "Days" },
  { value: "w", label: "Weeks" },
  { value: "m", label: "Months" },
  { value: "y", label: "Years" },
];

interface Props {
  params: TaskParam[];
  handleChangeParam: (key: string, value: string | boolean) => void;
}

const TaskParamsModifier = ({ params, handleChangeParam }: Props) => {
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
        initial[param.key] = { amount: "", unit: "d" };
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

  const handleRemove = (key: string) => {
    setFormData(prev => ({ ...prev, [key]: "" }));
  };

  const handleRemoveDuration = (key: string) => {
    setDurationParts(prev => ({ ...prev, [key]: { amount: "", unit: "d" } }));
    setFormData(prev => ({ ...prev, [key]: "" }));
  };

  return (
    <div className="space-y-3">
      {params?.map(param => (
        <div key={param.key} className="flex items-center space-x-2">
          <label className="font-medium">{param.key}:</label>
          {param.type === "input" && (
            <Input
              value={formData[param.key] as string}
              onChange={e => handleChange(param.key, e.target.value)}
            />
          )}
          {param.type === "checkbox" && (
            <Checkbox
              checked={formData[param.key] as boolean}
              onCheckedChange={checked => handleChange(param.key, checked)}
            />
          )}
          {param.type === "select" && param.values && (
            <div className="flex items-center space-x-2">
              <Select value={formData[param.key] as string} onValueChange={value => handleChange(param.key, value)}>
                <SelectTrigger className="w-[250px]">
                  <SelectValue placeholder={(formData[param.key] as string) || "Select an option"} />
                </SelectTrigger>
                <SelectContent>
                  {param.values.filter(v => v !== "").map(option => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="ghost" size="icon" onClick={() => handleRemove(param.key)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          )}
          {param.type === "duration" && (
            <div className="flex items-center space-x-2">
              <Input
                type="number"
                min="0"
                className="w-[100px]"
                placeholder="0"
                value={durationParts[param.key]?.amount ?? ""}
                onChange={e => handleDurationChange(param.key, e.target.value, durationParts[param.key]?.unit ?? "d")}
              />
              <Select
                value={durationParts[param.key]?.unit ?? "d"}
                onValueChange={unit => handleDurationChange(param.key, durationParts[param.key]?.amount ?? "", unit)}
              >
                <SelectTrigger className="w-[130px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DURATION_UNITS.map(u => (
                    <SelectItem key={u.value} value={u.value}>
                      {u.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="ghost" size="icon" onClick={() => handleRemoveDuration(param.key)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default TaskParamsModifier;
