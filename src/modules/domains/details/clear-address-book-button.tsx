import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { Link } from "react-router";
import { Eraser, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { waitForTask } from "@/components/custom/dav-collection-actions";
import { useToast } from "@/hooks/use-toast";
import { useDomain } from "@/modules/domain-admin/domain-context";
import { clearDomainAddressBook, DomainAddressBookId } from "../api-client";

const INPUT_CLASS = "w-full mt-1 px-3 py-2 border rounded-md text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500";

// Labels separated by dots, each made of letters, digits and inner hyphens.
const DOMAIN_PATTERN = /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))*$/i;

const isValidSourceDomain = (sourceDomain: string): boolean =>
  sourceDomain === "" || DOMAIN_PATTERN.test(sourceDomain);

const ERROR_KEYS: Record<number, string> = {
  400: "domains.addressBookCounts.clear.error400",
  404: "domains.addressBookCounts.clear.error404",
  500: "domains.addressBookCounts.clear.error500",
};

const errorKey = (err: unknown): string => {
  const status = axios.isAxiosError(err) ? err.response?.status : undefined;
  return (status && ERROR_KEYS[status]) || "domains.addressBookCounts.clear.errorUnknown";
};

interface Props {
  domain: string;
  addressBookId: DomainAddressBookId;
  // Called once the clear task is over, so the row can re-read its counter.
  onCleared: () => void;
}

/**
 * Deletes the contacts of a domain address book, all of them or only those having a
 * mail address within a given domain. Destructive: the admin confirms by typing the
 * address book id.
 */
export default function ClearAddressBookButton({ domain, addressBookId, onCleared }: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const scopedDomain = useDomain() || undefined;
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [sourceDomain, setSourceDomain] = useState("");
  const [clearing, setClearing] = useState(false);
  // The task outlives a collapsed section: nothing is polled or set afterwards.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const trimmedSourceDomain = sourceDomain.trim();
  const sourceDomainValid = isValidSourceDomain(trimmedSourceDomain);
  const canSubmit = confirmation === addressBookId && sourceDomainValid && !clearing;

  const close = () => {
    setOpen(false);
    setConfirmation("");
    setSourceDomain("");
  };

  const handleClear = async () => {
    setClearing(true);
    try {
      const { taskId } = await clearDomainAddressBook(domain, addressBookId, trimmedSourceDomain || undefined);
      close();
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
      await waitForTask(taskId, scopedDomain, () => mounted.current);
      if (mounted.current) onCleared();
    } catch (err) {
      toast({ title: t("domains.addressBookCounts.clear.error"), description: t(errorKey(err)) });
    } finally {
      if (mounted.current) setClearing(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        disabled={clearing}
        className="p-1.5 rounded-md hover:bg-gray-200 transition disabled:opacity-50"
        title={t("domains.addressBookCounts.clear.title")}
      >
        {clearing
          ? <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-600" />
          : <Eraser className="w-3.5 h-3.5 text-red-600" />}
      </button>

      <Dialog open={open} onOpenChange={(v) => { if (!v) close(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("domains.addressBookCounts.clear.title")} — {domain}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-red-600">{t("domains.addressBookCounts.clear.warning")}</p>
            <div>
              <label className="text-sm font-medium" htmlFor="clear-source-domain">
                {t("domains.addressBookCounts.clear.sourceDomain")}
              </label>
              <input
                id="clear-source-domain"
                type="text"
                value={sourceDomain}
                placeholder="student.example.org"
                onChange={(e) => setSourceDomain(e.target.value)}
                className={INPUT_CLASS}
              />
              {!sourceDomainValid && (
                <p className="text-xs text-red-600 mt-1">{t("domains.addressBookCounts.clear.invalidSourceDomain")}</p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium" htmlFor="clear-confirmation">
                {t("domains.addressBookCounts.clear.confirmation", { addressBookId })}
              </label>
              <input
                id="clear-confirmation"
                type="text"
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                className={INPUT_CLASS}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={close}>
                {t("common.cancel")}
              </Button>
              <Button variant="destructive" size="sm" onClick={handleClear} disabled={!canSubmit}>
                {clearing && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
                {t("domains.addressBookCounts.clear.submit")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
