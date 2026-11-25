import { useId } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";

interface Props {
  onChange: (fromStep: string) => void;
  fromStepPlaceholderKey?: string;
}

/**
 * Only the resume step of a deletion is typed: it is an advanced, rarely needed field,
 * kept closed so that the dialog never opens with the focus in it.
 */
export default function DeleteUserDataForm({ onChange, fromStepPlaceholderKey = "deleteUserDataForm.fromStepPlaceholder" }: Props) {
  const { t } = useTranslation();
  const fromStepId = useId();
  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-muted-foreground">{t("deleteUserDataForm.advanced")}</summary>
      <div className="mt-2">
        <label htmlFor={fromStepId} className="text-sm font-medium">{t("deleteUserDataForm.fromStep")}</label>
        <Input
          id={fromStepId}
          type="text"
          className="mt-1"
          placeholder={t(fromStepPlaceholderKey)}
          aria-describedby={`${fromStepId}-help`}
          onChange={(e) => onChange(e.target.value)}
        />
        <p id={`${fromStepId}-help`} className="text-xs text-muted-foreground mt-1">{t("deleteUserDataForm.fromStepHelp")}</p>
      </div>
    </details>
  );
}
