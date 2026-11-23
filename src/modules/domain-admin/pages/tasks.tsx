import DomainTasks from "@/modules/domains/details/domain-tasks";
import Tasks from "@/modules/tasks";
import { useIsAllowed } from "@/lib/proxy-resolver-context";
import { useDomain } from "../domain-context";
import { useTranslation } from "react-i18next";
import Header from "@/components/custom/header";

export default function TasksPage() {
  const { t } = useTranslation();
  const domain = useDomain();
  // GET /tasks spans every domain: the domain administrator lists the tasks of their domain only
  const canList = useIsAllowed("GET", "/domains/{domain}/tasks");
  return (
    <div className="mt-4 p-4 bg-white rounded-2">
      <Header headerTitle={t("domainAdminPages.tasks")} />
      <DomainTasks domain={domain} defaultOpen />
      {canList && <Tasks domain={domain} />}
    </div>
  );
}
