import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TaskParam } from "../types";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

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

  useEffect(() => {
    for (const key in formData) {
      handleChangeParam(key, formData[key]);
    }
  }, [formData]);

  const handleChange = (key: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handleRemove = (key: string) => {
    console.log('remove')
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
                  {param.values.map(option => (
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
        </div>
      ))}
    </div>
  );
};

export default TaskParamsModifier;
