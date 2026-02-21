import { useCallback } from "react";
import { useFetchData } from "@/hooks/use-fetch-data";
import { getTeamMailboxFolderMessageCount, getTeamMailboxFolderUnseenCount } from "../api-client";
import { Mail, MailOpen } from "lucide-react";

interface Props {
  domain: string;
  mailbox: string;
  folderName: string;
}

export default function TeamMailboxFolderCounts({ domain, mailbox, folderName }: Props) {
  const fetchTotal = useCallback(
    () => getTeamMailboxFolderMessageCount(domain, mailbox, folderName),
    [domain, mailbox, folderName]
  );
  const fetchUnseen = useCallback(
    () => getTeamMailboxFolderUnseenCount(domain, mailbox, folderName),
    [domain, mailbox, folderName]
  );

  const { data: total, isLoading: loadingTotal } = useFetchData<number>(fetchTotal);
  const { data: unseen, isLoading: loadingUnseen } = useFetchData<number>(fetchUnseen);

  if (loadingTotal || loadingUnseen) {
    return <span className="text-xs text-gray-400">...</span>;
  }

  return (
    <span className="flex items-center gap-3 text-xs text-gray-500">
      <span className="flex items-center gap-1" title="Total messages">
        <Mail className="w-3 h-3" />
        {total ?? "-"}
      </span>
      <span className="flex items-center gap-1" title="Unseen messages">
        <MailOpen className="w-3 h-3" />
        {unseen ?? "-"}
      </span>
    </span>
  );
}
