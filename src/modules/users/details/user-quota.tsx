import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useIsAllowed } from "@/lib/proxy-resolver-context";
import { useFetchData } from "@/hooks/use-fetch-data";
import { getUserQuota, updateUserQuotaSize, deleteUserQuotaSize, updateUserQuotaCount, deleteUserQuotaCount } from "../api-client";
import { UserQuota as UserQuotaType } from "../types";
import QuotaLimits, { NO_LIMITS, QuotaLimitsApi } from "@/components/custom/quota-limits";
import { domainOf, QuotaLevel, QuotaLevelRows, QuotaOccupation } from "@/components/custom/quota-levels";
import { SectionToggle, useSectionFact, useSectionOpen } from "@/components/custom/collapsible-section";
import { useUserQuotaRevision } from "./user-quota-revision";

interface Props {
  username: string;
}

export default function UserQuota({ username }: Props) {
  const { t } = useTranslation();
  const canView = useIsAllowed("GET", "/quota/users/{username}");
  const canUpdateSize = useIsAllowed("PUT", "/quota/users/{username}/size");
  const canUpdateCount = useIsAllowed("PUT", "/quota/users/{username}/count");
  const canReset = useIsAllowed("DELETE", "/quota/users/{username}/size");
  const [open, setOpen, openContentId] = useSectionOpen("quota");
  const limitsApi = useMemo<QuotaLimitsApi>(() => ({
    putCount: (count) => updateUserQuotaCount(username, count),
    deleteCount: () => deleteUserQuotaCount(username),
    putSize: (size) => updateUserQuotaSize(username, size),
    deleteSize: () => deleteUserQuotaSize(username),
  }), [username]);

  const fetchQuota = useCallback(() => getUserQuota(username), [username]);
  // Fetched again once messages were removed from the page (a mailbox cleared or deleted)
  const { revision: quotaRevision } = useUserQuotaRevision();
  const {
    data: quota,
    isLoading,
    error,
    refresh,
  } = useFetchData<UserQuotaType>(canView ? fetchQuota : null, quotaRevision);
  // The summary strip of the page follows each edit of the limits
  useSectionFact("quota", quota);

  if (!canView) return null;
  const levels: QuotaLevel[] = quota ? [
    { source: "user", label: t("users.quota.user"), values: quota.user },
    { source: "domain", label: t("quota.domainLevel", { domain: domainOf(username) }), values: quota.domain, domain: domainOf(username) },
    { source: "global", label: t("common.global"), values: quota.global },
  ] : [];

  return (
    <div className="mt-6">
      <SectionToggle open={open} onToggle={() => setOpen(!open)} controls={openContentId}>
        {t("users.quota.title")}
      </SectionToggle>

      {open && (
        <div id={openContentId} className="mt-2">
          {isLoading && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-2">
              <div className="h-[58px] rounded-2 animate-pulse bg-gray-200" />
              <div className="h-[58px] rounded-2 animate-pulse bg-gray-200" />
            </div>
          )}
          {error && <p className="text-red-500 mt-2">{t("common.errorPrefix", { message: error })}</p>}

          {quota && (
            <div className="p-4 bg-gray-50 rounded-2 space-y-3">
              <QuotaOccupation occupation={quota.occupation} levels={levels} />

              <hr className="border-gray-200" />

              <div>
                <h4 className="text-sm font-semibold mb-1">{t("common.perUserLimit")}</h4>
                <QuotaLevelRows levels={levels} />
              </div>

              <hr className="border-gray-200" />

              <QuotaLimits
                target={username}
                current={quota.user ?? NO_LIMITS}
                parents={[
                  { label: t("quotaLimits.parentDomain"), values: quota.domain ?? NO_LIMITS },
                  { label: t("quotaLimits.parentGlobal"), values: quota.global ?? NO_LIMITS },
                ]}
                api={limitsApi}
                canEditCount={canUpdateCount}
                canEditSize={canUpdateSize}
                canRemove={canReset}
                removeLabel={t("quotaLimits.removeSpecific")}
                removeConfirm={t("users.quota.resetConfirm", { username })}
                onChanged={refresh}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
