import { useCallback } from "react";
import RateLimitsSection from "@/components/custom/rate-limits-section";
import { getDomainRateLimits, updateDomainRateLimits } from "@/modules/domains/api-client";
import { useDomain } from "../domain-context";

export default function RateLimitingPage() {
  const domain = useDomain();

  const fetchRateLimits = useCallback(() => getDomainRateLimits(domain), [domain]);
  const updateRateLimits = useCallback((limits: any) => updateDomainRateLimits(domain, limits), [domain]);

  return (
    <div className="mt-4 p-4 bg-white rounded-2">
      <h3 className="text-lg font-semibold mb-2">Rate Limiting</h3>
      <RateLimitsSection
        fetchRateLimits={fetchRateLimits}
        updateRateLimits={updateRateLimits}
        defaultOpen
      />
    </div>
  );
}
