import { useMemo, useState } from "react";
import { Link } from "react-router";
import { Loader2, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useFetchData } from "@/hooks/use-fetch-data";
import { useConfirm } from "@/hooks/use-confirm";
import { useToast } from "@/hooks/use-toast";
import { getDomains, deleteDomain, getDomainAliases, removeDomainAlias } from "./api-client";
import { appConfig } from "@/lib/config";
import { probeDomainUsers, USERS_PROBE_LIMIT } from "./details/domain-summary";
import { GetDomainsResponseType } from "./types";
import ErrorDisplayer from "@/components/custom/error-displayer";
import { useIsAllowed } from "@/lib/proxy-resolver-context";
import { PaginationControls } from "@/components/custom/pagination-controls";
import ImportDomainsButton from "./import-domains-button";
import CreateDomainButton from "./create-domain-button";
import ListToolbar from "@/components/custom/list-toolbar";
import { CompactList, CompactRow } from "@/components/custom/compact-list";
import { forgetManagedDomains } from "@/hooks/use-managed-domains";

const PAGE_LIMIT = Number(import.meta.env.VITE_PAGE_LIMIT) || 50;
const EXAMPLE_USERS = 3;

/** What a domain still holds, as far as the console could check it. */
interface DomainContents {
  users: string[];
  // Sources of the domain aliases pointing to the domain
  aliases: string[];
  // A lookup failed or is not allowed: the contents are not known for sure
  incomplete: boolean;
}

