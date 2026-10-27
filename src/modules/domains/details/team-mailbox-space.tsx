import { useCallback, useId, useState } from "react";
import axios from "axios";
import { Copy, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useIsAllowed } from "@/lib/proxy-resolver-context";
import { useFetchData } from "@/hooks/use-fetch-data";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/hooks/use-confirm";
import { currentLocale } from "@/i18n/locale";
import { Button } from "@/components/ui/button";
import { SectionToggle, useSectionOpen } from "@/components/custom/collapsible-section";
import FormDialog, { FIELD_CLASS } from "@/components/custom/form-dialog";
import { bindTeamMailboxSpace, getTeamMailboxSpace, TWAKE_SPACE_UNAVAILABLE } from "../api-client";
import { TeamMailboxSpace as Space } from "../types";
import { bindSpaceCommand, isUuid, SpaceBindingValues, toSpaceBinding, toUtcInstant } from "./team-mailbox-space-commands";
import { useSyncSpaces } from "@/modules/twake-space/use-sync-spaces";

const formatInstant = (iso: string) => new Date(iso).toLocaleString(currentLocale());

const isConflict = (err: unknown) => axios.isAxiosError(err) && err.response?.status === 409;

interface Props {
  domain: string;
  mailbox: string;
  // Called once bound: the sync of an active space sets the members, binding a deleted one removes them
  onBound: () => unknown;
}

export default function TeamMailboxSpace({ domain, mailbox, onBound }: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const canView = useIsAllowed("GET", "/domains/{domain}/team-mailboxes/{mailbox}/space");
  const canBind = useIsAllowed("PUT", "/domains/{domain}/team-mailboxes/{mailbox}/space");
  const canSync = useIsAllowed("POST", "/spaces?action=sync");
  const syncSpaces = useSyncSpaces();

  const fetchSpace = useCallback(() => getTeamMailboxSpace(domain, mailbox), [domain, mailbox]);
  const { data: space, isLoading, error, refresh } = useFetchData<Space | null | typeof TWAKE_SPACE_UNAVAILABLE>(canView ? fetchSpace : null);

  const [open, setOpen, openContentId] = useSectionOpen("twake-space", true);
  const [showBind, setShowBind] = useState(false);
  // Remounts the dialog on each opening, so that it starts from the current space
  const [dialogKey, setDialogKey] = useState(0);

  // No Twake Space extension on this server: nothing to show nor bind
  if (!canView || space === TWAKE_SPACE_UNAVAILABLE) return null;

  const reopen = !!space?.deletedAt;
  const bindLabel = reopen ? t("domains.teamMailboxSpace.reopen") : t("domains.teamMailboxSpace.bind");

  const openBind = () => {
    setDialogKey((key) => key + 1);
    setShowBind(true);
  };

  const handleBound = async () => {
    toast({ title: t("domains.teamMailboxSpace.bound") });
    await Promise.all([refresh(), onBound()]);
  };

  return (
    <div className="mt-6">
      <div className="flex items-center gap-2">
        <SectionToggle open={open} onToggle={() => setOpen(!open)} controls={openContentId}>
          {t("domains.teamMailboxSpace.title")}
        </SectionToggle>
        {canBind && !isLoading && !error && (
          <Button type="button" variant="outline" size="sm" onClick={() => { setOpen(true); openBind(); }}>
            {bindLabel}
          </Button>
        )}
        {canSync && space && (
          <Button type="button" variant="outline" size="sm" onClick={() => syncSpaces({ organizationId: space.organizationId, spaceId: space.spaceId })}>
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
            {t("twakeSpace.sync.thisSpace")}
          </Button>
        )}
      </div>

      {open && (
        <div id={openContentId}>
          {isLoading && <div className="h-[58px] mt-2 rounded-2 animate-pulse bg-gray-200" />}
          {error && <p className="text-red-500 mt-2">{t("common.errorPrefix", { message: error })}</p>}
          {space && <SpaceFacts space={space} />}
          {space === null && !isLoading && !error && (
            <p className="mt-2 text-sm text-gray-500">{t("domains.teamMailboxSpace.notBound")}</p>
          )}
        </div>
      )}

      {canBind && (
        <BindSpaceDialog
          key={dialogKey}
          open={showBind}
          onClose={() => setShowBind(false)}
          title={bindLabel}
          domain={domain}
          mailbox={mailbox}
          current={space ?? null}
          onBound={handleBound}
        />
      )}
    </div>
  );
}

