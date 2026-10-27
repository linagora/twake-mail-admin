import { useCallback } from "react";
import { useFetchData } from "@/hooks/use-fetch-data";
import { getMailboxMessageCount, getMailboxUnseenCount } from "../api-client";
import MessageCounts from "@/components/custom/message-counts";

interface Props {
  username: string;
  mailboxName: string;
}

export default function MailboxCounts({ username, mailboxName }: Props) {
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

  return <MessageCounts total={total} unseen={unseen} loading={loadingTotal || loadingUnseen} />;
}
