import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react";
import { useIsAllowed } from "@/lib/proxy-resolver-context";
import { useFetchData } from "@/hooks/use-fetch-data";
import { getUserForwards, addUserForward, removeUserForward } from "../api-client";
import { GetUserForwardsResponseType } from "../types";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/hooks/use-confirm";
import { Checkbox } from "@/components/ui/checkbox";
import ErrorDisplayer from "@/components/custom/error-displayer";

interface Props {
  username: string;
}

export default function UserForwards({ username }: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const confirm = useConfirm();
  const canView = useIsAllowed("GET", "/address/forwards/{username}");
  const canAdd = useIsAllowed("PUT", "/address/forwards/{username}/targets/{destination}");
  const canRemove = useIsAllowed("DELETE", "/address/forwards/{username}/targets/{destination}");

  const fetchForwards = useCallback(() => getUserForwards(username), [username]);
  const {
    data: forwards,
    isLoading,
    error,
    refresh,
  } = useFetchData<GetUserForwardsResponseType>(canView ? fetchForwards : null);

  const [open, setOpen] = useState(false);
  const [newForward, setNewForward] = useState("");
  const [showCreateInput, setShowCreateInput] = useState(false);

  const sorted = useMemo(() => {
    if (!forwards) return [];
    return [...forwards].sort((a, b) => a.mailAddress.localeCompare(b.mailAddress));
  }, [forwards]);

  const userInForwards = useMemo(() => {
    if (!forwards) return false;
    return forwards.some((f) => f.mailAddress === username);
  }, [forwards, username]);

  const hasExternalForwards = useMemo(() => {
    if (!forwards) return false;
    return forwards.some((f) => f.mailAddress !== username);
  }, [forwards, username]);

  if (!canView) return null;

  // Checkbox is disabled when there are no external forwards
  // (no forwards at all, or only the user itself)
  const checkboxDisabled = !hasExternalForwards;

  const handleToggleUserReceives = async () => {
    try {
      if (userInForwards) {
        await removeUserForward(username, username);
        toast({ title: t("users.forwards.removedFromDestinations") });
      } else {
        await addUserForward(username, username);
        toast({ title: t("users.forwards.addedToDestinations") });
      }
      await refresh();
    } catch (err) {
      toast({
        title: t("users.forwards.errorUpdating"),
        description: <ErrorDisplayer error={err} />,
      });
    }
  };

  const handleAdd = async () => {
    const dest = newForward.trim();
    if (!dest) return;
    try {
      await addUserForward(username, dest);
      toast({ title: t("users.forwards.added") });
      setNewForward("");
      setShowCreateInput(false);
      await refresh();
    } catch (err) {
      toast({
        title: t("users.forwards.errorAdding"),
        description: <ErrorDisplayer error={err} />,
      });
    }
  };

  const handleRemove = async (destination: string) => {
    const confirmed = await confirm({
      header: t("users.forwards.removeTitle"),
      message: t("users.forwards.removeConfirm", { destination, username }),
    });
    if (!confirmed) return;
    try {
      await removeUserForward(username, destination);
      toast({ title: t("users.forwards.removed") });
      await refresh();
    } catch (err) {
      toast({
        title: t("users.forwards.errorRemoving"),
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
          {t("users.forwards.title")}
          {forwards && (
            <span className="text-sm font-normal text-gray-500">
              ({forwards.length})
            </span>
          )}
        </button>
        {open && canAdd && (
          <button
            onClick={() => setShowCreateInput(!showCreateInput)}
            className="p-1 rounded-md hover:bg-gray-200 transition"
            title={t("users.forwards.addTooltip")}
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
                value={newForward}
                onChange={(e) => setNewForward(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                placeholder={t("users.forwards.placeholder")}
                className="flex-1 px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleAdd}
                disabled={!newForward.trim()}
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

          {forwards && (
            <div>
              <div className="flex items-center gap-2 p-4 bg-gray-50 rounded-2 my-2">
                <Checkbox
                  id="user-receives"
                  checked={!hasExternalForwards || userInForwards}
                  disabled={checkboxDisabled}
                  onCheckedChange={handleToggleUserReceives}
                />
                <label htmlFor="user-receives" className="text-sm font-medium cursor-pointer select-none">
                  {t("users.forwards.stillReceives")}
                </label>
              </div>

              {sorted.map((fwd, index) => (
                <div
                  key={fwd.mailAddress}
                  className="space-y-1 p-4 bg-gray-50 rounded-2 my-2 flex justify-between items-center"
                >
                  <h4 className="text-sm font-medium leading-none">
                    <span className="text-gray-500 mr-2">{index + 1}/</span>
                    {fwd.mailAddress}
                    {fwd.mailAddress === username && (
                      <span className="ml-2 text-xs text-blue-500">{t("users.forwards.selfLabel")}</span>
                    )}
                  </h4>
                  {canRemove && (
                    <button
                      onClick={() => handleRemove(fwd.mailAddress)}
                      className="p-2 rounded-md hover:bg-gray-200"
                      title={t("users.forwards.removeTooltip")}
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </button>
                  )}
                </div>
              ))}
              {forwards.length === 0 && (
                <p className="mt-2 text-sm text-gray-500">{t("users.forwards.empty")}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
