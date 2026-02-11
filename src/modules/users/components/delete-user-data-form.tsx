import { Input } from "@/components/ui/input";

interface Props {
  username: string;
  onChange: (fromStep: string) => void;
}

export default function DeleteUserDataForm({ username, onChange }: Props) {
  return (
    <div>
      <p>Delete all data for <strong>{username}</strong>. This cannot be undone.</p>
      <div className="mt-4 flex items-center gap-2">
        <label className="text-sm font-medium whitespace-nowrap">From step (optional):</label>
        <Input
          type="text"
          placeholder="e.g. MailboxUserDeletionTaskStep"
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </div>
  );
}
