import DomainQuotaSection from "@/modules/domains/details/domain-quota";
import { useDomain } from "../domain-context";

export default function QuotaPage() {
  const domain = useDomain();
  return (
    <div className="mt-4 p-4 bg-white rounded-2">
      <h3 className="text-lg font-semibold mb-2">Quota</h3>
      <DomainQuotaSection domain={domain} defaultOpen />
    </div>
  );
}
