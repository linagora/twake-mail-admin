import CalendarDomainAdmins from "@/modules/domains/details/calendar-domain-admins";
import { useDomain } from "../domain-context";

export default function CalendarDomainAdminsPage() {
  const domain = useDomain();
  return (
    <div className="mt-4 p-4 bg-white rounded-2">
      <h3 className="text-lg font-semibold mb-2">Domain Admins</h3>
      <CalendarDomainAdmins domain={domain} defaultOpen />
    </div>
  );
}
