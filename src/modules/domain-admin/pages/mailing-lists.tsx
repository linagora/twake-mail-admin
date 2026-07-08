import { useTranslation } from "react-i18next";
import MailingListsList from "@/modules/mailing-lists/mailing-lists-list";
import { useDomain } from "../domain-context";

export default function MailingListsPage() {
  const { t } = useTranslation();
  const domain = useDomain();
  return (
    <div className="mt-4 p-4 bg-white rounded-2">
      <h3 className="text-lg font-semibold mb-2">{t("domainAdminPages.mailingLists")}</h3>
      <MailingListsList domain={domain} />
    </div>
  );
}
