import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react";
import { useIsAllowed } from "@/lib/proxy-resolver-context";
import { useFetchData } from "@/hooks/use-fetch-data";
import { getDelegatedUsers, addDelegatedUser, removeDelegatedUser } from "../api-client";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/hooks/use-confirm";
import { useCheckUserExists } from "@/hooks/use-check-user-exists";
import ErrorDisplayer from "@/components/custom/error-displayer";

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

  const [open, setOpen] = useState(false);
  const [newUser, setNewUser] = useState("");
  const [showCreateInput, setShowCreateInput] = useState(false);
  const delegatedUserStatus = useCheckUserExists(newUser);

  const sorted = useMemo(() => {
    if (!delegated) return [];
    return [...delegated].sort((a, b) => a.localeCompare(b));
  }, [delegated]);

  if (!canView) return null;

  const handleAdd = async () => {
    const user = newUser.trim();
    if (!user) return;
    try {
      await addDelegatedUser(username, user);
      toast({ title: t("users.delegation.added") });
      setNewUser("");
      setShowCreateInput(false);
      await refresh();
    } catch (err) {
      toast({
        title: t("users.delegation.errorAdding"),
        description: <ErrorDisplayer error={err} />,
      });
    }
  };

  const handleRemove = async (delegatedUser: string) => {
    const confirmed = await confirm({
      header: t("users.delegation.removeTitle"),
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
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-2 text-md font-semibold hover:text-blue-600 transition"
        >
          {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          {t("users.delegation.title")}
          {delegated && (
            <span className="text-sm font-normal text-gray-500">
              ({delegated.length})
            </span>
          )}
        </button>
        {open && canAdd && (
          <button
            onClick={() => setShowCreateInput(!showCreateInput)}
            className="p-1 rounded-md hover:bg-gray-200 transition"
            title={t("users.delegation.addTooltip")}
          >
            <Plus className="w-4 h-4" />
          </button>
        )}
      </div>

      {open && (
        <div className="mt-2">
          {showCreateInput && (
            <div className="flex gap-2 mt-2 mb-2">
              <input
                type="text"
                value={newUser}
                onChange={(e) => setNewUser(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                placeholder={t("users.delegation.placeholder")}
                className="flex-1 px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {delegatedUserStatus === "checking" && (
                <span className="flex items-center text-xs text-gray-400 whitespace-nowrap">{t("common.checking")}</span>
              )}
              {delegatedUserStatus === "exists" && (
                <span className="flex items-center gap-1 text-xs text-green-600 whitespace-nowrap">
                  <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
                  {t("common.userExists")}
                </span>
              )}
              {delegatedUserStatus === "not_found" && (
                <span className="flex items-center gap-1 text-xs text-orange-500 whitespace-nowrap">
                  <span className="inline-block w-2 h-2 rounded-full bg-orange-400" />
                  {t("common.userNotFound")}
                </span>
              )}
              {delegatedUserStatus === "invalid" && (
                <span className="flex items-center gap-1 text-xs text-red-600 whitespace-nowrap">
                  <span className="inline-block w-2 h-2 rounded-full bg-red-500" />
                  {t("common.invalidUsername")}
                </span>
              )}
              <button
                onClick={handleAdd}
                disabled={!newUser.trim()}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t("common.add")}
              </button>
            </div>
          )}

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
                  className="space-y-1 p-4 bg-gray-50 rounded-2 my-2 flex justify-between items-center"
                >
                  <h4 className="text-sm font-medium leading-none">
                    <span className="text-gray-500 mr-2">{index + 1}/</span>
                    {user}
                  </h4>
                  {canRemove && (
                    <button
                      onClick={() => handleRemove(user)}
                      className="p-2 rounded-md hover:bg-gray-200"
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
