import { useState, useCallback, useMemo } from "react";
import { Loader2, RefreshCw, Map, MonitorSmartphone } from "lucide-react";
import { useNavigate } from "react-router";
import { useIsAllowed } from "@/lib/proxy-resolver-context";
import { getAllChannels, disconnectAllChannels } from "./api-client";
import { NetworkChannel, ChannelQueryParams } from "./types";
import { SORTABLE_FIELDS, SortField, getFieldValue, compareValues } from "./components/channel-grid";
import { useFetchData } from "@/hooks/use-fetch-data";
import { useConfirm } from "@/hooks/use-confirm";
import { useToast } from "@/hooks/use-toast";
import ErrorDisplayer from "@/components/custom/error-displayer";
import { Button } from "@/components/ui/button";
import ChannelGrid from "./components/channel-grid";

const PAGE_LIMIT = Number(import.meta.env.VITE_PAGE_LIMIT) || 50;

export default function ChannelsList() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const confirm = useConfirm();
  const canDisconnectAll = useIsAllowed("DELETE", "/servers/channels");

  const [page, setPage] = useState(1);
  const [sortField, setSortField] = useState<SortField>("username");
  const [sortAsc, setSortAsc] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);

  const serverParams = useMemo((): ChannelQueryParams => {
    const field = SORTABLE_FIELDS.find((f) => f.key === sortField)!;
    return {
      offset: (page - 1) * PAGE_LIMIT,
      limit: PAGE_LIMIT,
      sortBy: field.sortBy,
      sortDirection: sortAsc ? "asc" : "desc",
      sortType: field.sortType,
    };
  }, [page, sortField, sortAsc]);

  const fetchAll = useCallback(() => getAllChannels(serverParams), [serverParams]);
  const { data, isLoading, refresh } = useFetchData<NetworkChannel[]>(fetchAll);

  // Client-side sort + limit fallback (ignored if backend already applied them)
  const channels = useMemo(() => {
    if (!data) return [];
    const sorted = [...data].sort((a, b) => {
      const va = getFieldValue(a, sortField);
      const vb = getFieldValue(b, sortField);
      return sortAsc ? compareValues(va, vb) : compareValues(vb, va);
    });
    return sorted.slice(0, PAGE_LIMIT);
  }, [data, sortField, sortAsc]);

  const hasMore = (data?.length ?? 0) >= PAGE_LIMIT;

  const handleSortChange = (field: SortField, asc: boolean) => {
    setSortField(field);
    setSortAsc(asc);
    setPage(1);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage < 1) return;
    setPage(newPage);
  };

  const handleDisconnectAll = async () => {
    const confirmed = await confirm({
      header: "Disconnect All Users",
      message: "Disconnect all user channels on the server? This will close every active connection.",
    });
    if (!confirmed) return;

    setDisconnecting(true);
    try {
      await disconnectAllChannels();
      toast({ title: "All users disconnected successfully" });
      refresh();
    } catch (err) {
      toast({
        title: "Error disconnecting all users",
        description: <ErrorDisplayer error={err} />,
      });
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <div className="mt-4">
      <div className="flex justify-end gap-2 mb-4">
        <Button variant="outline" size="sm" onClick={() => navigate("/network-channels/user-agent")}>
          <MonitorSmartphone className="w-4 h-4 mr-1" /> User agent
        </Button>
        <Button variant="outline" size="sm" onClick={() => navigate("/network-channels/map")}>
          <Map className="w-4 h-4 mr-1" /> Map
        </Button>
        <Button variant="outline" size="sm" onClick={refresh} disabled={isLoading}>
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
        </Button>
        {canDisconnectAll && (
          <Button
            className="bg-orange-500 hover:bg-orange-600 rounded-sm"
            size="sm"
            onClick={handleDisconnectAll}
            disabled={disconnecting}
          >
            {disconnecting && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
            Disconnect all users
          </Button>
        )}
      </div>

      <ChannelGrid
        channels={channels}
        paginate
        loading={isLoading}
        page={page}
        hasMore={hasMore}
        onPageChange={handlePageChange}
        sortField={sortField}
        sortAsc={sortAsc}
        onSortChange={handleSortChange}
      />
    </div>
  );
}
