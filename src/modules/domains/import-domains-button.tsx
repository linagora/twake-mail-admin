import { useRef, useState, type ChangeEvent } from "react";
import { Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { toast } from "@/hooks/use-toast";
import ErrorDisplayer from "@/components/custom/error-displayer";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  const [open, setOpen] = useState(false);

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

  const chooseFile = () => {
    setOpen(false);
    inputRef.current?.click();
  };

  return (
    <>
      <input type="file" accept=".txt,text/plain" ref={inputRef} onChange={handleFile} className="hidden" />
      <Button variant="outline" onClick={() => setOpen(true)} disabled={importing}>
        {importing ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Upload className="w-4 h-4" aria-hidden="true" />}
        {t("domains.import.button")}
      </Button>
      {/* The expected format, in plain sight before picking the file */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{t("domains.import.title")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm whitespace-pre-line">{t("domains.import.help")}</p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={chooseFile}>
              <Upload className="w-4 h-4" aria-hidden="true" />
              {t("domains.import.chooseFile")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={shownFailures !== null} onOpenChange={(open) => { if (!open) setShownFailures(null); }}>
        <DialogContent aria-describedby={undefined} className="max-w-lg">
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
