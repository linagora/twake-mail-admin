import { ReactNode, useCallback } from "react";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { useFetchData } from "@/hooks/use-fetch-data";
import { useIsAllowed } from "@/lib/proxy-resolver-context";
import { listUsernames } from "@/modules/users/api-client";
import { applyUsersRequest } from "@/modules/users/users-paging";
import { Strip } from "@/components/custom/summary-facts";

// One more than a page tells "more than 50" without listing the whole domain
export const USERS_PROBE_LIMIT = 51;

/**
 * Up to USERS_PROBE_LIMIT users of the domain. Some backends (the calendar side service)
 * ignore the domain and limit parameters of GET /users: filtered and capped here too.
 */
export const probeDomainUsers = async (domain: string): Promise<string[]> =>
  applyUsersRequest(await listUsernames({ domain, limit: USERS_PROBE_LIMIT }), { query: "", domain, limit: USERS_PROBE_LIMIT });

/**
 * How many users the domain has, as a chip opening the Users list filtered on it, then the
 * chips the page adds (`extra`), e.g. what the calendar sections counted.
 */
export function DomainSummary({ domain, extra }: { domain: string; extra?: ReactNode }) {
  const { t } = useTranslation();
  const canListUsers = useIsAllowed("GET", "/users?domain={domain}&{params}");
  const fetchUsers = useCallback(() => probeDomainUsers(domain), [domain]);
  const { data: users, isLoading, error } = useFetchData(canListUsers ? fetchUsers : null);

  const showUsers = canListUsers && !error;
  if (!showUsers && !extra) return null;
  const count = users == null || isLoading
    ? "…"
    : users.length >= USERS_PROBE_LIMIT ? `${USERS_PROBE_LIMIT - 1}+` : String(users.length);

  return (
    <Strip>
      {showUsers && (
        <Link
          to={`/users?domain=${encodeURIComponent(domain)}`}
          className="text-left text-sm px-3 py-1.5 rounded-md border bg-white hover:bg-gray-50 hover:border-blue-400 transition"
        >
          {t("domains.summary.users", { count })}
        </Link>
      )}
      {extra}
    </Strip>
  );
}
