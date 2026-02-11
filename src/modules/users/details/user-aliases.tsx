import { useCallback, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react";
import { useFetchData } from "@/hooks/use-fetch-data";
import { getUserAliases, addUserAlias, removeUserAlias } from "../api-client";
import { GetUserAliasesResponseType } from "../types";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/hooks/use-confirm";
import ErrorDisplayer from "@/components/custom/error-displayer";

interface Props {
  username: string;
}

export default function UserAliases({ username }: Props) {
  const { toast } = useToast();
  const confirm = useConfirm();

  const fetchAliases = useCallback(() => getUserAliases(username), [username]);
  const {
    data: aliases,
    isLoading,
    error,
    refresh,
  } = useFetchData<GetUserAliasesResponseType>(fetchAliases);

  const [open, setOpen] = useState(false);
  const [newAlias, setNewAlias] = useState("");
  const [showCreateInput, setShowCreateInput] = useState(false);

  const sorted = useMemo(() => {
    if (!aliases) return [];
    return [...aliases].sort((a, b) => a.source.localeCompare(b.source));
  }, [aliases]);

  const handleAdd = async () => {
    const alias = newAlias.trim();
    if (!alias) return;
    try {
      await addUserAlias(username, alias);
      toast({ title: "Alias added successfully" });
      setNewAlias("");
      setShowCreateInput(false);
      await refresh();
    } catch (err) {
      toast({
        title: "Error adding alias",
        description: <ErrorDisplayer error={err} />,
      });
    }
  };

  const handleRemove = async (alias: string) => {
    const confirmed = await confirm({
      header: "Remove Alias",
      message: `Remove alias "${alias}" from ${username}?`,
    });
    if (!confirmed) return;
    try {
      await removeUserAlias(username, alias);
      toast({ title: "Alias removed successfully" });
      await refresh();
    } catch (err) {
      toast({
        title: "Error removing alias",
        description: <ErrorDisplayer error={err} />,
      });
    }
  };

  return (
    <div className="mt-6">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-2 text-md font-semibold hover:text-blue-600 transition"
        >
          {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          Aliases
          {aliases && (
            <span className="text-sm font-normal text-gray-500">
              ({aliases.length})
            </span>
          )}
        </button>
        {open && (
          <button
            onClick={() => setShowCreateInput(!showCreateInput)}
            className="p-1 rounded-md hover:bg-gray-200 transition"
            title="Add alias"
          >
            <Plus className="w-4 h-4" />
          </button>
        )}
      </div>

      {open && (
        <div className="mt-2">
          {showCreateInput && (
            <div className="flex gap-2 mt-2 mb-2">
              <input
                type="text"
                value={newAlias}
                onChange={(e) => setNewAlias(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                placeholder="alias@domain.com"
                className="flex-1 px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleAdd}
                disabled={!newAlias.trim()}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add
              </button>
            </div>
          )}

          {isLoading && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-2">
              <div className="h-[58px] rounded-2 animate-pulse bg-gray-200" />
            </div>
          )}
          {error && <p className="text-red-500 mt-2">Error: {error}</p>}

          {aliases && (
            <div>
              {sorted.map((alias, index) => (
                <div
                  key={alias.source}
                  className="space-y-1 p-4 bg-gray-50 rounded-2 my-2 flex justify-between items-center"
                >
                  <h4 className="text-sm font-medium leading-none">
                    <span className="text-gray-500 mr-2">{index + 1}/</span>
                    {alias.source}
                  </h4>
                  <button
                    onClick={() => handleRemove(alias.source)}
                    className="p-2 rounded-md hover:bg-gray-200"
                    title="Remove alias"
                  >
                    <Trash2 className="w-4 h-4 text-red-600" />
                  </button>
                </div>
              ))}
              {aliases.length === 0 && (
                <p className="mt-2 text-sm text-gray-500">No aliases configured.</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
