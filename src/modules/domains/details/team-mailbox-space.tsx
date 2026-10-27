import { useCallback, useId, useState } from "react";
import { Copy, RefreshCw, TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useIsAllowed } from "@/lib/proxy-resolver-context";
import { useFetchData } from "@/hooks/use-fetch-data";
import { useToast } from "@/hooks/use-toast";
import { currentLocale } from "@/i18n/locale";
import { Button } from "@/components/ui/button";
import { SectionToggle, useSectionOpen } from "@/components/custom/collapsible-section";
import FormDialog, { FIELD_CLASS } from "@/components/custom/form-dialog";
import { bindTeamMailboxSpace, getTeamMailboxSpace } from "@/modules/twake-space/api-client";
import { TwakeSpace, TwakeSpaceBinding, bindSpaceCommand, bindingProblem, explainStatus, isSpaceId } from "@/modules/twake-space/space";
import { useSyncSpaces } from "@/modules/twake-space/use-sync-spaces";

const SPACE_PATTERN = "/domains/{domain}/team-mailboxes/{mailbox}/space";
const NO_BINDING: TwakeSpaceBinding = { organizationId: "", spaceId: "" };

interface Props {
  domain: string;
  mailbox: string;
  // Binding syncs the space, which sets the members of the team mailbox
  onBound?: () => void;
}

const formatDate = (iso: string): string => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString(currentLocale());
};

function CopyableId({ label, value }: { label: string; value: string }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const copy = () => {
    navigator.clipboard?.writeText(value)
      .then(() => toast({ title: t("common.copied"), description: value }))
      .catch(() => { /* the ID stays selectable */ });
  };
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-gray-500">{label}</span>
      <code className="font-mono break-all">{value}</code>
      <button type="button" onClick={copy} className="p-1 rounded-md hover:bg-gray-200" title={`${t("common.copy")} ${label}`}>
        <Copy className="w-4 h-4" aria-hidden="true" />
      </button>
    </div>
  );
}

function BoundSpace({ space }: { space: TwakeSpace }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-1 p-4 bg-gray-50 rounded-2 my-2">
      <CopyableId label={t("twakeSpace.organizationId")} value={space.organizationId} />
      <CopyableId label={t("twakeSpace.spaceId")} value={space.spaceId} />
      {space.deletedAt && (
        <p role="status" className="mt-2 inline-flex items-center gap-1 text-sm text-orange-700">
          <TriangleAlert className="w-4 h-4" aria-hidden="true" />
          {t("twakeSpace.deletedOn", { date: formatDate(space.deletedAt) })}
        </p>
      )}
    </div>
  );
}

interface BindDialogProps {
  domain: string;
  mailbox: string;
  open: boolean;
  title: string;
  initialValues: TwakeSpaceBinding;
  onClose: () => void;
  onBound: () => Promise<void>;
}

function BindSpaceDialog({ domain, mailbox, open, title, initialValues, onClose, onBound }: BindDialogProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const id = useId();
  const [binding, setBinding] = useState(initialValues);
  // Reset to the IDs of the opening, e.g. the current ones of a space to reopen
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setBinding(initialValues);
  }
  const problem = bindingProblem(binding);
  const invalidSpaceId = binding.spaceId.trim() !== "" && !isSpaceId(binding.spaceId);

  const handleBind = async () => {
    await bindTeamMailboxSpace(domain, mailbox, binding).catch(explainStatus(409, t("twakeSpace.bind.conflict")));
    toast({ title: t("twakeSpace.bind.success") });
    await onBound();
  };

  return (
    <FormDialog open={open} onClose={onClose} title={title} submitLabel={title} submitDisabled={problem !== null} onSubmit={handleBind}>
      <p className="text-sm text-muted-foreground">{t("twakeSpace.bind.help")}</p>
      <div>
        <label htmlFor={`${id}-organization`} className="text-sm font-medium">{t("twakeSpace.organizationId")}</label>
        <input
          id={`${id}-organization`}
          autoFocus
          value={binding.organizationId}
          onChange={(e) => setBinding({ ...binding, organizationId: e.target.value })}
          placeholder="org-1"
          className={FIELD_CLASS}
        />
      </div>
      <div>
        <label htmlFor={`${id}-space`} className="text-sm font-medium">{t("twakeSpace.spaceId")}</label>
        <input
          id={`${id}-space`}
          value={binding.spaceId}
          onChange={(e) => setBinding({ ...binding, spaceId: e.target.value })}
          placeholder="11111111-1111-1111-1111-111111111111"
          aria-invalid={invalidSpaceId}
          className={FIELD_CLASS}
        />
        {/* Reserved height: the message appearing does not resize the modal */}
        <p className="h-4 mt-1 text-xs text-red-600">{invalidSpaceId && t("twakeSpace.invalidSpaceId")}</p>
      </div>
      <p className="break-words text-sm">
        <span className="font-medium">{t("confirmTask.command")}:</span>{" "}
        <code className="font-mono text-xs">{bindSpaceCommand(domain, mailbox, binding)}</code>
      </p>
    </FormDialog>
  );
}

