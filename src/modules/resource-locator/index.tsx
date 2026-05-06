import { useState } from "react";
import { Search, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useIsAllowed } from "@/lib/proxy-resolver-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Header from "@/components/custom/header";
import { lookupMailbox, lookupMessage, MailboxResult } from "./api-client";
import { APIError } from "@/lib/apiClient";

const docuUrl = "https://james.staged.apache.org/james-project/3.10.0/servers/distributed/operate/webadmin.html";

type Status = "idle" | "loading" | "success" | "not_found" | "invalid" | "error";

interface SearchSectionProps {
  label: string;
  placeholder: string;
  onSearch: (id: string) => void;
  status: Status;
  children: React.ReactNode;
}

function SearchSection({ label, placeholder, onSearch, status, children }: SearchSectionProps) {
  const { t } = useTranslation();
  const [value, setValue] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) onSearch(value.trim());
  };

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-base font-semibold">{label}</h2>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            className="w-full pl-9 pr-4 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <Button type="submit" size="sm" disabled={status === "loading" || !value.trim()}>
          {status === "loading" ? <Loader2 className="w-4 h-4 animate-spin" /> : t("resourceLocator.lookupButton")}
        </Button>
      </form>

      {status === "not_found" && (
        <p className="text-sm text-red-500">{t("resourceLocator.notFound")}</p>
      )}
      {status === "invalid" && (
        <p className="text-sm text-red-500">{t("resourceLocator.invalidId")}</p>
      )}
      {status === "error" && (
        <p className="text-sm text-red-500">{t("resourceLocator.lookupError")}</p>
      )}
      {status === "success" && children}
    </div>
  );
}

function MailboxCard({ mailbox }: { mailbox: MailboxResult }) {
  const { t } = useTranslation();
  return (
    <Card>
      <CardContent className="py-3 flex flex-col gap-1 text-sm">
        <div>
          <span className="font-medium text-muted-foreground">{t("resourceLocator.mailboxIdLabel")} </span>
          <span className="font-mono">{mailbox.mailboxId}</span>
        </div>
        <div>
          <span className="font-medium text-muted-foreground">{t("resourceLocator.mailboxPathLabel")} </span>
          <span className="font-mono">{mailbox.mailboxPath}</span>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ResourceLocator() {
  const { t } = useTranslation();
  const canLookupMailbox = useIsAllowed("GET", "/mailboxes/{mailboxId}");
  const canLookupMessage = useIsAllowed("GET", "/messages/{messageId}");
  const [mailboxStatus, setMailboxStatus] = useState<Status>("idle");
  const [mailboxResult, setMailboxResult] = useState<MailboxResult | null>(null);

  const [messageStatus, setMessageStatus] = useState<Status>("idle");
  const [messageMailboxes, setMessageMailboxes] = useState<MailboxResult[]>([]);

  const handleMailboxSearch = async (id: string) => {
    setMailboxStatus("loading");
    setMailboxResult(null);
    try {
      const result = await lookupMailbox(id);
      setMailboxResult(result);
      setMailboxStatus("success");
    } catch (err: unknown) {
      const apiErr = err as APIError;
      const status = apiErr.response?.status;
      if (status === 404) setMailboxStatus("not_found");
      else if (status === 400) setMailboxStatus("invalid");
      else setMailboxStatus("error");
    }
  };

  const handleMessageSearch = async (id: string) => {
    setMessageStatus("loading");
    setMessageMailboxes([]);
    try {
      const result = await lookupMessage(id);
      setMessageMailboxes(result.mailboxes);
      setMessageStatus("success");
    } catch (err: unknown) {
      const apiErr = err as APIError;
      const status = apiErr.response?.status;
      if (status === 404) setMessageStatus("not_found");
      else if (status === 400) setMessageStatus("invalid");
      else setMessageStatus("error");
    }
  };

  return (
    <div className="p-4">
      <Header headerTitle={t("sidebar.resourceLocator")} headerSubTitle={t("resourceLocator.subtitle")} docuUrl={docuUrl} />

      <div className="mt-6 flex flex-col gap-8 max-w-2xl">
        {canLookupMailbox && (
          <SearchSection
            label={t("resourceLocator.lookupMailboxLabel")}
            placeholder={t("resourceLocator.mailboxPlaceholder")}
            onSearch={handleMailboxSearch}
            status={mailboxStatus}
          >
            {mailboxResult && <MailboxCard mailbox={mailboxResult} />}
          </SearchSection>
        )}

        {canLookupMailbox && canLookupMessage && <hr />}

        {canLookupMessage && (
          <SearchSection
            label={t("resourceLocator.locateMessageLabel")}
            placeholder={t("resourceLocator.messagePlaceholder")}
            onSearch={handleMessageSearch}
            status={messageStatus}
          >
            {messageMailboxes.length > 0 ? (
              <div className="flex flex-col gap-2">
                <p className="text-sm text-muted-foreground">
                  {t("resourceLocator.foundInMailboxes", { count: messageMailboxes.length })}
                </p>
                {messageMailboxes.map((mb) => (
                  <MailboxCard key={mb.mailboxId} mailbox={mb} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t("resourceLocator.notInAnyMailbox")}</p>
            )}
          </SearchSection>
        )}
      </div>
    </div>
  );
}
