import { useCallback, useId, useMemo, useState } from "react";
import UserLink from "@/components/custom/user-link";
import { Pencil, Trash2, AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { appConfig } from "@/lib/config";
import { useFetchData } from "@/hooks/use-fetch-data";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/hooks/use-confirm";
import { getRegisteredUsers, updateRegisteredUser, deleteRegisteredUser } from "./api-client";
import { RegisteredUser } from "./types";
import { validateRegisteredUser } from "./validation";
import RegisterUserButton from "./register-user-button";
import ListToolbar from "@/components/custom/list-toolbar";
import ErrorDisplayer from "@/components/custom/error-displayer";
import { useDomain } from "@/modules/domain-admin/domain-context";
import { useIsAllowed } from "@/lib/proxy-resolver-context";
import { PaginationControls } from "@/components/custom/pagination-controls";
import { CompactList, CompactRow } from "@/components/custom/compact-list";

const PAGE_LIMIT = Number(import.meta.env.VITE_PAGE_LIMIT) || 50;

export function EditUserForm({ user, onChange }: { user: RegisteredUser; onChange: (data: { email: string; firstname: string; lastname: string }) => void }) {
  const { t } = useTranslation();
  const idPrefix = useId();
  const [email, setEmail] = useState(user.email ?? "");
  const [firstname, setFirstname] = useState(user.firstname ?? "");
  const [lastname, setLastname] = useState(user.lastname ?? "");

  const handleChange = (e: string, f: string, l: string) => {
    onChange({ email: e, firstname: f, lastname: l });
  };

  return (
    <div className="space-y-3">
      {appConfig.application === "CALENDAR" && (
        <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-md text-sm text-amber-800">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{t("registeredUsers.ldapWarning")}</span>
        </div>
      )}
      <div>
        <label htmlFor={`${idPrefix}-email`} className="text-sm font-medium">{t("registeredUsers.email")} <span className="text-red-500">*</span></label>
        <input
          id={`${idPrefix}-email`}
          type="text"
          required
          value={email}
          onChange={(e) => { setEmail(e.target.value); handleChange(e.target.value, firstname, lastname); }}
          className="w-full px-4 py-2 border rounded-md focus:outline-hidden focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div>
        <label htmlFor={`${idPrefix}-firstname`} className="text-sm font-medium">{t("registeredUsers.firstname")} <span className="text-red-500">*</span></label>
        <input
          id={`${idPrefix}-firstname`}
          type="text"
          required
          value={firstname}
          onChange={(e) => { setFirstname(e.target.value); handleChange(email, e.target.value, lastname); }}
          className="w-full px-4 py-2 border rounded-md focus:outline-hidden focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div>
        <label htmlFor={`${idPrefix}-lastname`} className="text-sm font-medium">{t("registeredUsers.lastname")} <span className="text-red-500">*</span></label>
        <input
          id={`${idPrefix}-lastname`}
          type="text"
          required
          value={lastname}
          onChange={(e) => { setLastname(e.target.value); handleChange(email, firstname, e.target.value); }}
          className="w-full px-4 py-2 border rounded-md focus:outline-hidden focus:ring-2 focus:ring-blue-500"
        />
      </div>
    </div>
  );
}

export default function RegisteredUsersList() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const confirm = useConfirm();
  // In DOMAIN mode this returns the current domain; in GLOBAL mode returns "".
  const domain = useDomain() || undefined;

  const canCreate = useIsAllowed("POST", "/registeredUsers");
  const canEdit = useIsAllowed("PATCH", "/registeredUsers");
  const canDelete = useIsAllowed("DELETE", "/registeredUsers");

  const fetchUsers = useCallback(() => getRegisteredUsers(domain), [domain]);
  const {
    data: usersResult,
    isLoading,
    error,
    refresh,
  } = useFetchData<RegisteredUser[]>(fetchUsers);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const handleDelete = async (user: RegisteredUser) => {
    const confirmed = await confirm({
      header: t("registeredUsers.deleteTitle"),
      destructive: true,
      confirmLabel: t("common.delete"),
      message: t("registeredUsers.deleteConfirm", { email: user.email }),
    });
    if (!confirmed) return;
    try {
      await deleteRegisteredUser(user.email!, domain);
      toast({ title: t("registeredUsers.deleted", { email: user.email }) });
      refresh();
    } catch (err) {
      toast({ title: t("registeredUsers.errorDeleting"), description: <ErrorDisplayer error={err} /> });
    }
  };

  const handleEdit = async (user: RegisteredUser) => {
    let currentValues = { email: user.email ?? "", firstname: user.firstname ?? "", lastname: user.lastname ?? "" };

    await confirm({
      header: t("registeredUsers.editTitle"),
      message: (
        <EditUserForm
          user={user}
          onChange={(values) => { currentValues = values; }}
        />
      ),
      validate: () => validateRegisteredUser(currentValues, t),
      action: async () => {
        await updateRegisteredUser(user.id, currentValues, domain);
        toast({ title: t("registeredUsers.updated") });
        refresh();
      },
    });
  };

  const filtered = useMemo(() => {
    if (!usersResult) return [];
    const sorted = [...usersResult].sort((a, b) =>
      (a.email ?? "").localeCompare(b.email ?? "")
    );
    if (!search) return sorted;
    const lower = search.trim().toLowerCase();
    // The full name as the row shows it, and the other way round
    const fullNames = (u: (typeof sorted)[number]) => [
      `${u.firstname ?? ""} ${u.lastname ?? ""}`,
      `${u.lastname ?? ""} ${u.firstname ?? ""}`,
    ];
    return sorted.filter(
      (u) =>
        (u.id ?? "").toLowerCase().includes(lower) ||
        (u.email ?? "").toLowerCase().includes(lower) ||
        fullNames(u).some((name) => name.toLowerCase().includes(lower))
    );
  }, [usersResult, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_LIMIT));
  const paginated = filtered.slice(
    (page - 1) * PAGE_LIMIT,
    page * PAGE_LIMIT
  );

  const goToPage = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    setPage(newPage);
  };

  return (
    <div>
      <ListToolbar search={search} onSearch={(value) => { setSearch(value); setPage(1); }} placeholder={t("registeredUsers.searchPlaceholder")}>
        {canCreate && <RegisterUserButton registered={usersResult ?? []} domain={domain} onRegistered={refresh} />}
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
        {paginated.map((user, index) => (
          <CompactRow key={user.id} number={(page - 1) * PAGE_LIMIT + index + 1}>
            <span className="min-w-0 flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
              {/* Like the Users list: the page of the user, with their calendars and address books */}
              <span className="break-all">
                {user.email ? <UserLink address={user.email} known /> : user.id}
              </span>
              <span className="text-gray-600">{user.firstname} {user.lastname}</span>
              <span className="text-xs text-gray-400 break-all">{t("registeredUsers.id")} {user.id}</span>
            </span>
            {(canEdit || canDelete) && (
              <span className="ml-auto -my-1.5 flex shrink-0 gap-1">
                {canEdit && (
                  <button
                    onClick={() => handleEdit(user)}
                    className="p-1.5 rounded-md hover:bg-gray-200"
                    title={t("registeredUsers.editTooltip", { email: user.email ?? user.id })}
                    aria-label={t("registeredUsers.editTooltip", { email: user.email ?? user.id })}
                  >
                    <Pencil className="w-4 h-4 text-blue-600" aria-hidden="true" />
                  </button>
                )}
                {canDelete && (
                  <button
                    onClick={() => handleDelete(user)}
                    className="p-1.5 rounded-md hover:bg-gray-200"
                    title={t("registeredUsers.deleteTooltip", { email: user.email ?? user.id })}
                    aria-label={t("registeredUsers.deleteTooltip", { email: user.email ?? user.id })}
                  >
                    <Trash2 className="w-4 h-4 text-red-600" aria-hidden="true" />
                  </button>
                )}
              </span>
            )}
          </CompactRow>
        ))}
      </CompactList>
      {search && usersResult && filtered.length === 0 && (
        <p className="text-gray-500 mt-4">{t("registeredUsers.noMatch", { query: search })}</p>
      )}
    </div>
  );
}
