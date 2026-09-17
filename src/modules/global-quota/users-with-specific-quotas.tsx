import { useState } from "react";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronRight } from "lucide-react";
import { PaginationControls } from "@/components/custom/pagination-controls";
import { UserSpecificQuota } from "./types";

const PAGE_SIZE = 20;

interface UsersWithSpecificQuotasProps {
  users: UserSpecificQuota[];
  formatCount: (count: number | null) => string;
  formatSize: (bytes: number | null) => string;
}

export default function UsersWithSpecificQuotas({ users, formatCount, formatSize }: UsersWithSpecificQuotasProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);

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
        {t("globalQuota.usersSpecificTitle", { count: users.length })}
      </button>
      {open && (users.length === 0 ? (
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
                  <span className="mr-4">Count: <strong>{formatCount(u.countLimit)}</strong></span>
                  Size: <strong>{formatSize(u.storageLimit)}</strong>
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
