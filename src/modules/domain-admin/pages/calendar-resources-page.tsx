import CalendarDomainResources from "@/modules/domains/details/calendar-domain-resources";
import { useDomain } from "../domain-context";

export default function CalendarResourcesPage() {
  const domain = useDomain();
  return (
    <div className="mt-4 p-4 bg-white rounded-2">
      <h3 className="text-lg font-semibold mb-2">Resources</h3>
      <CalendarDomainResources
        domain={domain}
        defaultOpen
        resourceLink={(resourceId) => `/resources/resource/${encodeURIComponent(resourceId)}`}
      />
    </div>
  );
}
