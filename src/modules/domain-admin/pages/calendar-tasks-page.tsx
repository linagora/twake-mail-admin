import CalendarDomainTasks from "@/modules/domains/details/calendar-domain-tasks";
import { useDomain } from "../domain-context";

export default function CalendarTasksPage() {
  const domain = useDomain();
  return (
    <div className="mt-4 p-4 bg-white rounded-2">
      <h3 className="text-lg font-semibold mb-2">Tasks</h3>
      <CalendarDomainTasks domain={domain} defaultOpen />
    </div>
  );
}
