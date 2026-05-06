import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getHealthCheck } from "./api-client";
import { HealthCheckResponseType, HealthStatuses } from "./types";
import Header from "@/components/custom/header";
import { useFetchData } from "@/hooks/use-fetch-data";
import { useTranslation } from "react-i18next";
import { appConfig } from "@/lib/config";

const DOCU_URL_MAIL =
  "https://james.staged.apache.org/james-project/3.10.0/servers/distributed/operate/webadmin.html#_healthcheck";
const DOCU_URL_CALENDAR =
  "https://github.com/linagora/twake-calendar-side-service/blob/main/docs/apis/webadmin.md";

const isCalendar = appConfig.application === "CALENDAR";

export default function HealthCheck() {
  const { t } = useTranslation();
  const {
    data: healthCheckResponse,
    isLoading,
  } = useFetchData<HealthCheckResponseType>(getHealthCheck);

  const healthCheckResults = healthCheckResponse?.checks || [];

  return (
    <div className="p-4">
      <Header
        headerTitle={isCalendar ? t("healthCheck.welcomeCalendar") : t("healthCheck.welcome")}
        headerSubTitle={isCalendar ? t("healthCheck.descriptionCalendar") : t("healthCheck.description")}
        docuUrl={isCalendar ? DOCU_URL_CALENDAR : DOCU_URL_MAIL}
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
