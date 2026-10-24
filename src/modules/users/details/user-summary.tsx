import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useFetchData } from "@/hooks/use-fetch-data";
import { useIsAllowed } from "@/lib/proxy-resolver-context";
import { formatByteSize } from "@/i18n/format-size";
import { formatPercent } from "@/i18n/format-percent";
import { useSectionFacts } from "@/components/custom/collapsible-section";
import { CountFact, Fact, Strip } from "@/components/custom/summary-facts";
import { getUserQuota, getUserVacation } from "../api-client";
import { UserQuota } from "../types";
import type { ForwardsFact } from "./user-forwards";

// Same thresholds as the quota bars of the sections
const quotaBarClass = (ratio: number) => (ratio > 0.9 ? "bg-red-500" : ratio >= 0.7 ? "bg-amber-500" : "bg-green-500");

function QuotaFact({ quota }: { quota: UserQuota }) {
  const { t } = useTranslation();
  const limit = quota.computed?.size;
  const used = formatByteSize(quota.occupation.size);
  if (limit == null || limit < 0) return <Fact section="quota">{t("users.summary.quotaUnlimited", { used })}</Fact>;
  const ratio = quota.occupation.ratio.size;
  return (
    <Fact section="quota">
      <span className="flex flex-col gap-1">
        <span>{t("users.summary.quota", { used, limit: formatByteSize(limit), percent: formatPercent(ratio) })}</span>
        <span className="block h-1 w-full rounded-full bg-gray-200" aria-hidden="true">
          <span className={`block h-1 rounded-full ${quotaBarClass(ratio)}`} style={{ width: `${Math.min(ratio * 100, 100)}%` }} />
        </span>
      </span>
    </Fact>
  );
}

function ForwardsFactChip({ forwards }: { forwards: ForwardsFact }) {
  const { t } = useTranslation();
  const { destinations, copyKept } = forwards;
  const label = !copyKept
    ? t("users.summary.forwardsNoCopy", { count: destinations.length })
    : destinations.length === 1
      ? t("users.summary.forwardsTo", { address: destinations[0].mailAddress })
      : t("users.summary.forwards", { count: destinations.length });
  return <Fact section="forwards">{label}</Fact>;
}

// Once its section has loaded or saved it, the section's value is the latest one
function useLatest<T>(allowed: boolean, fetch: () => Promise<T>, fact: T | undefined): T | undefined {
  const { data } = useFetchData<T>(allowed ? fetch : null);
  return allowed ? fact ?? data ?? undefined : undefined;
}

function VacationFact({ enabled }: { enabled: boolean | undefined }) {
  const { t } = useTranslation();
  if (enabled === undefined) return null;
  return <Fact section="vacation">{enabled ? t("users.summary.vacationOn") : t("users.summary.vacationOff")}</Fact>;
}

/** The essential facts of a mail user, each opening and scrolling to its section. */
export function MailUserSummary({ username, forwardsOnly = false }: { username: string; forwardsOnly?: boolean }) {
  const facts = useSectionFacts();
  // An address without account has no quota, mailbox, alias nor vacation of its own
  const canQuota = useIsAllowed("GET", "/quota/users/{username}") && !forwardsOnly;
  const canVacation = useIsAllowed("GET", "/vacation/{username}") && !forwardsOnly;
  const fetchQuota = useCallback(() => getUserQuota(username), [username]);
  const fetchVacation = useCallback(async () => !!(await getUserVacation(username)).enabled, [username]);
  const quota = useLatest<UserQuota>(canQuota, fetchQuota, facts["quota"] as UserQuota | undefined);
  const vacationFact = facts["vacation"];
  const vacationEnabled = useLatest<boolean>(canVacation, fetchVacation, typeof vacationFact === "boolean" ? vacationFact : undefined);
  const forwards = facts["forwards"] as ForwardsFact | undefined;

  return (
    <Strip>
      {quota && <QuotaFact quota={quota} />}
      {!forwardsOnly && <CountFact section="mailboxes" count={facts["mailboxes"]} labelKey="users.summary.mailboxes" />}
      {!forwardsOnly && <CountFact section="aliases" count={facts["aliases"]} labelKey="users.summary.aliases" />}
      {forwards && <ForwardsFactChip forwards={forwards} />}
      <VacationFact enabled={vacationEnabled} />
    </Strip>
  );
}

/** The calendar counterpart: what the sections of the page counted. */
export function CalendarUserSummary() {
  const facts = useSectionFacts();
  return (
    <Strip>
      <CountFact section="calendars" count={facts["calendars"]} labelKey="users.summary.calendars" />
      <CountFact section="address-books" count={facts["address-books"]} labelKey="users.summary.addressBooks" />
      <CountFact section="booking-links" count={facts["booking-links"]} labelKey="users.summary.bookingLinks" />
    </Strip>
  );
}
