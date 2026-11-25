import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import UserSuggestInput, { SUGGEST_INPUT_CLASS } from "@/components/custom/user-suggest-input";

interface Props {
  username: string;
  onChange: (values: { newUsername: string; force: boolean; fromStep: string }) => void;
}

export default function RenameUserForm({ username, onChange }: Props) {
  const { t } = useTranslation();
  // Kept in state so that a re-render of the dialog (e.g. to report a missing field) does not reset them
  const [values, setValues] = useState({ newUsername: "", force: false, fromStep: "" });
  const idPrefix = useId();
  const newUsernameId = `${idPrefix}-new-username`;
  const fromStepId = `${idPrefix}-from-step`;

  const update = (change: Partial<typeof values>) => {
    const next = { ...values, ...change };
    setValues(next);
    onChange(next);
  };

  return (
    <div className="space-y-4">
      <p>{t("renameUserForm.currentUsername")}: <strong>{username}</strong></p>
      <p className="text-sm text-muted-foreground">{t("renameUserForm.targetMustExist")}</p>
      {/* The target always exists, so every rename merges: say which side wins on a collision */}
      <p className="text-sm text-muted-foreground">{t("renameUserForm.mergeIntoExisting")}</p>
      <div>
        <label htmlFor={newUsernameId} className="text-sm font-medium">{t("renameUserForm.newUsername")}</label>
        <UserSuggestInput
          id={newUsernameId}
          className={SUGGEST_INPUT_CLASS}
          wrapperClassName="mt-1"
          placeholder="new.user@domain.tld"
          value={values.newUsername}
          onValueChange={(value) => update({ newUsername: value })}
        />
      </div>
      {/* Only to force or resume a rename that failed midway */}
      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground">{t("common.advancedOptions")}</summary>
        <div className="mt-2 space-y-3">
          <div className="flex items-center gap-2">
            <Checkbox
              id={`${idPrefix}-force`}
              checked={values.force}
              onCheckedChange={(checked) => update({ force: !!checked })}
            />
            <label htmlFor={`${idPrefix}-force`} className="text-sm">{t("renameUserForm.force")}</label>
          </div>
          <div>
            <label htmlFor={fromStepId} className="text-sm font-medium">{t("renameUserForm.fromStep")}</label>
            <Input
              id={fromStepId}
              type="text"
              className="mt-1"
              placeholder={t("renameUserForm.fromStepPlaceholder")}
              value={values.fromStep}
              aria-describedby={`${fromStepId}-help`}
              onChange={(e) => update({ fromStep: e.target.value })}
            />
            <p id={`${fromStepId}-help`} className="text-xs text-muted-foreground mt-1">{t("renameUserForm.fromStepHelp")}</p>
          </div>
        </div>
      </details>
    </div>
  );
}
