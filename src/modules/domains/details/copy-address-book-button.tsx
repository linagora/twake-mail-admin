import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { Link } from "react-router";
import { Loader2, UserPlus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { waitForTask } from "@/components/custom/dav-collection-actions";
import { useToast } from "@/hooks/use-toast";
import { useDomain } from "@/modules/domain-admin/domain-context";
import { copyIntoDomainAddressBook, DomainAddressBookId } from "../api-client";
import { isValidDomainName } from "./domain-name";

const INPUT_CLASS = "w-full mt-1 px-3 py-2 border rounded-md text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500";

const ERROR_KEYS: Record<number, string> = {
  400: "domains.addressBookCounts.copy.error400",
  404: "domains.addressBookCounts.copy.error404",
  500: "domains.addressBookCounts.copy.error500",
};

const errorKey = (err: unknown): string => {
  const status = axios.isAxiosError(err) ? err.response?.status : undefined;
  return (status && ERROR_KEYS[status]) || "domains.addressBookCounts.copy.errorUnknown";
};

// The translation key of the problem with the source domain, if any. Nothing is reported
// while the field is still empty.
const sourceDomainProblem = (sourceDomain: string, domain: string): string | undefined => {
  if (sourceDomain === "") return undefined;
  if (!isValidDomainName(sourceDomain)) return "domains.addressBookCounts.copy.invalidSourceDomain";
  if (sourceDomain.toLowerCase() === domain.toLowerCase()) return "domains.addressBookCounts.copy.sameDomain";
  return undefined;
};

interface Props {
  domain: string;
  addressBookId: DomainAddressBookId;
  // Called once the copy task is over, so the row can re-read its counter.
  onCopied: () => void;
}

/**
 * Copies the users of another domain into a domain address book, as contacts, optionally
 * reading them from the LDAP through a filter. Copying again updates the existing contacts
 * and never deletes any: the clear action removes the users who left the source domain.
 */
export default function CopyAddressBookButton({ domain, addressBookId, onCopied }: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const scopedDomain = useDomain() || undefined;
  const [open, setOpen] = useState(false);
  const [sourceDomain, setSourceDomain] = useState("");
  const [ldapFilter, setLdapFilter] = useState("");
  const [copying, setCopying] = useState(false);
  // The task outlives a collapsed section: nothing is polled or set afterwards.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const trimmedSourceDomain = sourceDomain.trim();
  const trimmedLdapFilter = ldapFilter.trim();
  const problem = sourceDomainProblem(trimmedSourceDomain, domain);
  const canSubmit = trimmedSourceDomain !== "" && !problem && !copying;

  const close = () => {
    setOpen(false);
    setSourceDomain("");
    setLdapFilter("");
  };

  const handleCopy = async () => {
    setCopying(true);
    try {
      const { taskId } = await copyIntoDomainAddressBook(
        domain, addressBookId, trimmedSourceDomain, trimmedLdapFilter || undefined
      );
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
      if (mounted.current) onCopied();
    } catch (err) {
      toast({ title: t("domains.addressBookCounts.copy.error"), description: t(errorKey(err)) });
    } finally {
      if (mounted.current) setCopying(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        disabled={copying}
        className="p-1.5 rounded-md hover:bg-gray-200 transition disabled:opacity-50"
        title={t("domains.addressBookCounts.copy.title")}
      >
        {copying
          ? <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-600" />
          : <UserPlus className="w-3.5 h-3.5 text-gray-600" />}
      </button>

      <Dialog open={open} onOpenChange={(v) => { if (!v) close(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("domains.addressBookCounts.copy.title")} — {domain}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium" htmlFor="copy-source-domain">
                {t("domains.addressBookCounts.copy.sourceDomain")}
              </label>
              <input
                id="copy-source-domain"
                type="text"
                value={sourceDomain}
                placeholder="student.example.org"
                onChange={(e) => setSourceDomain(e.target.value)}
                className={INPUT_CLASS}
              />
              {problem && <p className="text-xs text-red-600 mt-1">{t(problem)}</p>}
            </div>
            <div>
              <label className="text-sm font-medium" htmlFor="copy-ldap-filter">
                {t("domains.addressBookCounts.copy.ldapFilter")}
              </label>
              <input
                id="copy-ldap-filter"
                type="text"
                value={ldapFilter}
                placeholder="(employeeType=student)"
                onChange={(e) => setLdapFilter(e.target.value)}
                className={`${INPUT_CLASS} font-mono`}
              />
              <p className="text-xs text-gray-500 mt-1">{t("domains.addressBookCounts.copy.ldapFilterHelp")}</p>
            </div>
            <p className="text-sm text-gray-600">{t("domains.addressBookCounts.copy.note")}</p>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={close}>
                {t("common.cancel")}
              </Button>
              <Button size="sm" onClick={handleCopy} disabled={!canSubmit}>
                {copying && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
                {t("domains.addressBookCounts.copy.submit")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
