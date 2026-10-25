import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { currentLocale } from "@/i18n/locale";
import { formatByteSize } from "@/i18n/format-size";
import { formatPercent } from "@/i18n/format-percent";
import { NO_LIMITS, QuotaLimitValues } from "./quota-limits";

/** One level a limit can be set at, the most specific first: user or team mailbox, domain, global. */
export interface QuotaLevel {
  source: "user" | "teamMailbox" | "domain" | "global";
  label: string;
  values: QuotaLimitValues | null;
  // The domain, named in the source of an applied domain limit
  domain?: string;
}

type Limit = keyof QuotaLimitValues;

const FORMATS: Record<Limit, (n: number) => string> = {
  count: (n) => n.toLocaleString(currentLocale()),
  size: formatByteSize,
};

const SOURCE_KEYS: Record<QuotaLevel["source"], string> = {
  user: "quota.fromUser",
  teamMailbox: "quota.fromTeamMailbox",
  domain: "quota.fromDomain",
  global: "quota.fromGlobal",
};

/** The level whose limit applies: the most specific one setting it, or none. */
export const appliedLevel = (levels: QuotaLevel[], limit: Limit) => levels.find((level) => (level.values ?? NO_LIMITS)[limit] !== null);

/** Whether a positive limit applies to the count or the size: a ratio then means something. */
export const isLimited = (levels: QuotaLevel[]) =>
  (["count", "size"] as const).some((limit) => {
    const value = appliedLevel(levels, limit)?.values?.[limit];
    return value != null && value >= 0;
  });

const formatLimit = (t: TFunction, value: number | null | undefined, limit: Limit) =>
  value == null ? "—" : value === -1 ? t("quotaLimits.unlimited") : FORMATS[limit](value);

// "1,000 (user)", "2.0 GB (domain example.com)", "Unlimited (no limit set)"
function appliedText(t: TFunction, levels: QuotaLevel[], limit: Limit) {
  const level = appliedLevel(levels, limit);
  if (!level) return { value: t("quota.noLimitSet"), source: "" };
  return { value: formatLimit(t, level.values![limit], limit), source: t(SOURCE_KEYS[level.source], { domain: level.domain }) };
}

function Row({ label, count, size }: { label: string; count: React.ReactNode; size: React.ReactNode }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap justify-between items-center gap-x-4 py-1">
      <span className="inline-block text-sm text-gray-600 first-letter:uppercase">{label}</span>
      {/* On a narrow screen the size wraps under the count, each label kept with its value */}
      <span className="ml-auto text-sm flex flex-wrap justify-end gap-x-4">
        <span>{t("common.count")} <strong>{count}</strong></span>
        <span>{t("common.size")} <strong>{size}</strong></span>
      </span>
    </div>
  );
}

function Applied({ t, levels, limit }: { t: TFunction; levels: QuotaLevel[]; limit: Limit }) {
  const { value, source } = appliedText(t, levels, limit);
  return <>{value}{source && <>{" "}<span className="font-normal text-gray-500">{source}</span></>}</>;
}

/** The limit that applies, with where it comes from, then what each level sets ("—" for nothing). */
export function QuotaLevelRows({ levels }: { levels: QuotaLevel[] }) {
  const { t } = useTranslation();
  return (
    <>
      <Row label={t("common.computedEffective")} count={<Applied t={t} levels={levels} limit="count" />} size={<Applied t={t} levels={levels} limit="size" />} />
      {levels.map((level) => (
        <Row
          key={level.source}
          label={level.label}
          count={formatLimit(t, level.values?.count, "count")}
          size={formatLimit(t, level.values?.size, "size")}
        />
      ))}
    </>
  );
}

interface Occupation {
  count: number;
  size: number;
  ratio: { count: number; size: number; max: number };
}

const barClass = (max: number) => (max > 0.9 ? "bg-red-500" : max > 0.7 ? "bg-yellow-500" : "bg-green-500");

/** What is used; the ratio and its bar only when a limit applies: a ratio of an unlimited quota means nothing. */
export function QuotaOccupation({ occupation, limited }: { occupation: Occupation; limited: boolean }) {
  const { t } = useTranslation();
  const { ratio } = occupation;
  return (
    <div>
      <h4 className="text-sm font-semibold mb-1">{t("common.occupation")}</h4>
      <Row label={t("common.used")} count={occupation.count.toLocaleString(currentLocale())} size={formatByteSize(occupation.size)} />
      {limited && (
        <>
          <div className="flex flex-wrap justify-between items-center gap-x-4 py-1">
            <span className="text-sm text-gray-600">{t("common.ratio")}</span>
            <span className="ml-auto text-sm flex flex-wrap justify-end gap-x-4">
              <span>{t("common.count")} <strong>{formatPercent(ratio.count)}</strong></span>
              <span>{t("common.size")} <strong>{formatPercent(ratio.size)}</strong></span>
              <span>{t("common.max")} <strong>{formatPercent(ratio.max)}</strong></span>
            </span>
          </div>
          <div className="mt-1 w-full bg-gray-200 rounded-full h-2">
            <div className={`h-2 rounded-full ${barClass(ratio.max)}`} style={{ width: `${Math.min(ratio.max * 100, 100)}%` }} />
          </div>
        </>
      )}
    </div>
  );
}

export const domainOf = (address: string) => address.slice(address.lastIndexOf("@") + 1);
