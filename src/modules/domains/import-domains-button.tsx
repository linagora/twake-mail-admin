import { useRef, useState, type ChangeEvent } from "react";
import { CircleHelp, Loader2, Upload } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "@/hooks/use-toast";
import ErrorDisplayer from "@/components/custom/error-displayer";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { createDomain, getDomains } from "./api-client";
import { importDomains, parseDomainList, type ImportFailure, type ImportProgress } from "./domain-import";

interface Props {
  // Called once the import is over, so that the list shows the new domains.
  onImported: () => void;
}

export default function ImportDomainsButton({ onImported }: Props) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [shownFailures, setShownFailures] = useState<ImportFailure[] | null>(null);

  const describe = (progress: ImportProgress) => (
    <div className="space-y-2">
      <p>
        {t("domains.import.counters", {
          created: progress.created,
          alreadyExisting: progress.alreadyExisting,
          errors: progress.failures.length,
        })}
      </p>
      {progress.failures.length > 0 && (
        <button
          onClick={() => setShownFailures(progress.failures)}
          className="text-blue-600 hover:underline"
        >
          {t("domains.import.moreDetails")}
        </button>
      )}
    </div>
  );

  const runImport = async (content: string) => {
    const domains = parseDomainList(content);
    const handle = toast({ title: t("domains.import.inProgress", { processed: 0, total: domains.length }), duration: Infinity });
    const show = (title: string, progress: ImportProgress) =>
      handle.update({ id: handle.id, title, description: describe(progress), duration: Infinity });

    const result = await importDomains(domains, await getDomains(), createDomain, (progress) =>
      show(t("domains.import.inProgress", { processed: progress.processed, total: progress.total }), progress)
    );
    show(t("domains.import.done"), result);
  };

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Cleared right away so that re-picking the same file fires a change again.
    event.target.value = "";
    if (!file) return;
    setImporting(true);
    try {
      await runImport(await file.text());
    } catch (err) {
      toast({ title: t("domains.import.error"), description: <ErrorDisplayer error={err} /> });
    } finally {
      setImporting(false);
      onImported();
    }
  };

  return (
    <>
      <input type="file" accept=".txt,text/plain" ref={inputRef} onChange={handleFile} className="hidden" />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={importing}
        className="px-4 py-2 border rounded-md hover:bg-gray-100 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        title={t("domains.import.button")}
      >
        {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
        {t("domains.import.button")}
      </button>
      <TooltipProvider>
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <span className="self-center text-gray-500 cursor-help" aria-label={t("domains.import.help")}>
              <CircleHelp className="w-4 h-4" />
            </span>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs whitespace-pre-line">
            {t("domains.import.help")}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <Dialog open={shownFailures !== null} onOpenChange={(open) => { if (!open) setShownFailures(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("domains.import.failuresTitle", { count: shownFailures?.length ?? 0 })}</DialogTitle>
          </DialogHeader>
          <ul className="max-h-[60vh] overflow-auto space-y-1 text-sm">
            {shownFailures?.map(({ domain, reason }) => (
              <li key={domain}>
                <span className="font-medium">{domain}</span>
                <span className="text-gray-500"> — {reason}</span>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  );
}
