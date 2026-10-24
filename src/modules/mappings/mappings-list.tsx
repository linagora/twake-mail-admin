import { useFetchData } from "@/hooks/use-fetch-data";
import {
  getMappings,
  deleteAddressMapping,
  deleteAliasMapping,
  deleteForwardMapping,
  deleteGroupMapping,
  deleteDomainMapping,
  deleteRegexMapping,
} from "./api-client";
import { GetMappingsResponseType, FlatMapping } from "./types";
import { useEffect, useMemo, useState } from "react";
import { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
import ErrorDisplayer from "@/components/custom/error-displayer";
import { Plus, Trash2 } from "lucide-react";
import { useConfirm } from "@/hooks/use-confirm";
import { useIsAllowed } from "@/lib/proxy-resolver-context";
import { PaginationControls } from "@/components/custom/pagination-controls";
import { appConfig } from "@/lib/config";
import { Button } from "@/components/ui/button";
import ListToolbar from "@/components/custom/list-toolbar";
import CreateMappingDialog, { MappingKind } from "./create-mapping-dialog";
import UserLink from "@/components/custom/user-link";

// Mappings between addresses, whose ends can be users; regex and domain mappings are not
const ADDRESS_TYPES = ["Address", "Alias", "Forward", "Group"];

const PAGE_LIMIT = Number(import.meta.env.VITE_PAGE_LIMIT) || 50;

// A forward of an address to itself is how a copy is kept in its mailbox while it is forwarded
const isKeptCopy = (mapping: FlatMapping) => mapping.type === "Forward" && mapping.source === mapping.destination;

// The type as its cell reads it, which the search matches too
const displayedType = (mapping: FlatMapping, t: TFunction) =>
  (isKeptCopy(mapping) ? t("mappings.forwardCopyKept") : t(`mappings.typeNames.${mapping.type}`, { defaultValue: mapping.type }));

export default function MappingsList() {
  const { t } = useTranslation();
  const canAddAddress = useIsAllowed("POST", "/mappings/address/{source}/targets/{destination}");
  const canAddRegex = useIsAllowed("POST", "/mappings/regex/{source}/targets/{regex}");
  const canAddDomainMapping = useIsAllowed("PUT", "/domainMappings/{fromDomain}");
  const canAddDomain = appConfig.application === "MAIL" && canAddDomainMapping;
  const canDelete = useIsAllowed("DELETE", "/mappings/address/{source}/targets/{destination}");
  const canDeleteGroupMember = useIsAllowed("DELETE", "/address/groups/{groupAddress}/{memberAddress}");

  const canDeleteMapping = (type: string) => {
    if (type === "Group") return canDeleteGroupMember;
    return canDelete && ["Address", "Alias", "Forward", "Domain", "DomainAlias", "Regex"].includes(type);
  };

  const {
    data: mappingsResult,
    isLoading,
    error,
    refresh,
  } = useFetchData<GetMappingsResponseType>(getMappings);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");



  const [deletingPage, setDeletingPage] = useState(false);
  const [creating, setCreating] = useState(false);
  const { toast } = useToast();
  const confirm = useConfirm();
  // WebAdmin names the types in English (Forward, DomainAlias...): shown in the UI language
  const typeName = (type: string) => t(`mappings.typeNames.${type}`, { defaultValue: type });

  const deleteMapping = async (mapping: FlatMapping) => {
    switch (mapping.type) {
      case "Address":
        return deleteAddressMapping(mapping.source, mapping.destination);
      case "Alias":
        return deleteAliasMapping(mapping.source, mapping.destination);
      case "Forward":
        return deleteForwardMapping(mapping.source, mapping.destination);
      case "Group":
        return deleteGroupMapping(mapping.source, mapping.destination);
      case "Domain":
      case "DomainAlias":
        return deleteDomainMapping(mapping.source, mapping.destination);
      case "Regex":
        return deleteRegexMapping(mapping.source, mapping.destination);
      default:
        throw new Error(`Unsupported mapping type: ${mapping.type}`);
    }
  };

  const handleDelete = async (mapping: FlatMapping) => {
    const typeLabel = typeName(mapping.type).toLowerCase();
    const confirmed = await confirm({
      header: t("mappings.removeTitle", { type: typeName(mapping.type) }),
      destructive: true,
      confirmLabel: t("common.remove"),
      message: t("mappings.removeConfirm", { typeLabel, source: mapping.source, destination: mapping.destination }),
      ...(isKeptCopy(mapping) && { consequence: t("mappings.removeKeptCopyConsequence", { source: mapping.source }) }),
    });
    if (!confirmed) return;
    try {
      await deleteMapping(mapping);
      toast({ title: t("mappings.removed", { type: typeName(mapping.type) }) });
      await refresh();
    } catch (err) {
      toast({
        title: t("mappings.errorRemoving", { typeLabel }),
        description: <ErrorDisplayer error={err} />,
      });
    }
  };

  const handleDeletePage = async () => {
    if (deletablePageMappings.length === 0) return;
    const confirmed = await confirm({
      header: t("mappings.removePageTitle"),
      destructive: true,
      confirmLabel: t("common.remove"),
      className: "max-w-2xl",
      message: (
        <div className="flex flex-col gap-3">
          <p>{t("mappings.removePageConfirm", { total: deletablePageMappings.length })}</p>
          <ul className="max-h-72 overflow-y-auto border rounded-md divide-y">
            {deletablePageMappings.map((mapping, index) => (
              <li
                key={`${mapping.source}-${mapping.type}-${mapping.destination}-${index}`}
                className="px-3 py-2 text-sm flex items-center gap-2"
              >
                <span className="text-gray-500 shrink-0">{typeName(mapping.type)}</span>
                <span className="truncate">{mapping.source}</span>
                <span className="text-gray-400 shrink-0">→</span>
                <span className="truncate">{mapping.destination}</span>
              </li>
            ))}
          </ul>
        </div>
      ),
    });
    if (!confirmed) return;
    setDeletingPage(true);
    try {
      const failures: unknown[] = [];
      for (const mapping of deletablePageMappings) {
        try {
          await deleteMapping(mapping);
        } catch (err) {
          failures.push(err);
        }
      }
      const removed = deletablePageMappings.length - failures.length;
      if (failures.length > 0) {
        toast({
          title: t("mappings.errorRemovingPage", { failed: failures.length, removed }),
          description: <ErrorDisplayer error={failures[0]} />,
        });
      } else {
        toast({ title: t("mappings.removedPage", { total: removed }) });
      }
      await refresh();
    } finally {
      setDeletingPage(false);
    }
  };

  const flatMappings = useMemo<FlatMapping[]>(() => {
    if (!mappingsResult) return [];
    const rows: FlatMapping[] = [];
    for (const [source, entries] of Object.entries(mappingsResult)) {
      for (const entry of entries) {
        rows.push({
          source,
          type: entry.type,
          destination: entry.mapping,
        });
      }
    }
    rows.sort((a, b) => a.source.localeCompare(b.source));
    return rows;
  }, [mappingsResult]);

  const filteredMappings = useMemo(() => {
    if (!search) return flatMappings;
    const lower = search.toLowerCase();
    return flatMappings.filter(
      (m) =>
        m.source.toLowerCase().includes(lower) ||
        m.type.toLowerCase().includes(lower) ||
        displayedType(m, t).toLowerCase().includes(lower) ||
        m.destination.toLowerCase().includes(lower)
    );
  }, [flatMappings, search, t]);

  const totalPages = Math.max(1, Math.ceil(filteredMappings.length / PAGE_LIMIT));
  const paginatedMappings = filteredMappings.slice(
    (page - 1) * PAGE_LIMIT,
    page * PAGE_LIMIT
  );

  const deletablePageMappings = paginatedMappings.filter((m) => canDeleteMapping(m.type));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const goToPage = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    setPage(newPage);
  };

  // One "Add" for the three kinds of mapping: the kind is chosen in the modal
  const creatableKinds: MappingKind[] = [
    ...(canAddAddress ? ["address" as const] : []),
    ...(canAddRegex ? ["regex" as const] : []),
    ...(canAddDomain ? ["domain" as const] : []),
  ];

  return (
    <div>
      <ListToolbar search={search} onSearch={(value) => { setSearch(value); setPage(1); }} placeholder={t("mappings.searchPlaceholder")}>
        {creatableKinds.length > 0 && (
          <Button onClick={() => setCreating(true)}>
            <Plus className="w-4 h-4" aria-hidden="true" />
            {t("mappings.addTitle")}
          </Button>
        )}
        {deletablePageMappings.length > 0 && (
          <Button
            variant="outline"
            onClick={handleDeletePage}
            disabled={deletingPage}
            className="border-red-500 text-red-600 hover:bg-red-50 hover:text-red-700"
          >
            <Trash2 className="w-4 h-4" aria-hidden="true" />
            {deletingPage
              ? t("mappings.removingPage")
              : t("mappings.removePage", { total: deletablePageMappings.length })}
          </Button>
        )}
      </ListToolbar>
      <CreateMappingDialog open={creating} kinds={creatableKinds} onClose={() => setCreating(false)} onCreated={refresh} />

      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <div className="h-[58px] rounded-2 animate-pulse bg-gray-200" />
          <div className="h-[58px] rounded-2 animate-pulse bg-gray-200" />
          <div className="h-[58px] rounded-2 animate-pulse bg-gray-200" />
        </div>
      )}
      {error && <p className="text-red-500 mt-4">{t("common.errorPrefix", { message: error })}</p>}
      {filteredMappings.length > 0 && (
        <PaginationControls
          onFirst={() => goToPage(1)}
          onPrev={() => goToPage(page - 1)}
          onNext={() => goToPage(page + 1)}
          onLast={() => goToPage(totalPages)}
          disabledPrev={page <= 1}
          disabledNext={page >= totalPages}
          label={t("common.page", { page, totalPages, total: filteredMappings.length })}
          total={filteredMappings.length}
        />
      )}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-100">
              <th className="text-left px-4 py-2 text-sm font-medium">#</th>
              <th className="text-left px-4 py-2 text-sm font-medium">{t("mappings.source")}</th>
              <th className="text-left px-4 py-2 text-sm font-medium">{t("mappings.type")}</th>
              <th className="text-left px-4 py-2 text-sm font-medium">{t("mappings.destination")}</th>
              <th className="text-left px-4 py-2 text-sm font-medium">{t("mappings.action")}</th>
            </tr>
          </thead>
          <tbody>
            {paginatedMappings.map((mapping, index) => (
              <tr
                key={`${mapping.source}-${mapping.type}-${mapping.destination}-${index}`}
                className="border-b hover:bg-gray-50"
              >
                <td className="px-4 py-2 text-sm text-gray-500">
                  {(page - 1) * PAGE_LIMIT + index + 1}
                </td>
                <td className="px-4 py-2 text-sm">{ADDRESS_TYPES.includes(mapping.type) ? <UserLink address={mapping.source} /> : mapping.source}</td>
                <td className="px-4 py-2 text-sm">{displayedType(mapping, t)}</td>
                <td className="px-4 py-2 text-sm">{ADDRESS_TYPES.includes(mapping.type) ? <UserLink address={mapping.destination} /> : mapping.destination}</td>
                <td className="px-4 py-2 text-sm">
                  {canDeleteMapping(mapping.type) && (
                    <button
                      onClick={() => handleDelete(mapping)}
                      className="p-1 rounded-md hover:bg-red-100 text-red-500 transition"
                      title={t("mappings.removeTitle", { type: typeName(mapping.type) })}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!isLoading && filteredMappings.length === 0 && (
        <p className="mt-4 text-gray-500 text-sm">{t("mappings.empty")}</p>
      )}
    </div>
  );
}
