import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";

interface Props {
  username: string;
  onChange: (values: { newUsername: string; force: boolean; fromStep: string }) => void;
}

export default function RenameUserForm({ username, onChange }: Props) {
  const { t } = useTranslation();
  let newUsername = "";
  let force = false;
  let fromStep = "";

  const notify = () => onChange({ newUsername, force, fromStep });

  return (
    <div className="space-y-4">
      <p>{t("renameUserForm.newUsername")}: <strong>{username}</strong></p>
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium whitespace-nowrap">{t("renameUserForm.newUsername")}:</label>
        <Input
          type="text"
          placeholder="new.user@domain.tld"
          onChange={(e) => { newUsername = e.target.value; notify(); }}
        />
      </div>
      <div className="flex items-center gap-2">
        <Checkbox
          id="rename-force"
          onCheckedChange={(checked) => { force = !!checked; notify(); }}
        />
        <label htmlFor="rename-force" className="text-sm">{t("renameUserForm.force")}</label>
      </div>
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium whitespace-nowrap">{t("renameUserForm.fromStep")}:</label>
        <Input
          type="text"
          placeholder="e.g. MailboxUsernameChangeTaskStep"
          onChange={(e) => { fromStep = e.target.value; notify(); }}
        />
      </div>
    </div>
  );
}
