import { useCallback, useMemo, useState } from "react";
import { Pencil } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useFetchData } from "@/hooks/use-fetch-data";
import { useCheckUserExists } from "@/hooks/use-check-user-exists";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/hooks/use-confirm";
import { getRegisteredUsers, createRegisteredUser, updateRegisteredUser } from "./api-client";
import { RegisteredUser } from "./types";
import ErrorDisplayer from "@/components/custom/error-displayer";
import { useDomain } from "@/modules/domain-admin/domain-context";
import { useIsAllowed } from "@/lib/proxy-resolver-context";
import { PaginationControls } from "@/components/custom/pagination-controls";

const PAGE_LIMIT = Number(import.meta.env.VITE_PAGE_LIMIT) || 50;

function EditUserForm({ user, onChange }: { user: RegisteredUser; onChange: (data: { email: string; firstname: string; lastname: string }) => void }) {
  const { t } = useTranslation();
  const [email, setEmail] = useState(user.email ?? "");
  const [firstname, setFirstname] = useState(user.firstname ?? "");
  const [lastname, setLastname] = useState(user.lastname ?? "");

  const handleChange = (e: string, f: string, l: string) => {
    onChange({ email: e, firstname: f, lastname: l });
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="text-sm font-medium">{t("registeredUsers.email")}</label>
        <input
          type="text"
          value={email}
          onChange={(e) => { setEmail(e.target.value); handleChange(e.target.value, firstname, lastname); }}
          className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div>
        <label className="text-sm font-medium">{t("registeredUsers.firstname")}</label>
        <input
          type="text"
          value={firstname}
          onChange={(e) => { setFirstname(e.target.value); handleChange(email, e.target.value, lastname); }}
          className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div>
        <label className="text-sm font-medium">{t("registeredUsers.lastname")}</label>
        <input
          type="text"
          value={lastname}
          onChange={(e) => { setLastname(e.target.value); handleChange(email, firstname, e.target.value); }}
          className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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

  const fetchUsers = useCallback(() => getRegisteredUsers(domain), [domain]);
  const {
    data: usersResult,
    isLoading,
    error,
    refresh,
  } = useFetchData<RegisteredUser[]>(fetchUsers);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const userStatus = useCheckUserExists(newUsername);

  const handleAdd = async () => {
    const username = newUsername.trim();
    if (!username || userStatus !== "exists") return;

    try {
      const parts = username.split("@");
      const user: RegisteredUser = {
        id: username,
        email: username,
        firstname: parts[0] || "",
        lastname: "",
      };
      await createRegisteredUser(user, domain);
      toast({ title: t("registeredUsers.registered", { username }) });
      setNewUsername("");
      refresh();
    } catch (err) {
      toast({
        title: t("registeredUsers.errorRegistering"),
        description: <ErrorDisplayer error={err} />,
      });
    }
  };

  const handleEdit = async (user: RegisteredUser) => {
    let currentValues = { email: user.email ?? "", firstname: user.firstname ?? "", lastname: user.lastname ?? "" };

    const result = await confirm({
      header: t("registeredUsers.editTitle"),
      message: (
        <EditUserForm
          user={user}
          onChange={(values) => { currentValues = values; }}
        />
      ),
    });
    if (!result) return;

    try {
      await updateRegisteredUser(user.id, currentValues, domain);
      toast({ title: t("registeredUsers.updated") });
      refresh();
    } catch (err) {
      toast({
        title: t("registeredUsers.errorUpdating"),
        description: <ErrorDisplayer error={err} />,
      });
    }
  };

  const filtered = useMemo(() => {
    if (!usersResult) return [];
    const sorted = [...usersResult].sort((a, b) =>
      (a.email ?? "").localeCompare(b.email ?? "")
    );
    if (!search) return sorted;
    const lower = search.toLowerCase();
    return sorted.filter(
      (u) =>
        (u.id ?? "").toLowerCase().includes(lower) ||
        (u.email ?? "").toLowerCase().includes(lower) ||
        (u.firstname ?? "").toLowerCase().includes(lower) ||
        (u.lastname ?? "").toLowerCase().includes(lower)
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
      {canCreate && (
        <div className="flex gap-2 mt-4">
          <input
            type="text"
            value={newUsername}
            onChange={(e) => setNewUsername(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder={t("registeredUsers.placeholder")}
            className="flex-1 px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {userStatus === "checking" && (
            <span className="flex items-center text-xs text-gray-400 whitespace-nowrap">
              {t("common.checking")}
            </span>
          )}
          {userStatus === "exists" && (
            <span className="flex items-center gap-1 text-xs text-green-600 whitespace-nowrap">
              <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
              {t("common.userExists")}
            </span>
          )}
          {userStatus === "not_found" && (
            <span className="flex items-center gap-1 text-xs text-orange-500 whitespace-nowrap">
              <span className="inline-block w-2 h-2 rounded-full bg-orange-400" />
              {t("common.userNotFound")}
            </span>
          )}
          {userStatus === "invalid" && (
            <span className="flex items-center gap-1 text-xs text-red-600 whitespace-nowrap">
              <span className="inline-block w-2 h-2 rounded-full bg-red-500" />
              {t("common.invalidUsername")}
            </span>
          )}
          <button
            onClick={handleAdd}
            disabled={!newUsername.trim() || userStatus !== "exists"}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t("common.add")}
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
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(1);
        }}
        placeholder={t("registeredUsers.searchPlaceholder")}
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
        {paginated.map((user, index) => (
          <div
            key={user.id}
            className="space-y-1 p-4 bg-white rounded-2 my-4 flex justify-between items-center"
          >
            <div>
              <h4 className="text-sm font-medium leading-none">
                <span className="text-gray-500 mr-2">
                  {(page - 1) * PAGE_LIMIT + index + 1}/
                </span>
                {user.email}
              </h4>
              <p className="text-xs text-gray-500 mt-1">
                {user.firstname} {user.lastname}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {t("registeredUsers.id")} {user.id}
              </p>
            </div>
            {canEdit && (
              <button
                onClick={() => handleEdit(user)}
                className="p-2 rounded-md hover:bg-gray-200"
                title={t("registeredUsers.editTooltip")}
              >
                <Pencil className="w-4 h-4 text-blue-600" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
