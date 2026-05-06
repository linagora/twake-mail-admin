import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";

interface Props {
  username: string;
  onChange: (fromStep: string) => void;
}

export default function DeleteUserDataForm({ username, onChange }: Props) {
  const { t } = useTranslation();
  return (
    <div>
      <p>{t("users.tasks.deleteData")}: <strong>{username}</strong></p>
      <div className="mt-4 flex items-center gap-2">
        <label className="text-sm font-medium whitespace-nowrap">{t("deleteUserDataForm.fromStep")}:</label>
        <Input
          type="text"
          placeholder="e.g. MailboxUserDeletionTaskStep"
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </div>
  );
}
