import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";

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
      <div className="flex items-center gap-2">
        <label htmlFor={newUsernameId} className="text-sm font-medium whitespace-nowrap">{t("renameUserForm.newUsername")}:</label>
        <Input
          id={newUsernameId}
          type="text"
          placeholder="new.user@domain.tld"
          value={values.newUsername}
          onChange={(e) => update({ newUsername: e.target.value })}
        />
      </div>
      <div className="flex items-center gap-2">
        <Checkbox
          id="rename-force"
          checked={values.force}
          onCheckedChange={(checked) => update({ force: !!checked })}
        />
        <label htmlFor="rename-force" className="text-sm">{t("renameUserForm.force")}</label>
      </div>
      <div className="flex items-center gap-2">
        <label htmlFor={fromStepId} className="text-sm font-medium whitespace-nowrap">{t("renameUserForm.fromStep")}:</label>
        <Input
          id={fromStepId}
          type="text"
          placeholder={t("renameUserForm.fromStepPlaceholder")}
          value={values.fromStep}
          onChange={(e) => update({ fromStep: e.target.value })}
        />
      </div>
    </div>
  );
}
