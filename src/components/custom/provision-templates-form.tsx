import { useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useCheckUserExists } from "@/hooks/use-check-user-exists";
import UserSuggestInput, { SUGGEST_INPUT_CLASS } from "@/components/custom/user-suggest-input";
import { useConfirmAppearance } from "@/components/custom/confirm-provider";
import { provisionFolderError, provisionSourceInlineError } from "@/components/custom/provision-source";

export interface ProvisionTemplatesValues {
  sourceUser: string;
  folderName: string;
  overwriteExisting: boolean;
  prune: boolean;
  usersPerSecond: string;
}

interface Props {
  /** The domain of the target users: the source user must belong to it. */
  domain: string;
  /** Show the "usersPerSecond" throttling field (domain provisioning only). */
  showUsersPerSecond?: boolean;
  onChange: (values: ProvisionTemplatesValues) => void;
}

export default function ProvisionTemplatesForm({ domain, showUsersPerSecond, onChange }: Props) {
  const { t } = useTranslation();
  const [sourceUser, setSourceUser] = useState("");
  const [folderName, setFolderName] = useState("");
  const [overwriteExisting, setOverwriteExisting] = useState(false);
  const [prune, setPrune] = useState(false);
  const [usersPerSecond, setUsersPerSecond] = useState("1");
  const status = useCheckUserExists(sourceUser);
  const idPrefix = useId();
  const sourceUserId = `${idPrefix}-source-user`;
  const folderNameId = `${idPrefix}-folder-name`;
  const usersPerSecondId = `${idPrefix}-users-per-second`;
  const sourceUserErrorId = `${idPrefix}-source-user-error`;
  const folderNameHelpId = `${idPrefix}-folder-name-help`;
  const sourceUserError = provisionSourceInlineError(sourceUser, domain);
  const folderNameError = provisionFolderError(folderName);
  const hasInlineError = !!(sourceUserError || folderNameError);
  const setAppearance = useConfirmAppearance();

  useEffect(() => {
    onChange({ sourceUser, folderName, overwriteExisting, prune, usersPerSecond });
  }, [sourceUser, folderName, overwriteExisting, prune, usersPerSecond, onChange]);

  // WebAdmin would refuse these values with a 400: Run stays disabled while a field is flagged
  useEffect(() => {
    setAppearance({ confirmDisabled: hasInlineError });
  }, [hasInlineError, setAppearance]);

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <label htmlFor={sourceUserId} className="text-sm font-medium">{t("provisionTemplates.sourceUser")}</label>
        <div className="flex gap-2 items-center">
          <UserSuggestInput
            id={sourceUserId}
            value={sourceUser}
            placeholder="reference.user@domain.tld"
            onValueChange={setSourceUser}
            domain={domain}
            aria-invalid={!!sourceUserError}
            aria-describedby={sourceUserError ? sourceUserErrorId : undefined}
            className={SUGGEST_INPUT_CLASS}
            wrapperClassName="flex-1"
          />
          {status === "checking" && (
            <span className="text-xs text-gray-400 whitespace-nowrap">{t("common.checking")}</span>
          )}
          {!sourceUserError && status === "exists" && (
            <span className="flex items-center gap-1 text-xs text-green-600 whitespace-nowrap">
              <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
              {t("common.userExists")}
            </span>
          )}
          {!sourceUserError && status === "not_found" && (
            <span className="flex items-center gap-1 text-xs text-orange-500 whitespace-nowrap">
              <span className="inline-block w-2 h-2 rounded-full bg-orange-400" />
              {t("common.userNotFound")}
            </span>
          )}
          {!sourceUserError && status === "invalid" && (
            <span className="flex items-center gap-1 text-xs text-red-600 whitespace-nowrap">
              <span className="inline-block w-2 h-2 rounded-full bg-red-500" />
              {t("common.invalidUsername")}
            </span>
          )}
        </div>
        {sourceUserError && (
          <p id={sourceUserErrorId} className="text-xs text-red-600">{t(sourceUserError, { domain })}</p>
        )}
        <p className="text-xs text-muted-foreground">{t("provisionTemplates.sourceUserHint", { domain })}</p>
      </div>

      <div className="space-y-1">
        <label htmlFor={folderNameId} className="text-sm font-medium">{t("provisionTemplates.folderName")}</label>
        <Input
          id={folderNameId}
          type="text"
          value={folderName}
          placeholder="Templates"
          aria-invalid={!!folderNameError}
          aria-describedby={folderNameHelpId}
          onChange={(e) => setFolderName(e.target.value)}
        />
        <p id={folderNameHelpId} className={folderNameError ? "text-xs text-red-600" : "text-xs text-muted-foreground"}>
          {t(folderNameError ?? "provisionTemplates.folderNameHint")}
        </p>
      </div>

      {showUsersPerSecond && (
        <div className="space-y-1">
          <label htmlFor={usersPerSecondId} className="text-sm font-medium">{t("provisionTemplates.usersPerSecond")}</label>
          <Input
            id={usersPerSecondId}
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
