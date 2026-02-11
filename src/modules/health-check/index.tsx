import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getHealthCheck } from "./api-client";
import { HealthCheckResponseType, HealthStatuses } from "./types";
import Header from "@/components/custom/header";
import { useFetchData } from "@/hooks/use-fetch-data";

const headerTitle =
  "Welcome to Twake Mail administration! This ease working with webadmin to manage Twake mail";

const headerSubTitle =
  "Healthcheck allows a quick diagnostic of your tmail server health.";

const docuUrl =
  "https://james.staged.apache.org/james-project/3.9.0/servers/distributed/operate/webadmin.html#_healthcheck";

export default function HealthCheck() {
  // Modify the hook to extract `checks` from the response
  const {
    data: healthCheckResponse,
    isLoading,
  } = useFetchData<HealthCheckResponseType>(getHealthCheck);

  // Extract health check results from the response
  const healthCheckResults = healthCheckResponse?.checks || [];

  return (
    <div className="p-4">
      <Header
        headerTitle={headerTitle}
        headerSubTitle={headerSubTitle}
        docuUrl={docuUrl}
      />

      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
          <Skeleton className="h-[58px] rounded-2" />
          <Skeleton className="h-[58px] rounded-2" />
          <Skeleton className="h-[58px] rounded-2" />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
        {healthCheckResults?.map((result) => (
          <Card
            key={result.componentName}
            className={
              result.status === HealthStatuses.HEALTHY
                ? "bg-green-600"
                : result.status === HealthStatuses.DEGRADED
                ? "bg-orange-400"
                : "bg-red-600"
            }
          >
            <CardContent className="py-4 text-center break-words">
              {`${result.componentName}`}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
