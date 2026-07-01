import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useCheckUserExists } from "@/hooks/use-check-user-exists";

export interface ProvisionTemplatesValues {
  sourceUser: string;
  folderName: string;
  overwriteExisting: boolean;
  prune: boolean;
  usersPerSecond: string;
}

interface Props {
  /** Show the "usersPerSecond" throttling field (domain provisioning only). */
  showUsersPerSecond?: boolean;
  onChange: (values: ProvisionTemplatesValues) => void;
}

export default function ProvisionTemplatesForm({ showUsersPerSecond, onChange }: Props) {
  const { t } = useTranslation();
  const [sourceUser, setSourceUser] = useState("");
  const [folderName, setFolderName] = useState("");
  const [overwriteExisting, setOverwriteExisting] = useState(false);
  const [prune, setPrune] = useState(false);
  const [usersPerSecond, setUsersPerSecond] = useState("1");
  const status = useCheckUserExists(sourceUser);

  useEffect(() => {
    onChange({ sourceUser, folderName, overwriteExisting, prune, usersPerSecond });
  }, [sourceUser, folderName, overwriteExisting, prune, usersPerSecond, onChange]);

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <label className="text-sm font-medium">{t("provisionTemplates.sourceUser")}</label>
        <div className="flex gap-2 items-center">
          <Input
            type="text"
            value={sourceUser}
            placeholder="reference.user@domain.tld"
            onChange={(e) => setSourceUser(e.target.value)}
          />
          {status === "checking" && (
            <span className="text-xs text-gray-400 whitespace-nowrap">{t("common.checking")}</span>
          )}
          {status === "exists" && (
            <span className="flex items-center gap-1 text-xs text-green-600 whitespace-nowrap">
              <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
              {t("common.userExists")}
            </span>
          )}
          {status === "not_found" && (
            <span className="flex items-center gap-1 text-xs text-orange-500 whitespace-nowrap">
              <span className="inline-block w-2 h-2 rounded-full bg-orange-400" />
              {t("common.userNotFound")}
            </span>
          )}
          {status === "invalid" && (
            <span className="flex items-center gap-1 text-xs text-red-600 whitespace-nowrap">
              <span className="inline-block w-2 h-2 rounded-full bg-red-500" />
              {t("common.invalidUsername")}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{t("provisionTemplates.sourceUserHint")}</p>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium">{t("provisionTemplates.folderName")}</label>
        <Input
          type="text"
          value={folderName}
          placeholder="Templates"
          onChange={(e) => setFolderName(e.target.value)}
        />
      </div>

      {showUsersPerSecond && (
        <div className="space-y-1">
          <label className="text-sm font-medium">{t("provisionTemplates.usersPerSecond")}</label>
          <Input
            type="number"
            min={1}
            value={usersPerSecond}
            onChange={(e) => setUsersPerSecond(e.target.value)}
          />
        </div>
      )}

      <div className="flex items-center gap-2">
        <Checkbox
          id="provision-overwrite"
          checked={overwriteExisting}
          onCheckedChange={(checked) => setOverwriteExisting(!!checked)}
        />
        <label htmlFor="provision-overwrite" className="text-sm">{t("provisionTemplates.overwriteExisting")}</label>
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          id="provision-prune"
          checked={prune}
          onCheckedChange={(checked) => setPrune(!!checked)}
        />
        <label htmlFor="provision-prune" className="text-sm">{t("provisionTemplates.prune")}</label>
      </div>
    </div>
  );
}