/**
 * The Twake space the team mailbox belongs to. A 404 means no space as well as a server
 * without the Twake Space extension: both are shown as "not bound", never as an error.
 */
export default function TeamMailboxSpace({ domain, mailbox, onBound }: Props) {
  const { t } = useTranslation();
  const canView = useIsAllowed("GET", SPACE_PATTERN);
  const canBind = useIsAllowed("PUT", SPACE_PATTERN);
  const canSync = useIsAllowed("POST", "/spaces?action=sync");
  const syncSpaces = useSyncSpaces();
  const [open, setOpen, openContentId] = useSectionOpen("twake-space", true);
  const [showBind, setShowBind] = useState(false);

  const fetchSpace = useCallback(() => getTeamMailboxSpace(domain, mailbox), [domain, mailbox]);
  const { data: space, isLoading, error, refresh } = useFetchData<TwakeSpace | null>(canView ? fetchSpace : null);

  if (!canView) return null;

  const loaded = !isLoading && !error;
  // A live space is left alone: binding it elsewhere is refused with a 409
  const canOfferBind = canBind && loaded && (!space || !!space.deletedAt);
  const bindTitle = space?.deletedAt ? t("twakeSpace.bind.reopen") : t("twakeSpace.bind.title");

  const handleBound = async () => {
    await refresh();
    onBound?.();
  };

  return (
    <div className="mt-6">
      <SectionToggle open={open} onToggle={() => setOpen(!open)} controls={openContentId}>
        {t("twakeSpace.title")}
      </SectionToggle>

      {open && (<div id={openContentId}>
        {isLoading && <div className="h-[58px] rounded-2 animate-pulse bg-gray-200" />}
        {error && <p className="text-red-500 mt-2">{t("common.errorPrefix", { message: error })}</p>}
        {loaded && space && <BoundSpace space={space} />}
        {loaded && !space && <p className="mt-2 text-sm text-gray-500">{t("twakeSpace.notBound")}</p>}
        {(canOfferBind || (canSync && space)) && (
          <div className="flex flex-wrap gap-2 mt-2">
            {canOfferBind && <Button variant="outline" size="sm" onClick={() => setShowBind(true)}>{bindTitle}</Button>}
            {canSync && space && (
              <Button variant="outline" size="sm" onClick={() => syncSpaces({ organizationId: space.organizationId, spaceId: space.spaceId })}>
                <RefreshCw className="w-4 h-4" aria-hidden="true" />
                {t("twakeSpace.sync.thisSpace")}
              </Button>
            )}
          </div>
        )}
      </div>)}

      <BindSpaceDialog
        domain={domain}
        mailbox={mailbox}
        open={showBind}
        title={bindTitle}
        initialValues={space ? { organizationId: space.organizationId, spaceId: space.spaceId } : NO_BINDING}
        onClose={() => setShowBind(false)}
        onBound={handleBound}
      />
    </div>
  );
}
