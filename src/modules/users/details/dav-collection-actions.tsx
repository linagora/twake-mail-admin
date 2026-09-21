/**
 * Controls shared by the calendars and the address books sections of the user
 * detail page. Both are DAV collections, counted, exported and imported through
 * routes that differ only by their path and their media type.
 */
import { useCallback, useRef, useState, type ChangeEvent } from "react";
import { Link } from "react-router";
import { Download, Loader2, Upload, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useFetchData } from "@/hooks/use-fetch-data";
import { useToast } from "@/hooks/use-toast";
import ErrorDisplayer from "@/components/custom/error-displayer";
import type { RunTaskResponse } from "@/modules/common-tasks/types";
import type { CollectionCount } from "../types";

const BUTTON_CLASS = "p-1.5 rounded-md hover:bg-gray-200 transition disabled:opacity-50";

interface CollectionProps {
  username: string;
  collectionId: string;
}

/**
 * Resource count of a single collection, fetched on mount — the sections only
 * render their rows once expanded, so each collection is counted lazily, and
 * independently of its siblings.
 */
export function CollectionCountBadge({
  username,
  collectionId,
  count,
  icon: Icon,
  title,
}: CollectionProps & {
  count: (username: string, collectionId: string) => Promise<CollectionCount>;
  icon: LucideIcon;
  title: string;
}) {
  const fetchCount = useCallback(
    () => count(username, collectionId),
    [count, username, collectionId]
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
  username,
  collectionId,
  name,
  extension,
  exportCollection,
  title,
  errorTitle,
}: CollectionProps & {
  name: string;
  extension: string;
  exportCollection: (username: string, collectionId: string) => Promise<Blob>;
  title: string;
  errorTitle: string;
}) {
  const { toast } = useToast();
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      download(await exportCollection(username, collectionId), fileName(name, extension));
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
  username,
  collectionId,
  accept,
  importCollection,
  title,
  errorTitle,
}: CollectionProps & {
  accept: string;
  importCollection: (
    username: string,
    collectionId: string,
    content: string
  ) => Promise<RunTaskResponse>;
  title: string;
  errorTitle: string;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Cleared right away so that re-picking the same file fires a change again.
    event.target.value = "";
    if (!file) return;
    setImporting(true);
    try {
      const { taskId } = await importCollection(username, collectionId, await file.text());
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
    } catch (err) {
      toast({ title: errorTitle, description: <ErrorDisplayer error={err} /> });
    } finally {
      setImporting(false);
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
