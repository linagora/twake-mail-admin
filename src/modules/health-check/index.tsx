import { Fragment } from "react";
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
import { statusStyle } from "./status-style";
import Header from "@/components/custom/header";
import { useFetchData } from "@/hooks/use-fetch-data";
import { useTranslation } from "react-i18next";
import { appConfig } from "@/lib/config";
import { CALENDAR_WEBADMIN_DOC_URL } from "@/lib/calendar-docs";
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";

const DOCU_URL_MAIL =
  "https://james.staged.apache.org/james-project/3.10.0/servers/distributed/operate/webadmin.html#_healthcheck";

const isCalendar = appConfig.application === "CALENDAR";

// James names its health checks in CamelCase, without spaces: offer a line break between the
// words (EventDeadLetters|HealthCheck, RabbitMQ|DeadLetter...) rather than at an arbitrary letter
function ComponentName({ name }: { name: string }) {
  const words = name.split(/(?<=[a-z0-9])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])/);
  return (
    <>
      {words.map((word, index) => (
        <Fragment key={index}>
          {index > 0 && <wbr />}
          {word}
        </Fragment>
      ))}
    </>
  );
}

const STATUS_ICONS = {
  [HealthStatuses.HEALTHY]: CheckCircle2,
  [HealthStatuses.DEGRADED]: AlertTriangle,
  [HealthStatuses.UNHEALTHY]: XCircle,
};

function HealthCheckCard({ result }: { result: HealthCheckType }) {
  const { t } = useTranslation();
  const StatusIcon = STATUS_ICONS[result.status];
  // The status is written out, not only conveyed by the card colour (WCAG 1.4.1)
  const card = (
    <Card className={statusStyle(result.status)}>
      <CardContent className="py-4 text-center break-words">
        <p><ComponentName name={result.componentName} /></p>
        <p className="mt-1 text-xs font-medium inline-flex items-center gap-1">
          {StatusIcon && <StatusIcon className="h-3.5 w-3.5" aria-hidden="true" />}
          {t(`healthCheck.status.${result.status}`)}
        </p>
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
    error,
  } = useFetchData<HealthCheckResponseType>(getHealthCheck);

  const sections = groupHealthChecks(healthCheckResponse?.checks || [], isCalendar);

  return (
    <div className="p-4">
      <Header
        headerTitle={isCalendar ? t("healthCheck.welcomeCalendar") : t("healthCheck.welcome")}
        headerSubTitle={isCalendar ? t("healthCheck.descriptionCalendar") : t("healthCheck.description")}
        docuUrl={isCalendar ? CALENDAR_WEBADMIN_DOC_URL : DOCU_URL_MAIL}
      />

      {error && <p role="alert" className="text-red-500 mt-4">{t("common.errorPrefix", { message: error })}</p>}

      {isLoading && (
        <p role="status" className="text-sm text-muted-foreground mt-4">{t("healthCheck.checking")}</p>
      )}
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
