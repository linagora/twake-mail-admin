/**
 * Event counter, export and import controls of a calendar a domain owns. Team
 * calendars and resources are both plain DAV calendars that no user owns, so
 * the two sections render the same trio of controls — and the same counter,
 * re-read once an import task is over.
 */
import { useState } from "react";
import { CalendarDays } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  CollectionCountBadge,
  ExportCollectionButton,
  ImportCollectionButton,
  type CollectionCount,
} from "@/components/custom/dav-collection-actions";
import type { RunTaskResponse } from "@/modules/common-tasks/types";

export interface DomainCalendarPermissions {
  count: boolean;
  export: boolean;
  import: boolean;
}

/** The three routes serving the content of one such calendar. */
export interface DomainCalendarApi {
  count: (domain: string, calendarId: string) => Promise<CollectionCount>;
  exportCalendar: (domain: string, calendarId: string) => Promise<Blob>;
  importCalendar: (domain: string, calendarId: string, ics: string) => Promise<RunTaskResponse>;
}

interface Props {
  domain: string;
  calendarId: string;
  name: string;
  permissions: DomainCalendarPermissions;
  api: DomainCalendarApi;
  // i18n namespace of the section, holding eventCount, exportTitle,
  // errorExport, importTitle and errorImport.
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
    </>
  );
}
