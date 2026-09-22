/**
 * Controls shared by every DAV collection section: the calendars and the address
 * books of a user, the team calendars and the resources of a domain. All are DAV
 * collections, counted, exported and imported through routes that differ only by
 * their owner, their path and their media type.
 */
import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { Link } from "react-router";
import { Download, Loader2, Upload, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useFetchData } from "@/hooks/use-fetch-data";
import { useToast } from "@/hooks/use-toast";
import ErrorDisplayer from "@/components/custom/error-displayer";
import { getTaskDetail } from "@/modules/common-tasks/api-client";
import { TaskStatus, type RunTaskResponse } from "@/modules/common-tasks/types";
import { useDomain } from "@/modules/domain-admin/domain-context";

// Number of resources held by a DAV collection: events for a calendar,
// contacts for an address book.
export interface CollectionCount {
  count: number;
}

const BUTTON_CLASS = "p-1.5 rounded-md hover:bg-gray-200 transition disabled:opacity-50";

// An import lands asynchronously, so the counter is read again once its task has
// run. Long enough for the imports an operator triggers by hand, and bounded:
// past that the counter simply waits for the next time the section is opened.
const TASK_POLL_INTERVAL_MS = 2000;
const TASK_POLL_ATTEMPTS = 30;

interface CollectionProps {
  // Whoever the collection hangs from: a username, or a domain for the
  // collections a domain owns.
  owner: string;
  collectionId: string;
}

/**
 * Resource count of a single collection, fetched on mount — the sections only
 * render their rows once expanded, so each collection is counted lazily, and
 * independently of its siblings.
 */
export function CollectionCountBadge({
  owner,
  collectionId,
  count,
  icon: Icon,
  title,
}: CollectionProps & {
  count: (owner: string, collectionId: string) => Promise<CollectionCount>;
  icon: LucideIcon;
  title: string;
}) {
  const fetchCount = useCallback(
    () => count(owner, collectionId),
    [count, owner, collectionId]
  );
  const { data, isLoading } = useFetchData<CollectionCount>(fetchCount);

  if (isLoading) return <span className="inline-block w-8 h-3 rounded animate-pulse bg-gray-200" />;
  // A collection whose count cannot be read stays listed, simply without it.
  if (!data) return null;

  return (
    <span className="inline-flex items-center gap-1 text-xs text-gray-500" title={title}>
      <Icon className="w-3 h-3" />
      {data.count}
    </span>
  );
}

export function ExportCollectionButton({
  owner,
  collectionId,
  name,
  extension,
  exportCollection,
  title,
  errorTitle,
}: CollectionProps & {
  name: string;
  extension: string;
  exportCollection: (owner: string, collectionId: string) => Promise<Blob>;
  title: string;
  errorTitle: string;
}) {
  const { toast } = useToast();
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      download(await exportCollection(owner, collectionId), fileName(name, extension));
    } catch (err) {
      toast({ title: errorTitle, description: <ErrorDisplayer error={err} /> });
    } finally {
      setExporting(false);
    }
  };

  return (
    <button onClick={handleExport} disabled={exporting} className={BUTTON_CLASS} title={title}>
      {exporting
        ? <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-600" />
        : <Download className="w-3.5 h-3.5 text-gray-600" />}
    </button>
  );
}

export function ImportCollectionButton({
  owner,
  collectionId,
  accept,
  importCollection,
  title,
  errorTitle,
  onImported,
}: CollectionProps & {
  accept: string;
  importCollection: (
    owner: string,
    collectionId: string,
    content: string
  ) => Promise<RunTaskResponse>;
  title: string;
  errorTitle: string;
  // Called once the import task is over, so the row can re-read its counter.
  onImported: () => void;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const domain = useDomain() || undefined;
  const inputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  // The task outlives a collapsed section: nothing is polled or set afterwards.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Cleared right away so that re-picking the same file fires a change again.
    event.target.value = "";
    if (!file) return;
    setImporting(true);
    try {
      const { taskId } = await importCollection(owner, collectionId, await file.text());
      toast({
        title: t("common.taskStarted"),
        description: (
          <p>
            <Link className="text-blue-500 hover:underline" to={`/task/${taskId}`}>
              {t("common.taskLink", { taskId })}
            </Link>
          </p>
        ),
      });
      await waitForTask(taskId, domain, () => mounted.current);
      if (mounted.current) onImported();
    } catch (err) {
      toast({ title: errorTitle, description: <ErrorDisplayer error={err} /> });
    } finally {
      if (mounted.current) setImporting(false);
    }
  };

  return (
    <>
      <input type="file" accept={accept} ref={inputRef} onChange={handleFile} className="hidden" />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={importing}
        className={BUTTON_CLASS}
        title={title}
      >
        {importing
          ? <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-600" />
          : <Upload className="w-3.5 h-3.5 text-gray-600" />}
      </button>
    </>
  );
}

/**
 * Waits for an import task to leave its running state. Reading the task is best
 * effort: a client whose permissions do not cover the task routes, or a task
 * still running after the last attempt, simply stops being waited for.
 */
async function waitForTask(
  taskId: string,
  domain: string | undefined,
  keepWaiting: () => boolean
): Promise<void> {
  for (let attempt = 0; attempt < TASK_POLL_ATTEMPTS; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, TASK_POLL_INTERVAL_MS));
    if (!keepWaiting()) return;
    try {
      const { status } = await getTaskDetail(taskId, domain);
      if (status !== TaskStatus.WAITING && status !== TaskStatus.IN_PROGRESS) return;
    } catch {
      // Not readable: the import was accepted all the same, stop waiting.
      return;
    }
  }
}

function fileName(name: string, extension: string): string {
  return `${name.trim().replace(/[^\w.-]+/g, "_") || "export"}.${extension}`;
}

function download(blob: Blob, name: string): void {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", name);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
