/**
 * Event counter, export, import and public visibility controls of a calendar a
 * domain owns. Team calendars and resources are both plain DAV calendars that
 * no user owns, so the two sections render the same controls — and the same
 * counter, re-read once an import task is over.
 */
import { useState } from "react";
import { CalendarDays, Globe, Loader2, Save } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  CollectionCountBadge,
  ExportCollectionButton,
  ImportCollectionButton,
  type CollectionCount,
} from "@/components/custom/dav-collection-actions";
import type { RunTaskResponse } from "@/modules/common-tasks/types";
import { useToast } from "@/hooks/use-toast";
import ErrorDisplayer from "@/components/custom/error-displayer";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const PUBLIC_READ = "{DAV:}read";
const PRIVATE = "";

export interface DomainCalendarPermissions {
  count: boolean;
  export: boolean;
  import: boolean;
  publicRight: boolean;
}

/** The routes serving the content and the visibility of one such calendar. */
export interface DomainCalendarApi {
  count: (domain: string, calendarId: string) => Promise<CollectionCount>;
  exportCalendar: (domain: string, calendarId: string) => Promise<Blob>;
  importCalendar: (domain: string, calendarId: string, ics: string) => Promise<RunTaskResponse>;
  setPublicRight: (domain: string, calendarId: string, publicRight: string) => Promise<void>;
}

interface Props {
  domain: string;
  calendarId: string;
  name: string;
  permissions: DomainCalendarPermissions;
  api: DomainCalendarApi;
  // i18n namespace of the section, holding eventCount, exportTitle,
  // errorExport, importTitle, errorImport and publicRight.
  labels: string;
}

export default function DomainCalendarControls({
  domain,
  calendarId,
  name,
  permissions,
  api,
  labels,
}: Props) {
  const { t } = useTranslation();
  // Bumped once an import task is over: a new key re-reads the event counter.
  const [countKey, setCountKey] = useState(0);
  const [showPublicRight, setShowPublicRight] = useState(false);

  return (
    <>
      {permissions.count && (
        <CollectionCountBadge
          key={countKey}
          owner={domain}
          collectionId={calendarId}
          count={api.count}
          icon={CalendarDays}
          title={t(`${labels}.eventCount`)}
        />
      )}
      {permissions.export && (
        <ExportCollectionButton
          owner={domain}
          collectionId={calendarId}
          name={name}
          extension="ics"
          exportCollection={api.exportCalendar}
          title={t(`${labels}.exportTitle`)}
          errorTitle={t(`${labels}.errorExport`)}
        />
      )}
      {permissions.import && (
        <ImportCollectionButton
          owner={domain}
          collectionId={calendarId}
          accept=".ics,text/calendar"
          importCollection={api.importCalendar}
          title={t(`${labels}.importTitle`)}
          errorTitle={t(`${labels}.errorImport`)}
          onImported={() => setCountKey((key) => key + 1)}
        />
      )}
      {permissions.publicRight && (
        <button
          onClick={() => setShowPublicRight(true)}
          className="p-2 rounded-md hover:bg-gray-200"
          title={t(`${labels}.publicRight.tooltip`)}
        >
          <Globe className="w-4 h-4 text-gray-600" />
        </button>
      )}
      {showPublicRight && (
        <PublicRightDialog
          domain={domain}
          calendarId={calendarId}
          name={name}
          setPublicRight={api.setPublicRight}
          labels={`${labels}.publicRight`}
          onClose={() => setShowPublicRight(false)}
        />
      )}
    </>
  );
}

// The listings do not tell whether a calendar is public, hence no option is
// selected up front: the admin explicitly picks the visibility to apply.
function PublicRightDialog({
  domain,
  calendarId,
  name,
  setPublicRight,
  labels,
  onClose,
}: {
  domain: string;
  calendarId: string;
  name: string;
  setPublicRight: DomainCalendarApi["setPublicRight"];
  labels: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [value, setValue] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (value === null) return;
    setSaving(true);
    try {
      await setPublicRight(domain, calendarId, value);
      toast({ title: t(`${labels}.updated`) });
      onClose();
    } catch (err) {
      toast({ title: t(`${labels}.errorUpdate`), description: <ErrorDisplayer error={err} /> });
    } finally {
      setSaving(false);
    }
  };

  const option = (optionValue: string, key: "private" | "public") => (
    <label className="flex items-start gap-2 p-2 rounded-md hover:bg-gray-50 cursor-pointer">
      <input
        type="radio"
        name={`public-right-${calendarId}`}
        className="mt-1"
        checked={value === optionValue}
        onChange={() => setValue(optionValue)}
      />
      <div>
        <p className="text-sm font-medium">{t(`${labels}.${key}`)}</p>
        <p className="text-xs text-gray-400">{t(`${labels}.${key}Desc`)}</p>
      </div>
    </label>
  );

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t(`${labels}.title`)} — {name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-gray-500">{t(`${labels}.hint`)}</p>
          {option(PRIVATE, "private")}
          {option(PUBLIC_READ, "public")}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving || value === null}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
              {t("common.save")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
