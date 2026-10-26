import { useCallback, useMemo, useState } from "react";
import UserLink from "@/components/custom/user-link";
import { useTranslation } from "react-i18next";
import { Plus, Trash2 } from "lucide-react";
import { useIsAllowed } from "@/lib/proxy-resolver-context";
import { useFetchData } from "@/hooks/use-fetch-data";
import { getDelegatedUsers, addDelegatedUser, removeDelegatedUser } from "../api-client";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/hooks/use-confirm";
import { useCheckUserExists } from "@/hooks/use-check-user-exists";
import ErrorDisplayer from "@/components/custom/error-displayer";
import { SectionToggle, useSectionOpen } from "@/components/custom/collapsible-section";
import FormDialog, { FIELD_CLASS } from "@/components/custom/form-dialog";
import UserSuggestInput from "@/components/custom/user-suggest-input";

interface Props {
  username: string;
}

export default function UserDelegation({ username }: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const confirm = useConfirm();
  const canView = useIsAllowed("GET", "/users/{username}/authorizedUsers");
  const canAdd = useIsAllowed("PUT", "/users/{username}/authorizedUsers/{authorizedUser}");
  const canRemove = useIsAllowed("DELETE", "/users/{username}/authorizedUsers/{authorizedUser}");

  const fetchDelegated = useCallback(() => getDelegatedUsers(username), [username]);
  const {
    data: delegated,
    isLoading,
    error,
    refresh,
  } = useFetchData<string[]>(canView ? fetchDelegated : null);

  const [open, setOpen, openContentId] = useSectionOpen("delegation");
  const [newUser, setNewUser] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const delegatedUserStatus = useCheckUserExists(newUser);
  const isSelfDelegation = newUser.trim().toLowerCase() === username.toLowerCase();
  const showUserStatus = !!newUser.trim() && !isSelfDelegation;
  const canSubmit =
    !!newUser.trim() && !isSelfDelegation && delegatedUserStatus !== "checking" && delegatedUserStatus !== "invalid";

  const sorted = useMemo(() => {
    if (!delegated) return [];
    return [...delegated].sort((a, b) => a.localeCompare(b));
  }, [delegated]);

  if (!canView) return null;

  const confirmUnknownUser = (user: string) =>
    confirm({
      header: t("users.delegation.unknownUserTitle"),
      message: t("users.delegation.unknownUserConfirm", { delegatedUser: user }),
    });

  // A refusal throws: the modal shows it and keeps the typed user
  const handleAdd = async () => {
    const user = newUser.trim();
    if (delegatedUserStatus === "not_found" && !(await confirmUnknownUser(user))) {
      // Declined: the modal stays open with the typed values
      return false;
    }
    await addDelegatedUser(username, user);
    toast({ title: t("users.delegation.added") });
    setNewUser("");
    await refresh();
  };

  const closeAddDialog = () => setShowAddDialog(false);

  const handleRemove = async (delegatedUser: string) => {
    const confirmed = await confirm({
      header: t("users.delegation.removeTitle"),
      destructive: true,
      confirmLabel: t("common.remove"),
      message: t("users.delegation.removeConfirm", { delegatedUser, username }),
    });
    if (!confirmed) return;
    try {
      await removeDelegatedUser(username, delegatedUser);
      toast({ title: t("users.delegation.removed") });
      await refresh();
    } catch (err) {
      toast({
        title: t("users.delegation.errorRemoving"),
        description: <ErrorDisplayer error={err} />,
      });
    }
  };

  return (
    <div className="mt-6">
      <div className="flex items-center gap-2">
        <SectionToggle open={open} onToggle={() => setOpen(!open)} controls={openContentId}>
          {t("users.delegation.title")}
          {delegated && (
            <span className="text-sm font-normal text-gray-500">
              ({delegated.length})
            </span>
          )}
        </SectionToggle>
        {canAdd && (
          <button
            type="button"
            onClick={() => { setOpen(true); setNewUser(""); setShowAddDialog(true); }}
            className="p-1 rounded-md hover:bg-gray-200 transition"
            title={t("users.delegation.addTooltip")}
          >
            <Plus className="w-4 h-4" />
          </button>
        )}
      </div>

      <FormDialog
        open={showAddDialog}
        onClose={closeAddDialog}
        title={t("users.delegation.addTooltip")}
        submitLabel={t("common.add")}
        submitDisabled={!canSubmit}
        onSubmit={handleAdd}
      >
        <div>
          <div>
            <label htmlFor="add-delegated-user" className="text-sm font-medium">{t("users.delegation.fieldLabel")}</label>
            <UserSuggestInput
              autoFocus
              value={newUser}
              onValueChange={setNewUser}
              id="add-delegated-user"
              placeholder={t("users.delegation.placeholder")}
              className={FIELD_CLASS}
            />
          </div>
          {/* Reserved height: the status appearing does not resize the modal */}
          <p className="h-4 mt-1 text-xs">
            {isSelfDelegation && <span className="text-red-600">{t("users.delegation.selfDelegation")}</span>}
            {showUserStatus && delegatedUserStatus === "checking" && <span className="text-gray-400">{t("common.checking")}</span>}
            {showUserStatus && delegatedUserStatus === "exists" && <span className="text-green-700">{t("common.userExists")}</span>}
            {showUserStatus && delegatedUserStatus === "not_found" && <span className="text-orange-600">{t("common.userNotFound")}</span>}
            {showUserStatus && delegatedUserStatus === "invalid" && <span className="text-red-600">{t("common.invalidUsername")}</span>}
          </p>
        </div>
      </FormDialog>

      {open && (
        <div id={openContentId} className="mt-2">
          <p className="text-sm text-gray-500 mb-2 [overflow-wrap:anywhere]">{t("users.delegation.description", { username })}</p>
          {isLoading && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-2">
              <div className="h-[58px] rounded-2 animate-pulse bg-gray-200" />
            </div>
          )}
          {error && <p className="text-red-500 mt-2">{t("common.errorPrefix", { message: error })}</p>}

          {delegated && (
            <div>
              {sorted.map((user, index) => (
                <div
                  key={user}
                  className="space-y-1 p-4 bg-gray-50 rounded-2 my-2 flex justify-between items-center gap-2 transition-colors hover:bg-gray-100"
                >
                  <h4 className="min-w-0 text-sm font-medium leading-none break-all">
                    <span className="text-gray-500 mr-2">{index + 1}/</span>
                    <UserLink address={user} />
                  </h4>
                  {canRemove && (
                    <button
                      onClick={() => handleRemove(user)}
                      className="shrink-0 p-2 rounded-md hover:bg-gray-200"
                      title={t("users.delegation.removeTooltip")}
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </button>
                  )}
                </div>
              ))}
              {delegated.length === 0 && (
                <p className="mt-2 text-sm text-gray-500">{t("users.delegation.empty")}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
