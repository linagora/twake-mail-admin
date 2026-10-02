import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useIsAllowed } from "@/lib/proxy-resolver-context";
import { APIError } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { DomainAddressBookId, getDomainAddressBookContactCount } from "../api-client";

type CountState =
  | { status: "loading" }
  | { status: "loaded"; count: number }
  | { status: "unavailable" }
  | { status: "error" };

const LABEL_KEYS: Record<DomainAddressBookId, string> = {
  dab: "domains.addressBookCounts.dab",
  "domain-members": "domains.addressBookCounts.domainMembers",
};

const toErrorState = (err: unknown): CountState =>
  (err as APIError)?.response?.status === 404 ? { status: "unavailable" } : { status: "error" };

const readCount = (domain: string, addressBookId: DomainAddressBookId): Promise<CountState> =>
  getDomainAddressBookContactCount(domain, addressBookId)
    .then(({ count }): CountState => ({ status: "loaded", count }))
    .catch(toErrorState);

function CountValue({ state }: { state: CountState }) {
  const { t } = useTranslation();
  switch (state.status) {
    case "loading":
      return <Loader2 className="w-4 h-4 animate-spin" aria-label={t("common.loading")} />;
    case "loaded":
      return <span>{state.count}</span>;
    case "unavailable":
      return <span className="text-muted-foreground">{t("domains.addressBookCounts.unavailable")}</span>;
    case "error":
      return (
        <span className="flex items-center gap-1 text-red-600">
          <AlertTriangle className="w-4 h-4" />
          {t("domains.addressBookCounts.error")}
        </span>
      );
  }
}

interface Props {
  domain: string;
}

// Number of contacts held by the domain address books, so that an admin can check
// they were provisioned (after an LDAP sync or a republish task, for instance).
export default function DomainAddressBookCounts({ domain }: Props) {
  const { t } = useTranslation();
  const canCountDab = useIsAllowed("GET", "/domains/{domain}/addressbooks/dab/contactCount");
  const canCountMembers = useIsAllowed("GET", "/domains/{domain}/addressbooks/domain-members/contactCount");
  const [counts, setCounts] = useState<Partial<Record<DomainAddressBookId, CountState>>>({});

  const addressBookIds = useMemo(
    () =>
      ([] as DomainAddressBookId[])
        .concat(canCountDab ? ["dab"] : [])
        .concat(canCountMembers ? ["domain-members"] : []),
    [canCountDab, canCountMembers]
  );

  const load = useCallback(() => {
    setCounts(Object.fromEntries(addressBookIds.map((id) => [id, { status: "loading" }])));
    addressBookIds.forEach((id) =>
      readCount(domain, id).then((state) => setCounts((previous) => ({ ...previous, [id]: state })))
    );
  }, [domain, addressBookIds]);

  useEffect(load, [load]);

  if (addressBookIds.length === 0) return null;

  const loading = Object.values(counts).some((state) => state?.status === "loading");

  return (
    <div className="mt-6">
      <div className="flex items-center gap-2">
        <h4 className="text-md font-semibold">{t("domains.addressBookCounts.title")}</h4>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={load}
          disabled={loading}
          title={t("domains.addressBookCounts.refresh")}
          aria-label={t("domains.addressBookCounts.refresh")}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>
      <ul className="mt-2 p-4 bg-gray-50 rounded-2 space-y-2 text-sm">
        {addressBookIds.map((id) => (
          <li key={id} className="flex items-center gap-2">
            <span className="font-medium">{t(LABEL_KEYS[id])}:</span>
            <CountValue state={counts[id] ?? { status: "loading" }} />
          </li>
        ))}
      </ul>
    </div>
  );
}
