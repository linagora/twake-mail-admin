import { useMemo, useState } from "react";
import { Link } from "react-router";
import { Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useFetchData } from "@/hooks/use-fetch-data";
import { useConfirm } from "@/hooks/use-confirm";
import { useToast } from "@/hooks/use-toast";
import { getDomains, createDomain, deleteDomain } from "./api-client";
import { GetDomainsResponseType } from "./types";
import ErrorDisplayer from "@/components/custom/error-displayer";
import { useIsAllowed } from "@/lib/proxy-resolver-context";
import { PaginationControls } from "@/components/custom/pagination-controls";

const PAGE_LIMIT = Number(import.meta.env.VITE_PAGE_LIMIT) || 50;

export default function DomainsList() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const confirm = useConfirm();
  const canCreate = useIsAllowed("PUT", "/domains/{domain}");
  const canDelete = useIsAllowed("DELETE", "/domains/{domain}");

  const {
    data: domainsResult,
    isLoading,
    error,
    refresh,
  } = useFetchData<GetDomainsResponseType>(getDomains);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [newDomain, setNewDomain] = useState("");

  const handleCreate = async () => {
    const name = newDomain.trim();
    if (!name) return;
    try {
      await createDomain(name);
      toast({ title: t("domains.created", { name }) });
      setNewDomain("");
      refresh();
    } catch (err) {
      toast({
        title: t("domains.errorCreating"),
        description: <ErrorDisplayer error={err} />,
      });
    }
  };

  const handleDelete = async (domain: string) => {
    const confirmed = await confirm({
      header: t("domains.deleteDomain"),
      message: t("domains.deleteConfirm", { domain }),
    });
    if (!confirmed) return;
    try {
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
      {canCreate && (
        <div className="flex gap-2 mt-4">
          <input
            type="text"
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            placeholder={t("domains.newDomainPlaceholder")}
            className="flex-1 px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleCreate}
            disabled={!newDomain.trim()}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t("common.create")}
          </button>
        </div>
      )}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
          <div className="h-[58px] rounded-2 animate-pulse bg-gray-200" />
          <div className="h-[58px] rounded-2 animate-pulse bg-gray-200" />
          <div className="h-[58px] rounded-2 animate-pulse bg-gray-200" />
        </div>
      )}
      {error && <p className="text-red-500 mt-4">Error: {error}</p>}
      <input
        type="text"
        value={search}
        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        placeholder={t("domains.searchPlaceholder")}
        className="mt-4 w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      {filtered.length > 0 && (
        <PaginationControls
          onFirst={() => goToPage(1)}
          onPrev={() => goToPage(page - 1)}
          onNext={() => goToPage(page + 1)}
          onLast={() => goToPage(totalPages)}
          disabledPrev={page <= 1}
          disabledNext={page >= totalPages}
          label={t("common.page", { page, totalPages, total: filtered.length })}
        />
      )}
      <div>
        {paginated.map((domain, index) => (
          <div
            key={domain}
            className="space-y-1 p-4 bg-white rounded-2 my-4 p-4 flex justify-between items-center"
          >
            <div>
              <h4 className="text-sm font-medium leading-none">
                <span className="text-gray-500 mr-2">{(page - 1) * PAGE_LIMIT + index + 1}/</span>
                <Link
                  to={`/domains/domain/${encodeURIComponent(domain)}`}
                  className="text-blue-600 hover:underline"
                >
                  {domain}
                </Link>
              </h4>
            </div>
            {canDelete && (
              <button
                onClick={() => handleDelete(domain)}
                className="p-2 rounded-md hover:bg-gray-200"
                title={t("domains.deleteDomain")}
              >
                <Trash2 className="w-4 h-4 text-red-600" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
