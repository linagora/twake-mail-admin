import DomainTeamMailboxes from "@/modules/domains/details/domain-team-mailboxes";
import { useDomain } from "../domain-context";
import { useTranslation } from "react-i18next";

export default function TeamMailboxesPage() {
  const { t } = useTranslation();
  const domain = useDomain();
  return (
    <div className="mt-4 p-4 bg-white rounded-2">
      <h3 className="text-lg font-semibold mb-2">{t("domainAdminPages.teamMailboxes")}</h3>
      <DomainTeamMailboxes domain={domain} defaultOpen />
    </div>
  );
}
