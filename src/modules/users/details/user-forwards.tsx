import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Trash2 } from "lucide-react";
import { useIsAllowed } from "@/lib/proxy-resolver-context";
import { useFetchData } from "@/hooks/use-fetch-data";
import { useUserMappingsRevision } from "./user-mappings-revision";
import { getUserForwards, addUserForward, removeUserForward } from "../api-client";
import { ForwardDestination, GetUserForwardsResponseType } from "../types";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/hooks/use-confirm";
import { Checkbox } from "@/components/ui/checkbox";
import ErrorDisplayer from "@/components/custom/error-displayer";
import { SectionToggle, useSectionFact, useSectionOpen } from "@/components/custom/collapsible-section";
import FormDialog, { FIELD_CLASS } from "@/components/custom/form-dialog";
import UserSuggestInput from "@/components/custom/user-suggest-input";
import UserLink from "@/components/custom/user-link";

interface Props {
  username: string;
  // An address without account: it can be forwarded, but there is no mailbox to keep a copy in
  noMailbox?: boolean;
}

/** What the forwards of a user amount to, for the summary strip. */
export interface ForwardsFact {
  // The destinations other than the user itself
  destinations: ForwardDestination[];
  // Whether mail is still delivered to the user's own mailbox
  copyKept: boolean;
}

