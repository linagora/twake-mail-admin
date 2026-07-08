import { Fragment, useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useFetchData } from "@/hooks/use-fetch-data";
import { getMailingLists, getMailingListDetail } from "./api-client";
import { MailingListAddresses, MailingListDetail } from "./types";
import { PaginationControls } from "@/components/custom/pagination-controls";

const PAGE_LIMIT = Number(import.meta.env.VITE_PAGE_LIMIT) || 50;

interface Props {
  /** When set, only mailing lists of this domain are listed (domain admin mode). */
  domain?: string;
}

function MailingListDetailRow({ address }: { address: string }) {
  const { t } = useTranslation();
  const fetcher = useCallback(() => getMailingListDetail(address), [address]);
  const { data, isLoading, error } = useFetchData<MailingListDetail>(fetcher);

  if (isLoading) {
    return (
      <div className="h-6 w-64 rounded animate-pulse bg-gray-200" />
    );
  }
  if (error) {
    return <p className="text-red-500 text-sm">{error}</p>;
  }
  if (!data) {
    return <p className="text-gray-500 text-sm">{t("mailingLists.detailEmpty")}</p>;
  }

  return (
    <div className="flex flex-col gap-3 text-sm">
      {data.businessCategory && (
        <div>
          <span className="font-medium">{t("mailingLists.businessCategory")}: </span>
          <span>{data.businessCategory}</span>
        </div>
      )}
      <div>
        <p className="font-medium mb-1">
          {t("mailingLists.members")} ({data.members?.length ?? 0})
        </p>
        {data.members?.length ? (
          <ul className="list-disc list-inside text-gray-700">
            {data.members.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-500">{t("mailingLists.noMembers")}</p>
        )}
      </div>
      <div>
        <p className="font-medium mb-1">
          {t("mailingLists.owners")} ({data.owners?.length ?? 0})
        </p>
        {data.owners?.length ? (
          <ul className="list-disc list-inside text-gray-700">
            {data.owners.map((o) => (
              <li key={o}>{o}</li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-500">{t("mailingLists.noOwners")}</p>
        )}
      </div>
    </div>
  );
}

export default function MailingListsList({ domain }: Props) {
  const { t } = useTranslation();

  const fetcher = useCallback(() => getMailingLists(domain), [domain]);
  const { data, isLoading, error } = useFetchData<MailingListAddresses>(fetcher);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const addresses = useMemo(() => {
    const list = Array.isArray(data) ? [...data] : [];
    list.sort((a, b) => a.localeCompare(b));
    return list;
  }, [data]);

  const filtered = useMemo(() => {
    if (!search) return addresses;
    const lower = search.toLowerCase();
    return addresses.filter((a) => a.toLowerCase().includes(lower));
  }, [addresses, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_LIMIT));
  const paginated = filtered.slice((page - 1) * PAGE_LIMIT, page * PAGE_LIMIT);

  const goToPage = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    setPage(newPage);
  };

  const toggle = (address: string) => {
    setExpanded((cur) => (cur === address ? null : address));
  };

  return (
    <div>
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
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
        placeholder={t("mailingLists.searchPlaceholder")}
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
      <table className="mt-4 w-full border-collapse">
        <thead>
          <tr className="bg-gray-100">
            <th className="text-left px-4 py-2 text-sm font-medium">#</th>
            <th className="text-left px-4 py-2 text-sm font-medium">{t("mailingLists.address")}</th>
            <th className="text-left px-4 py-2 text-sm font-medium">{t("mailingLists.details")}</th>
          </tr>
        </thead>
        <tbody>
          {paginated.map((address, index) => {
            const isOpen = expanded === address;
            return (
              <Fragment key={address}>
                <tr
                  className="border-b hover:bg-gray-50 cursor-pointer"
                  onClick={() => toggle(address)}
                >
                  <td className="px-4 py-2 text-sm text-gray-500">
                    {(page - 1) * PAGE_LIMIT + index + 1}
                  </td>
                  <td className="px-4 py-2 text-sm">{address}</td>
                  <td className="px-4 py-2 text-sm">
                    <button
                      onClick={(e) => { e.stopPropagation(); toggle(address); }}
                      className="flex items-center gap-1 text-blue-500 hover:underline"
                    >
                      {isOpen ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                      {isOpen ? t("mailingLists.hideDetails") : t("mailingLists.showDetails")}
                    </button>
                  </td>
                </tr>
                {isOpen && (
                  <tr className="border-b bg-gray-50">
                    <td />
                    <td colSpan={2} className="px-4 py-3">
                      <MailingListDetailRow address={address} />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
      {!isLoading && filtered.length === 0 && (
        <p className="mt-4 text-gray-500 text-sm">{t("mailingLists.empty")}</p>
      )}
    </div>
  );
}
