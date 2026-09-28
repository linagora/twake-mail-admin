import { useTranslation } from "react-i18next";
import { PaginationControls } from "@/components/custom/pagination-controls";

interface ListSearchPaginationProps {
  search: string;
  onSearch: (value: string) => void;
  placeholder: string;
  page: number;
  totalPages: number;
  total: number;
  goToPage: (page: number) => void;
}

/** Search field and pagination controls shown above a client-side paginated list. */
export function ListSearchPagination({
  search, onSearch, placeholder, page, totalPages, total, goToPage,
}: ListSearchPaginationProps) {
  const { t } = useTranslation();
  return (
    <div className="mt-2">
      <input
        type="text"
        value={search}
        onChange={(e) => onSearch(e.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      {totalPages > 1 && (
        <PaginationControls
          onFirst={() => goToPage(1)}
          onPrev={() => goToPage(page - 1)}
          onNext={() => goToPage(page + 1)}
          onLast={() => goToPage(totalPages)}
          disabledPrev={page <= 1}
          disabledNext={page >= totalPages}
          label={t("common.page", { page, totalPages, total })}
        />
      )}
    </div>
  );
}