export default function DomainsList() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const confirm = useConfirm();
  const canCreate = useIsAllowed("PUT", "/domains/{domain}");
  const canDelete = useIsAllowed("DELETE", "/domains/{domain}");
  const canListUsers = useIsAllowed("GET", "/users?domain={domain}&{params}");
  // Domain aliases are a mail feature
  const canListAliases = useIsAllowed("GET", "/domains/{domain}/aliases") && appConfig.application === "MAIL";
  // WebAdmin keeps the aliases of a deleted domain as mappings to a domain it no longer hosts
  const canRemoveAliases = useIsAllowed("DELETE", "/domains/{domain}/aliases/{source}");
  const [checking, setChecking] = useState<string | null>(null);

  const {
    data: domainsResult,
    isLoading,
    error,
    refresh: refreshList,
  } = useFetchData<GetDomainsResponseType>(getDomains);
  // The user links of the console tell local addresses by these domains
  const refresh = () => {
    forgetManagedDomains();
    refreshList();
  };

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  // The users and the domain aliases the domain still holds, looked up in parallel
  const checkContents = async (domain: string): Promise<DomainContents> => {
    const [users, aliases] = await Promise.allSettled([
      canListUsers ? probeDomainUsers(domain) : Promise.reject(new Error("not allowed")),
      canListAliases ? getDomainAliases(domain) : Promise.resolve([]),
    ]);
    return {
      users: users.status === "fulfilled" ? users.value : [],
      aliases: aliases.status === "fulfilled" ? aliases.value.map((alias) => alias.source) : [],
      incomplete: users.status === "rejected" || aliases.status === "rejected",
    };
  };

  const deleteDialog = (domain: string, { users, aliases, incomplete }: DomainContents) => {
    const aliasCount = aliases.length;
    const usersLabel = users.length === 0 ? "" : t(
      users.length >= USERS_PROBE_LIMIT ? "domains.delete.usersMore" : "domains.delete.users",
      { count: users.length, limit: USERS_PROBE_LIMIT - 1, examples: users.slice(0, EXAMPLE_USERS).join(", ") }
    );
    const holds = users.length > 0 && aliasCount > 0 ? "domains.delete.stillBoth"
      : users.length > 0 ? "domains.delete.stillUsers"
      : aliasCount > 0 ? "domains.delete.stillAliases"
      : null;
    const couldNotCheck = incomplete && <p className="text-sm text-gray-600">{t("domains.delete.couldNotCheck")}</p>;
    if (!holds) {
      return {
        header: t("domains.deleteDomain", { domain }),
        destructive: true,
        confirmLabel: t("common.delete"),
        message: (
          <div className="space-y-2">
            <p>{incomplete ? t("domains.delete.confirmUnchecked", { domain }) : t("domains.deleteConfirm", { domain })}</p>
            {couldNotCheck}
          </div>
        ),
      };
    }
    return {
      header: t("domains.deleteDomain", { domain }),
      destructive: true,
      confirmLabel: t("common.delete"),
      consequence: (
        <>
          {t(holds, { domain, users: usersLabel, aliases: t("domains.delete.aliases", { count: aliasCount }) })}{" "}
          {t(users.length > 0 ? "domains.delete.usersConsequence" : "domains.delete.aliasesConsequence", { domain, count: aliasCount })}
        </>
      ),
      typeToConfirm: domain,
      typeToConfirmIgnoreCase: true,
      message: (
        <div className="space-y-2">
          <p>{t("domains.delete.confirmBusy", { domain })}</p>
          {aliasCount > 0 && (
            <p>{t(canRemoveAliases ? "domains.delete.aliasesRemoved" : "domains.delete.aliasesKept", { count: aliasCount, aliases: aliases.join(", ") })}</p>
          )}
          {users.length > 0 && (
            <p>
              <Link to={`/users?domain=${encodeURIComponent(domain)}`} className="text-blue-600 hover:underline">
                {t("domains.delete.seeUsers", { domain })}
              </Link>
            </p>
          )}
          {couldNotCheck}
        </div>
      ),
    };
  };

  const handleDelete = async (domain: string) => {
    setChecking(domain);
    let contents: DomainContents;
    try {
      contents = await checkContents(domain);
    } finally {
      setChecking(null);
    }
    const confirmed = await confirm(deleteDialog(domain, contents));
    if (!confirmed) return;
    try {
      // Before the domain, so that a refusal leaves no alias towards a deleted domain
      if (canRemoveAliases) {
        for (const alias of contents.aliases) await removeDomainAlias(domain, alias);
      }
      await deleteDomain(domain);
      toast({ title: t("domains.deleted", { domain }) });
      refresh();
    } catch (err) {
      toast({
        title: t("domains.errorDeleting"),
        description: <ErrorDisplayer error={err} />,
      });
    }
  };

  const filtered = useMemo(() => {
    if (!domainsResult) return [];
    const sorted = [...domainsResult].sort((a, b) => a.localeCompare(b));
    if (!search) return sorted;
    const lower = search.toLowerCase();
    return sorted.filter((d) => d.toLowerCase().includes(lower));
  }, [domainsResult, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_LIMIT));
  const paginated = filtered.slice((page - 1) * PAGE_LIMIT, page * PAGE_LIMIT);

  const goToPage = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    setPage(newPage);
  };

  return (
    <div>
      {/* One line: the search, then what can be done to the list */}
      <ListToolbar search={search} onSearch={(value) => { setSearch(value); setPage(1); }} placeholder={t("domains.searchPlaceholder")}>
        {canCreate && <CreateDomainButton onCreated={refresh} />}
        {canCreate && <ImportDomainsButton onImported={refresh} />}
      </ListToolbar>
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
          <div className="h-[58px] rounded-2 animate-pulse bg-gray-200" />
          <div className="h-[58px] rounded-2 animate-pulse bg-gray-200" />
          <div className="h-[58px] rounded-2 animate-pulse bg-gray-200" />
        </div>
      )}
      {error && <p className="text-red-500 mt-4">{t("common.errorPrefix", { message: error })}</p>}

      {filtered.length > 0 && (
        <PaginationControls
          onFirst={() => goToPage(1)}
          onPrev={() => goToPage(page - 1)}
          onNext={() => goToPage(page + 1)}
          onLast={() => goToPage(totalPages)}
          disabledPrev={page <= 1}
          disabledNext={page >= totalPages}
          label={t("common.page", { page, totalPages, total: filtered.length })}
          total={filtered.length}
        />
      )}
      <CompactList>
        {paginated.map((domain, index) => (
          <CompactRow key={domain} number={(page - 1) * PAGE_LIMIT + index + 1}>
            <Link
              to={`/domains/domain/${encodeURIComponent(domain)}`}
              className="min-w-0 break-all text-blue-600 hover:underline"
            >
              {domain}
            </Link>
            {canDelete && (
              <button
                onClick={() => handleDelete(domain)}
                disabled={checking !== null}
                className="ml-auto shrink-0 -my-1.5 p-1.5 rounded-md hover:bg-gray-200 disabled:opacity-60"
                title={t("domains.deleteDomain", { domain })}
                aria-label={t("domains.deleteDomain", { domain })}
              >
                {checking === domain
                  ? <Loader2 className="w-4 h-4 text-red-600 animate-spin" aria-hidden="true" />
                  : <Trash2 className="w-4 h-4 text-red-600" aria-hidden="true" />}
              </button>
            )}
          </CompactRow>
        ))}
      </CompactList>
      {search && domainsResult && filtered.length === 0 && (
        <p className="text-gray-500 mt-4">{t("domains.noMatch", { query: search })}</p>
      )}
    </div>
  );
}
