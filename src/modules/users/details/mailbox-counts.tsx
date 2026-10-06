import { useCallback } from "react";
import { useFetchData } from "@/hooks/use-fetch-data";
import { getMailboxMessageCount, getMailboxUnseenCount } from "../api-client";
import { Mail, MailOpen } from "lucide-react";
import { useTranslation } from "react-i18next";

interface Props {
  username: string;
  mailboxName: string;
}

export default function MailboxCounts({ username, mailboxName }: Props) {
  const { t } = useTranslation();
  const fetchTotal = useCallback(
    () => getMailboxMessageCount(username, mailboxName),
    [username, mailboxName]
  );
  const fetchUnseen = useCallback(
    () => getMailboxUnseenCount(username, mailboxName),
    [username, mailboxName]
  );

  const { data: total, isLoading: loadingTotal } = useFetchData<number>(fetchTotal);
  const { data: unseen, isLoading: loadingUnseen } = useFetchData<number>(fetchUnseen);

  if (loadingTotal || loadingUnseen) {
    return <span className="text-xs text-gray-400">...</span>;
  }

  return (
    <span className="flex items-center gap-3 text-xs text-gray-500">
      <span className="flex items-center gap-1" title={t("mailboxCounts.totalMessages")}>
        <Mail className="w-3 h-3" />
        {total ?? "-"}
      </span>
      <span className="flex items-center gap-1" title={t("mailboxCounts.unseenMessages")}>
        <MailOpen className="w-3 h-3" />
        {unseen ?? "-"}
      </span>
    </span>
  );
}