export default function UserForwards({ username, noMailbox = false }: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const confirm = useConfirm();
  const canView = useIsAllowed("GET", "/address/forwards/{username}");
  // WebAdmin refuses a new forward of an address without account; its leftovers can be removed
  const canAdd = useIsAllowed("PUT", "/address/forwards/{username}/targets/{destination}") && !noMailbox;
  const canRemove = useIsAllowed("DELETE", "/address/forwards/{username}/targets/{destination}");

  const { revision, notifyMappingsChanged } = useUserMappingsRevision();
  const fetchForwards = useCallback(() => getUserForwards(username), [username]);
  const {
    data: forwards,
    isLoading,
    error,
  } = useFetchData<GetUserForwardsResponseType>(canView ? fetchForwards : null, revision);

  const [open, setOpen, openContentId] = useSectionOpen("forwards");
  const [newForward, setNewForward] = useState("");
  const [keepCopy, setKeepCopy] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);

  // The user's own address among the destinations is not a forward: it keeps a copy in the mailbox
  const destinations = useMemo(() => {
    if (!forwards) return [];
    return forwards
      .filter((f) => f.mailAddress !== username)
      .sort((a, b) => a.mailAddress.localeCompare(b.mailAddress));
  }, [forwards, username]);

  const userInForwards = useMemo(() => {
    if (!forwards) return false;
    return forwards.some((f) => f.mailAddress === username);
  }, [forwards, username]);

  const hasExternalForwards = destinations.length > 0;
  // Without any forward, mail is delivered to the mailbox
  const copyKept = !hasExternalForwards || userInForwards;
  const fact = useMemo<ForwardsFact | undefined>(
    () => (forwards ? { destinations, copyKept } : undefined),
    [forwards, destinations, copyKept]
  );
  useSectionFact("forwards", fact);

  if (!canView) return null;

  // Checkbox is disabled when there are no external forwards
  // (no forwards at all, or only the user itself)
  const checkboxDisabled = !hasExternalForwards;

  const handleToggleUserReceives = async () => {
    try {
      if (userInForwards) {
        await removeUserForward(username, username);
        toast({ title: t("users.forwards.copyNotKept") });
      } else {
        await addUserForward(username, username);
        toast({ title: t("users.forwards.copyKept") });
      }
      notifyMappingsChanged();
    } catch (err) {
      toast({
        title: t("users.forwards.errorUpdating"),
        description: <ErrorDisplayer error={err} />,
      });
    }
  };

  // Asked only while mail still reaches the mailbox through no forward or the user's own entry
  const askKeepCopy = !noMailbox && !userInForwards;

  // A refusal throws: the modal shows it and keeps the typed destination. WebAdmin only stores
  // the new destination: unless the user is kept as a destination too, their mailbox stops
  // receiving mail, so the copy is added before success is reported.
  const handleAdd = async () => {
    await addUserForward(username, newForward.trim());
    if (askKeepCopy && keepCopy) {
      await addUserForward(username, username);
    }
    toast({ title: t("users.forwards.added") });
    setNewForward("");
    setKeepCopy(true);
    notifyMappingsChanged();
  };

  const handleRemove = async (destination: string) => {
    const confirmed = await confirm({
      header: t("users.forwards.removeTitle"),
      destructive: true,
      confirmLabel: t("common.remove"),
      message: t("users.forwards.removeConfirm", { destination, username }),
    });
    if (!confirmed) return;
    try {
      await removeUserForward(username, destination);
      // Without any other forward, the user's own entry only kept a copy: plain delivery again
      if (userInForwards && destinations.every((d) => d.mailAddress === destination)) {
        await removeUserForward(username, username);
      }
      toast({ title: t("users.forwards.removed") });
      notifyMappingsChanged();
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
        <SectionToggle open={open} onToggle={() => setOpen(!open)} controls={openContentId}>
          {t("users.forwards.title")}
          {forwards && (
            <span className="text-sm font-normal text-gray-500">
              ({destinations.length})
            </span>
          )}
        </SectionToggle>
        {canAdd && (
          <button
            type="button"
            onClick={() => { setOpen(true); setNewForward(""); setKeepCopy(true); setShowAddDialog(true); }}
            className="p-1 rounded-md hover:bg-gray-200 transition"
            title={t("users.forwards.addTooltip")}
          >
            <Plus className="w-4 h-4" />
          </button>
        )}
      </div>

      <FormDialog
        open={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        title={t("users.forwards.addTooltip")}
        submitLabel={t("common.add")}
        submitDisabled={!newForward.trim()}
        onSubmit={handleAdd}
      >
        <div>
          <label htmlFor="add-forward-destination" className="text-sm font-medium">{t("users.forwards.fieldLabel")}</label>
          <UserSuggestInput
            autoFocus
            value={newForward}
            onValueChange={setNewForward}
            id="add-forward-destination"
            placeholder={t("users.forwards.placeholder")}
            className={FIELD_CLASS}
          />
        </div>
        {askKeepCopy && (
          <div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="add-forward-keep-copy"
                checked={keepCopy}
                onCheckedChange={(checked) => setKeepCopy(checked === true)}
              />
              <label htmlFor="add-forward-keep-copy" className="text-sm cursor-pointer select-none">
                {t("users.forwards.keepCopyIn", { username })}
              </label>
            </div>
            {!keepCopy && (
              <p className="mt-1 text-xs text-gray-500">{t("users.forwards.onlyForwardedHint", { username })}</p>
            )}
          </div>
        )}
      </FormDialog>

      {open && (
        <div id={openContentId} className="mt-2">
          {isLoading && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-2">
              <div className="h-[58px] rounded-2 animate-pulse bg-gray-200" />
            </div>
          )}
          {error && <p className="text-red-500 mt-2">{t("common.errorPrefix", { message: error })}</p>}

          {forwards && (
            <div>
              {!noMailbox && (
                <div className="p-4 bg-gray-50 rounded-2 my-2 transition-colors hover:bg-gray-100">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="user-receives"
                      checked={copyKept}
                      disabled={checkboxDisabled}
                      onCheckedChange={handleToggleUserReceives}
                    />
                    <label htmlFor="user-receives" className="text-sm font-medium cursor-pointer select-none">
                      {t("users.forwards.keepCopy")}
                    </label>
                  </div>
                  {!copyKept && (
                    <p className="mt-2 text-sm text-amber-700">{t("users.forwards.onlyForwarded", { username })}</p>
                  )}
                </div>
              )}

              {destinations.map((fwd, index) => (
                <div
                  key={fwd.mailAddress}
                  className="space-y-1 p-4 bg-gray-50 rounded-2 my-2 flex justify-between items-center gap-2 transition-colors hover:bg-gray-100"
                >
                  <h4 className="min-w-0 text-sm font-medium leading-none break-all">
                    <span className="text-gray-500 mr-2">{index + 1}/</span>
                    <UserLink address={fwd.mailAddress} />
                  </h4>
                  {canRemove && (
                    <button
                      onClick={() => handleRemove(fwd.mailAddress)}
                      className="shrink-0 p-2 rounded-md hover:bg-gray-200"
                      title={t("users.forwards.removeTooltip")}
                      aria-label={t("users.forwards.removeNamed", { item: fwd.mailAddress })}
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </button>
                  )}
                </div>
              ))}
              {destinations.length === 0 && (
                <p className="mt-2 text-sm text-gray-500">{t("users.forwards.empty")}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