function SpaceFacts({ space }: { space: Space }) {
  const { t } = useTranslation();
  return (
    <div className="mt-2 p-4 bg-gray-50 rounded-2 space-y-2 text-sm">
      {space.deletedAt && (
        <p role="status" className="inline-block px-2 py-1 rounded-md bg-red-100 text-red-800 font-medium">
          {t("domains.teamMailboxSpace.deletedOn", { date: formatInstant(space.deletedAt) })}
        </p>
      )}
      <dl className="space-y-1">
        <CopyableFact label={t("domains.teamMailboxSpace.organizationId")} value={space.organizationId} />
        <CopyableFact label={t("domains.teamMailboxSpace.spaceId")} value={space.spaceId} />
      </dl>
    </div>
  );
}

function CopyableFact({ label, value }: { label: string; value: string }) {
  const { t } = useTranslation();
  const { toast } = useToast();

  const copy = () => {
    navigator.clipboard?.writeText(value)
      .then(() => toast({ title: t("common.copied"), description: value }))
      .catch(() => { /* the value stays selectable */ });
  };

  return (
    <div className="flex flex-wrap items-center gap-x-2">
      <dt className="font-medium">{label}</dt>
      <dd className="flex min-w-0 items-center gap-1">
        <code className="font-mono text-xs break-all select-text">{value}</code>
        <button
          type="button"
          onClick={copy}
          className="shrink-0 p-1 rounded-md hover:bg-gray-200"
          title={t("domains.teamMailboxSpace.copy", { item: label })}
          aria-label={t("domains.teamMailboxSpace.copy", { item: label })}
        >
          <Copy className="w-3 h-3" aria-hidden="true" />
        </button>
      </dd>
    </div>
  );
}

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  domain: string;
  mailbox: string;
  // Prefills the identifiers, e.g. to reopen a space closed by mistake
  current: Space | null;
  onBound: () => Promise<unknown>;
}

