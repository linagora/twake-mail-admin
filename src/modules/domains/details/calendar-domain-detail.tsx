import { useParams } from "react-router";
import CalendarDomainAdmins from "./calendar-domain-admins";
import CalendarDomainResources from "./calendar-domain-resources";
import CalendarDomainTeamCalendars from "./calendar-domain-team-calendars";
import CalendarDomainSettings from "./calendar-domain-settings";
import CalendarDomainTasks from "./calendar-domain-tasks";
import DomainAddressBookCounts from "./domain-address-book-counts";
import { useTranslation } from "react-i18next";
import Header from "@/components/custom/header";
import { useBreadcrumbs } from "@/hooks/use-breadcrumbs";
import { ExpandCollapseAll, SectionsProvider, useSectionFacts } from "@/components/custom/collapsible-section";
import { CountFact } from "@/components/custom/summary-facts";
import { DomainSummary } from "./domain-summary";

// Its users, then what the sections of the page counted, each chip opening its section
function CalendarDomainSummary({ domain }: { domain: string }) {
  const facts = useSectionFacts();
  return (
    <DomainSummary
      domain={domain}
      extra={
        <>
          <CountFact section="admins" count={facts["admins"]} labelKey="domains.summary.admins" />
          <CountFact section="resources" count={facts["resources"]} labelKey="domains.summary.resources" />
          <CountFact section="team-calendars" count={facts["team-calendars"]} labelKey="domains.summary.teamCalendars" />
        </>
      }
    />
  );
}

export default function CalendarDomainDetail() {
  const { t } = useTranslation();
  const { domain } = useParams();
  const breadcrumbs = useBreadcrumbs();

  return (
    <SectionsProvider page="domain">
    <Header headerTitle={domain} headerSubTitle={t("domains.detailKind")} breadcrumb={breadcrumbs.domains()} actions={<ExpandCollapseAll />} />
    <CalendarDomainSummary domain={domain!} />
    <div className="mt-4 p-4 bg-white rounded-2">

      <CalendarDomainAdmins domain={domain!} />
      <CalendarDomainResources domain={domain!} />
      <CalendarDomainTeamCalendars domain={domain!} />
      <CalendarDomainSettings domain={domain!} />
      <DomainAddressBookCounts domain={domain!} />
      <CalendarDomainTasks domain={domain!} />
    </div>
    </SectionsProvider>
  );
}
