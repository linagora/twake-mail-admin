import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
} from "@/components/ui/card"
import { getHealthCheck } from "@/lib/apiClient";
import { HealthCheckResult, HealthStatuses } from "@/types/healthCheck";
import { Skeleton } from "@/components/ui/skeleton";

export default function HealthCheck() {
  const [healthCheckResults, setHealthCheckResults] = useState<HealthCheckResult[]>();
  const [isLoading, setIsLoading] = useState(false);

  const handleGetHealthCheck = async () => {
    try {
      setIsLoading(true);
      const result = await getHealthCheck();

      setHealthCheckResults(result?.checks);
    } catch (error: any) {
      if (error.response?.data) {
        setHealthCheckResults(error.response?.data?.checks);
      }
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    handleGetHealthCheck();
  }, []);

  return (
    <div className="p-4">
      <h2 className="scroll-m-20 text-3xl font-semibold tracking-tight first:mt-0">
        Welcome to Twake Mail administration! This ease working with webadmin to manage Twake mail (doc)
      </h2>
      <p className="leading-7 mt-4">
        Healthcheck allows a quick diagnostic of your tmail server health. (doc)
      </p>

      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
          <Skeleton className="h-[58px] rounded-2" />
          <Skeleton className="h-[58px] rounded-2" />
          <Skeleton className="h-[58px] rounded-2" />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
        {
          healthCheckResults?.map((result) => (
            <Card
              key={result.componentName}
              className={
                result.status === HealthStatuses.HEALTHY
                  ? 'bg-green-600'
                  : result.status === HealthStatuses.DEGRADED
                    ? 'bg-orange-400'
                    : 'bg-red-600'
                }
              >
              <CardContent className="py-4 text-center">
                {result.componentName}
              </CardContent>
            </Card>
          ))
        }
      </div>
    </div>
  );
}
