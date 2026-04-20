import { useMemo, useState } from "react";
import { NetworkChannel } from "../types";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PaginationControls } from "@/components/custom/pagination-controls";

const PAGE_LIMIT = Number(import.meta.env.VITE_PAGE_LIMIT) || 50;

const SORTABLE_FIELDS = [
  { key: "username", label: "Username" },
  { key: "protocol", label: "Protocol" },
  { key: "userAgent", label: "User Agent" },
  { key: "requestCount", label: "Request Count" },
  { key: "cumulativeWrittenBytes", label: "Written Bytes" },
  { key: "cumulativeReadBytes", label: "Read Bytes" },
  { key: "liveReadThroughputBytePerSecond", label: "Live Read Throughput" },
  { key: "liveWriteThroughputBytePerSecond", label: "Live Write Throughput" },
] as const;

type SortField = (typeof SORTABLE_FIELDS)[number]["key"];

function getFieldValue(channel: NetworkChannel, field: SortField): string {
  if (field === "username" || field === "protocol") return channel[field] ?? "";
  return channel.protocolSpecificInformation?.[field] ?? "";
}

function formatBytes(value: string | undefined, perSecond = false): string {
  if (value == null || value === "") return "-";
  const num = Number(value);
  if (isNaN(num)) return value;
  const suffix = perSecond ? "/s" : "";
  if (num < 1024) return `${num} B${suffix}`;
  if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)} KB${suffix}`;
  if (num < 1024 * 1024 * 1024) return `${(num / (1024 * 1024)).toFixed(1)} MB${suffix}`;
  return `${(num / (1024 * 1024 * 1024)).toFixed(2)} GB${suffix}`;
}

function compareValues(a: string, b: string): number {
  const numA = Number(a);
  const numB = Number(b);
  if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
  return a.localeCompare(b);
}

interface Props {
  channels: NetworkChannel[];
  paginate?: boolean;
  loading?: boolean;
}

export default function ChannelGrid({ channels, paginate = false, loading = false }: Props) {
  const [sortField, setSortField] = useState<SortField>("username");
  const [sortAsc, setSortAsc] = useState(true);
  const [page, setPage] = useState(1);
  const [selectedChannel, setSelectedChannel] = useState<NetworkChannel | null>(null);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return channels;
    return channels.filter((c) =>
      (c.username ?? "").toLowerCase().includes(q) ||
      (c.remoteAddress ?? "").toLowerCase().includes(q) ||
      (c.protocolSpecificInformation?.userAgent ?? "").toLowerCase().includes(q)
    );
  }, [channels, search]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      const va = getFieldValue(a, sortField);
      const vb = getFieldValue(b, sortField);
      return sortAsc ? compareValues(va, vb) : compareValues(vb, va);
    });
    return copy;
  }, [filtered, sortField, sortAsc]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_LIMIT));
  const displayed = paginate
    ? sorted.slice((page - 1) * PAGE_LIMIT, page * PAGE_LIMIT)
    : sorted;

  const goToPage = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    setPage(newPage);
  };

  return (
    <div>
      {/* Sort controls */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <label className="text-sm font-medium">Sort by:</label>
        <select
          className="border rounded px-2 py-1 text-sm"
          value={sortField}
          onChange={(e) => { setSortField(e.target.value as SortField); setPage(1); }}
        >
          {SORTABLE_FIELDS.map((f) => (
            <option key={f.key} value={f.key}>{f.label}</option>
          ))}
        </select>
        <button
          className="border rounded px-2 py-1 text-sm"
          onClick={() => setSortAsc(!sortAsc)}
        >
          {sortAsc ? "Asc \u2191" : "Desc \u2193"}
        </button>
        <input
          type="search"
          placeholder="Search username, IP, user agent…"
          className="border rounded px-2 py-1 text-sm ml-4 w-64"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
      </div>

      {/* Loading state */}
      {loading && channels.length === 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="h-[58px] rounded-2 animate-pulse bg-gray-200" />
          <div className="h-[58px] rounded-2 animate-pulse bg-gray-200" />
          <div className="h-[58px] rounded-2 animate-pulse bg-gray-200" />
        </div>
      )}

      {!loading && channels.length === 0 && (
        <p className="text-sm text-muted-foreground">No active channels.</p>
      )}

      {/* Legend + Channel rows */}
      {channels.length > 0 && (
        <div>
          <div className="grid grid-cols-[auto_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr] gap-2 text-xs font-semibold text-muted-foreground px-3 pb-2 border-b mb-1">
            <span className="w-10">#</span>
            <span>Username</span>
            <span>Protocol</span>
            <span>Remote Address</span>
            <span>User Agent</span>
            <span>Requests</span>
            <span>Written</span>
            <span>Read</span>
            <span>Live Read</span>
            <span>Live Write</span>
          </div>
          <div className="space-y-1">
            {displayed.map((channel, index) => {
              const globalIndex = paginate ? (page - 1) * PAGE_LIMIT + index + 1 : index + 1;
              const info = channel.protocolSpecificInformation ?? {};
              return (
                <div
                  key={index}
                  className="grid grid-cols-[auto_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr] gap-2 items-center p-3 bg-gray-50 rounded-2 cursor-pointer hover:bg-gray-100 transition text-sm"
                  onClick={() => setSelectedChannel(channel)}
                >
                  <span className="text-muted-foreground w-10">{globalIndex}.</span>
                  <span className="font-mono truncate">{channel.username}</span>
                  <span className="truncate">{channel.protocol}</span>
                  <span className="font-mono truncate">{channel.remoteAddress ?? "-"}</span>
                  <span className="truncate">{info.userAgent ?? "-"}</span>
                  <span className="truncate">{info.requestCount ?? "-"}</span>
                  <span className="truncate">{formatBytes(info.cumulativeWrittenBytes)}</span>
                  <span className="truncate">{formatBytes(info.cumulativeReadBytes)}</span>
                  <span className="truncate">{formatBytes(info.liveReadThroughputBytePerSecond, true)}</span>
                  <span className="truncate">{formatBytes(info.liveWriteThroughputBytePerSecond, true)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Pagination */}
      {paginate && sorted.length > 0 && (
        <PaginationControls
          onFirst={() => goToPage(1)}
          onPrev={() => goToPage(page - 1)}
          onNext={() => goToPage(page + 1)}
          onLast={() => goToPage(totalPages)}
          disabledPrev={page <= 1}
          disabledNext={page >= totalPages}
          label={`Page ${page} / ${totalPages} — Total: ${sorted.length}`}
        />
      )}

      {/* Detail dialog */}
      <Dialog open={!!selectedChannel} onOpenChange={(v) => !v && setSelectedChannel(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Channel — {selectedChannel?.remoteAddress}</DialogTitle>
          </DialogHeader>
          <pre className="text-xs bg-gray-50 p-4 rounded overflow-x-auto">
            {JSON.stringify(selectedChannel, null, 2)}
          </pre>
        </DialogContent>
      </Dialog>
    </div>
  );
}
