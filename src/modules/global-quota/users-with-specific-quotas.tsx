import { useState } from "react";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronRight } from "lucide-react";
import { PaginationControls } from "@/components/custom/pagination-controls";
import { useFetchData } from "@/hooks/use-fetch-data";
import { getUsersWithSpecificQuotas } from "./api-client";
import { UserSpecificQuota } from "./types";

const PAGE_SIZE = 20;

const NO_USERS: UserSpecificQuota[] = [];

interface UsersWithSpecificQuotasProps {
  formatCount: (count: number | null) => string;
  formatSize: (bytes: number | null) => string;
}

// The report scans every user: it is only fetched once the section is opened.
export default function UsersWithSpecificQuotas({ formatCount, formatSize }: UsersWithSpecificQuotasProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const { data, isLoading, error } = useFetchData(open ? getUsersWithSpecificQuotas : null);
  const users = data ?? NO_USERS;

  const totalPages = Math.max(1, Math.ceil(users.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const offset = (currentPage - 1) * PAGE_SIZE;
  const paginated = users.slice(offset, offset + PAGE_SIZE);

  const goToPage = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    setPage(newPage);
  };

  return (
    <div className="p-4 bg-gray-50 rounded-2 space-y-3">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-sm font-semibold hover:text-blue-600 transition"
      >
        {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        {data ? t("globalQuota.usersSpecificTitle", { count: users.length }) : t("globalQuota.usersSpecific")}
      </button>
      {open && (isLoading ? (
        <div className="h-[58px] rounded-2 animate-pulse bg-gray-200" />
      ) : error ? (
        <p className="text-sm text-red-500">{t("common.errorPrefix", { message: error })}</p>
      ) : !data ? null : users.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("globalQuota.noSpecificQuotas")}</p>
      ) : (
        <>
          <div className="space-y-1">
            {paginated.map((u, i) => (
              <div key={u.user} className="flex justify-between items-center py-1 text-sm">
                <span>
                  <span className="text-gray-500 mr-2">{offset + i + 1}/</span>
                  <Link
                    to={`/users/user/${encodeURIComponent(u.user)}`}
                    className="text-blue-600 hover:underline"
                  >
                    {u.user}
                  </Link>
                </span>
                <span>
                  <span className="mr-4">{t("common.count")} <strong>{formatCount(u.countLimit)}</strong></span>
                  {t("common.size")} <strong>{formatSize(u.storageLimit)}</strong>
                </span>
              </div>
            ))}
          </div>
          {totalPages > 1 && (
            <PaginationControls
              onFirst={() => goToPage(1)}
              onPrev={() => goToPage(currentPage - 1)}
              onNext={() => goToPage(currentPage + 1)}
              onLast={() => goToPage(totalPages)}
              disabledPrev={currentPage <= 1}
              disabledNext={currentPage >= totalPages}
              label={t("common.page", { page: currentPage, totalPages, total: users.length })}
            />
          )}
        </>
      ))}
    </div>
  );
}
