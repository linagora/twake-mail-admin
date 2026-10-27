import { useCallback } from "react";
import { useFetchData } from "@/hooks/use-fetch-data";
import { getTeamMailboxFolderMessageCount, getTeamMailboxFolderUnseenCount } from "../api-client";
import MessageCounts from "@/components/custom/message-counts";

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

  return <MessageCounts total={total} unseen={unseen} loading={loadingTotal || loadingUnseen} />;
}
