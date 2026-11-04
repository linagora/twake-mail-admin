import { useState } from "react";
import { Link } from "react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { currentLocale } from "@/i18n/locale";
import { getHealthCheck } from "./api-client";
import { HealthCheckResponseType, HealthCheckType, HealthStatuses } from "./types";
import { componentScreen, groupHealthChecks, summarizeHealthChecks } from "./sections";
import { statusStyle } from "./status-style";
import Header from "@/components/custom/header";
import { useFetchData } from "@/hooks/use-fetch-data";
import { useTranslation } from "react-i18next";
import { appConfig } from "@/lib/config";
import { CALENDAR_WEBADMIN_DOC_URL } from "@/lib/calendar-docs";
import CamelCaseName from "@/components/custom/camel-case-name";
import { AlertTriangle, CheckCircle2, Loader2, RefreshCcw, XCircle } from "lucide-react";

const DOCU_URL_MAIL =
  "https://james.staged.apache.org/james-project/3.10.0/servers/distributed/operate/webadmin.html#_healthcheck";

const isCalendar = appConfig.application === "CALENDAR";

const STATUS_ICONS = {
  [HealthStatuses.HEALTHY]: CheckCircle2,
  [HealthStatuses.DEGRADED]: AlertTriangle,
  [HealthStatuses.UNHEALTHY]: XCircle,
};

function HealthCheckCard({ result }: { result: HealthCheckType }) {
  const { t } = useTranslation();
  const StatusIcon = STATUS_ICONS[result.status];
  const screen = componentScreen(result.componentName);
  const healthy = result.status === HealthStatuses.HEALTHY;
  // The status is written out, not only conveyed by the card colour (WCAG 1.4.1), and the
  // cause is visible without hovering
  const card = (
    <Card className={`${statusStyle(result.status)} h-full ${screen ? "transition hover:shadow-md" : ""}`}>
      <CardContent className="py-4 text-center break-words flex flex-col h-full">
        <p><CamelCaseName name={result.componentName} /></p>
        <p className="mt-1 text-xs font-medium inline-flex items-center justify-center gap-1">
          {StatusIcon && <StatusIcon className="h-3.5 w-3.5" aria-hidden="true" />}
          {t(`healthCheck.status.${result.status}`)}
        </p>
        {!healthy && result.cause && <p className="mt-2 text-xs line-clamp-3" title={result.cause}>{result.cause}</p>}
        {screen && <span className="mt-auto pt-2 self-end text-xs font-medium underline">{t("healthCheck.open")} →</span>}
      </CardContent>
    </Card>
  );

  return screen
    ? <Link to={screen} className="block rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500">{card}</Link>
    : card;
}

const BANNER_STYLES = {
  healthy: "border-green-300 bg-green-50 text-green-900",
  degraded: "border-orange-300 bg-orange-50 text-orange-900",
  unhealthy: "border-red-300 bg-red-50 text-red-900",
} as const;

const BANNER_ICONS = { healthy: CheckCircle2, degraded: AlertTriangle, unhealthy: XCircle } as const;

/** The overall statement: all healthy, or how many need attention and why, with where to go. */
function SummaryBanner({ checks, checkedAt, refreshButton }: { checks: HealthCheckType[]; checkedAt: Date | null; refreshButton: React.ReactNode }) {
  const { t } = useTranslation();
  const summary = summarizeHealthChecks(checks);
  const level = summary.unhealthy > 0 ? "unhealthy" : summary.degraded > 0 ? "degraded" : "healthy";
  const Icon = BANNER_ICONS[level];
  return (
    <div role="status" className={`mt-4 rounded-lg border p-4 ${BANNER_STYLES[level]}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="font-medium inline-flex items-center gap-2">
          <Icon className="w-5 h-5 shrink-0" aria-hidden="true" />
          {level === "healthy"
            ? t("healthCheck.summary.healthy", { count: summary.count })
            : t("healthCheck.summary.problems", { unhealthy: summary.unhealthy, degraded: summary.degraded, count: summary.count })}
        </p>
        <div className="flex items-center gap-3 text-sm">
          {checkedAt && (
            <span>{t("healthCheck.checkedAt", { time: checkedAt.toLocaleTimeString(currentLocale(), { hour: "2-digit", minute: "2-digit", second: "2-digit" }) })}</span>
          )}
          {refreshButton}
        </div>
      </div>
      {summary.problems.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm">
          {summary.problems.map((problem) => {
            const screen = componentScreen(problem.componentName);
            return (
              <li key={problem.componentName} className="break-words">
                <span className="font-medium">{problem.componentName}</span>
                {" — "}{t(`healthCheck.status.${problem.status}`)}
                {problem.cause && <> — {problem.cause}</>}
                {screen && <> <Link to={screen} className="underline font-medium">{t("healthCheck.open")} →</Link></>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default function HealthCheck() {
  const { t } = useTranslation();
  const {
    data: healthCheckResponse,
    isLoading,
    error,
    refresh,
  } = useFetchData<HealthCheckResponseType>(getHealthCheck);
  // When the response shown was received
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);
  const [checkedResponse, setCheckedResponse] = useState(healthCheckResponse);
  if (healthCheckResponse !== checkedResponse) {
    setCheckedResponse(healthCheckResponse);
    if (healthCheckResponse) setCheckedAt(new Date());
  }

  const checks = healthCheckResponse?.checks || [];
  const sections = groupHealthChecks(checks, isCalendar);

  // Checking again keeps the cards of the previous check on screen
  const refreshButton = (
    <Button variant="outline" size="sm" onClick={refresh} disabled={isLoading}>
      {isLoading ? <Loader2 className="animate-spin" aria-hidden="true" /> : <RefreshCcw aria-hidden="true" />}
      {t("healthCheck.refresh")}
    </Button>
  );

  return (
    <div className="p-4">
      <Header
        headerTitle={isCalendar ? t("healthCheck.welcomeCalendar") : t("healthCheck.welcome")}
        headerSubTitle={isCalendar ? t("healthCheck.descriptionCalendar") : t("healthCheck.description")}
        docuUrl={isCalendar ? CALENDAR_WEBADMIN_DOC_URL : DOCU_URL_MAIL}
      />

      {error && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <p role="alert" className="text-red-500">{t("common.errorPrefix", { message: error })}</p>
          {refreshButton}
        </div>
      )}

      {isLoading && !healthCheckResponse && (
        <>
          <p role="status" className="text-sm text-muted-foreground mt-4">{t("healthCheck.checking")}</p>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
            <Skeleton className="h-[58px] rounded-2" />
            <Skeleton className="h-[58px] rounded-2" />
            <Skeleton className="h-[58px] rounded-2" />
          </div>
        </>
      )}

      {healthCheckResponse && !error && (
        <SummaryBanner checks={checks} checkedAt={checkedAt} refreshButton={refreshButton} />
      )}

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
    </div>
  );
}
