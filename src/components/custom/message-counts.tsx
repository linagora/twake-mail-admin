import { useTranslation } from "react-i18next";

/**
 * The total and unseen message counters of a mailbox row, labelled in plain text: a hover
 * tooltip is never shown on a touch screen.
 */
export default function MessageCounts({ total, unseen, loading }: {
  total?: number | null;
  unseen?: number | null;
  loading: boolean;
}) {
  const { t } = useTranslation();
  if (loading) {
    return <span className="text-xs text-gray-400">...</span>;
  }
  return (
    <span className="flex flex-wrap justify-end gap-x-3 text-xs text-gray-500">
      <span className="whitespace-nowrap">{t("mailboxCounts.total", { value: total ?? "-" })}</span>
      <span className="whitespace-nowrap">{t("mailboxCounts.unseen", { value: unseen ?? "-" })}</span>
    </span>
  );
}
