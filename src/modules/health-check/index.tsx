import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getHealthCheck } from "./api-client";
import { HealthCheckResponseType, HealthCheckType, HealthStatuses } from "./types";
import { groupHealthChecks } from "./sections";
import Header from "@/components/custom/header";
import { useFetchData } from "@/hooks/use-fetch-data";
import { useTranslation } from "react-i18next";
import { appConfig } from "@/lib/config";

const DOCU_URL_MAIL =
  "https://james.staged.apache.org/james-project/3.10.0/servers/distributed/operate/webadmin.html#_healthcheck";
const DOCU_URL_CALENDAR =
  "https://github.com/linagora/twake-calendar-side-service/blob/main/docs/apis/webadmin.md";

const isCalendar = appConfig.application === "CALENDAR";

const statusColor = (status: HealthStatuses) =>
  status === HealthStatuses.HEALTHY
    ? "bg-green-600"
    : status === HealthStatuses.DEGRADED
    ? "bg-orange-400"
    : "bg-red-600";

function HealthCheckCard({ result }: { result: HealthCheckType }) {
  const card = (
    <Card className={statusColor(result.status)}>
      <CardContent className="py-4 text-center break-words">
        {result.componentName}
      </CardContent>
    </Card>
  );

  if (result.status === HealthStatuses.HEALTHY || !result.cause) {
    return card;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div tabIndex={0} className="cursor-help">
          {card}
        </div>
      </TooltipTrigger>
      <TooltipContent className="max-w-md whitespace-pre-wrap break-words">
        {result.cause}
      </TooltipContent>
    </Tooltip>
  );
}

export default function HealthCheck() {
  const { t } = useTranslation();
  const {
    data: healthCheckResponse,
    isLoading,
  } = useFetchData<HealthCheckResponseType>(getHealthCheck);

  const sections = groupHealthChecks(healthCheckResponse?.checks || [], isCalendar);

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

      <TooltipProvider delayDuration={0}>
        {sections.map((section) => (
          <section key={section.key} className="mt-6">
            <h2 className="text-lg font-semibold">
              {t(`healthCheck.sections.${section.key}`)}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-2">
              {section.checks.map((result) => (
                <HealthCheckCard key={result.componentName} result={result} />
              ))}
            </div>
          </section>
        ))}
      </TooltipProvider>
    </div>
  );
}