function BindSpaceDialog({ open, onClose, title, domain, mailbox, current, onBound }: DialogProps) {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const fieldId = useId();
  const [values, setValues] = useState<SpaceBindingValues>({
    organizationId: current?.organizationId ?? "",
    spaceId: current?.spaceId ?? "",
    deleted: false,
    deletedAt: "",
  });
  const [conflict, setConflict] = useState(false);
  const address = `${mailbox}@${domain}`;
  const binding = toSpaceBinding(values);

  const update = (patch: Partial<SpaceBindingValues>) => {
    setConflict(false);
    setValues((previous) => ({ ...previous, ...patch }));
  };

  const validate = () => {
    if (!binding.organizationId) return t("domains.teamMailboxSpace.organizationIdRequired");
    if (!isUuid(binding.spaceId)) return t("domains.teamMailboxSpace.invalidSpaceId");
    if (values.deleted && !binding.deletedAt) return t("domains.teamMailboxSpace.deletedAtRequired");
    return null;
  };

  // Binding to a deleted space removes the members: said, and confirmed, before sending it
  const confirmDeletedBinding = (deletedAt: string) =>
    confirm({
      header: t("domains.teamMailboxSpace.bindDeletedTitle"),
      destructive: true,
      confirmLabel: t("domains.teamMailboxSpace.bindDeletedConfirmLabel"),
      message: t("domains.teamMailboxSpace.bindDeletedConfirm", { mailbox: address, date: formatInstant(deletedAt) }),
    });

  const handleSubmit = async () => {
    if (binding.deletedAt && !(await confirmDeletedBinding(binding.deletedAt))) return false;
    try {
      await bindTeamMailboxSpace(domain, mailbox, binding);
    } catch (err) {
      setConflict(isConflict(err));
      throw err;
    }
    await onBound();
  };

  const spaceIdInvalid = !!values.spaceId.trim() && !isUuid(values.spaceId);
  const deletedAtInvalid = values.deleted && !!values.deletedAt && !toUtcInstant(values.deletedAt);

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title={title}
      submitLabel={title}
      validate={validate}
      onSubmit={handleSubmit}
      className="max-w-lg"
    >
      <p className="text-sm text-gray-600">{t("domains.teamMailboxSpace.bindHelp")}</p>
      <div>
        <label htmlFor={`${fieldId}-organization`} className="text-sm font-medium">{t("domains.teamMailboxSpace.organizationId")}</label>
        <input
          id={`${fieldId}-organization`}
          autoFocus
          required
          value={values.organizationId}
          onChange={(e) => update({ organizationId: e.target.value })}
          placeholder="org-1"
          className={FIELD_CLASS}
        />
      </div>
      <div>
        <label htmlFor={`${fieldId}-space`} className="text-sm font-medium">{t("domains.teamMailboxSpace.spaceId")}</label>
        <input
          id={`${fieldId}-space`}
          required
          value={values.spaceId}
          onChange={(e) => update({ spaceId: e.target.value })}
          placeholder="11111111-1111-1111-1111-111111111111"
          aria-invalid={spaceIdInvalid}
          aria-describedby={`${fieldId}-space-hint`}
          className={`${FIELD_CLASS} font-mono`}
        />
        {/* Reserved height: the hint appearing does not resize the modal */}
        <p id={`${fieldId}-space-hint`} className="h-4 mt-1 text-xs text-red-600">
          {spaceIdInvalid && t("domains.teamMailboxSpace.invalidSpaceId")}
        </p>
      </div>
      <label className="flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" checked={values.deleted} onChange={(e) => update({ deleted: e.target.checked })} />
        {t("domains.teamMailboxSpace.deletedSpace")}
      </label>
      {values.deleted && (
        <div className="space-y-2">
          <p className="text-sm text-gray-600">{t("domains.teamMailboxSpace.deletedSpaceHelp")}</p>
          <div>
            <label htmlFor={`${fieldId}-deleted-at`} className="text-sm font-medium">{t("domains.teamMailboxSpace.deletedAt")}</label>
            <input
              id={`${fieldId}-deleted-at`}
              type="datetime-local"
              required
              value={values.deletedAt}
              onChange={(e) => update({ deletedAt: e.target.value })}
              aria-invalid={deletedAtInvalid}
              aria-describedby={`${fieldId}-deleted-at-hint`}
              className={FIELD_CLASS}
            />
            <p id={`${fieldId}-deleted-at-hint`} className="mt-1 text-xs text-gray-500">
              {binding.deletedAt
                ? t("domains.teamMailboxSpace.deletedAtUtc", { instant: binding.deletedAt })
                : t("domains.teamMailboxSpace.deletedAtHint")}
            </p>
          </div>
          <p role="note" className="rounded-md border border-orange-200 bg-orange-50 p-2 text-sm text-orange-900">
            {t("domains.teamMailboxSpace.deletedSpaceWarning", { mailbox: address })}
          </p>
        </div>
      )}
      <p className="break-words text-sm">
        <span className="font-medium">{t("confirmTask.command")}:</span>{" "}
        <code className="font-mono text-xs">{bindSpaceCommand(domain, mailbox, binding)}</code>
      </p>
      {conflict && <p role="alert" className="text-sm text-red-600">{t("domains.teamMailboxSpace.conflict")}</p>}
    </FormDialog>
  );
}
