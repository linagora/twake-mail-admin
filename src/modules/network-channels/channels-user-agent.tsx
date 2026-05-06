import { useCallback, useMemo } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { getAllChannels } from "./api-client";
import { NetworkChannel } from "./types";
import { useFetchData } from "@/hooks/use-fetch-data";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, RefreshCw } from "lucide-react";

const COLORS = [
  "#4f86c6", "#e07b54", "#6dbf67", "#b97fd4", "#e6c94a",
  "#5bc4c4", "#e26d8a", "#a8c97f", "#f4a261", "#7b9cda",
  "#c77dba", "#52b69a", "#f77f00", "#8ecae6", "#d4a5a5",
];

function countUserAgents(channels: NetworkChannel[]): { label: string; count: number }[] {
  const counts: Record<string, number> = {};
  for (const c of channels) {
    const ua = c.protocolSpecificInformation?.userAgent?.trim() || "(unknown)";
    counts[ua] = (counts[ua] ?? 0) + 1;
  }
  return Object.entries(counts)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

interface PieSlice {
  label: string;
  count: number;
  startAngle: number;
  endAngle: number;
  color: string;
}

function buildSlices(data: { label: string; count: number }[]): PieSlice[] {
  const total = data.reduce((s, d) => s + d.count, 0);
  if (total === 0) return [];
  let angle = -Math.PI / 2;
  return data.map((d, i) => {
    const sweep = (d.count / total) * 2 * Math.PI;
    const slice: PieSlice = {
      label: d.label,
      count: d.count,
      startAngle: angle,
      endAngle: angle + sweep,
      color: COLORS[i % COLORS.length],
    };
    angle += sweep;
    return slice;
  });
}

function polarToCartesian(cx: number, cy: number, r: number, angle: number) {
  return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
}

function slicePath(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
  const start = polarToCartesian(cx, cy, r, startAngle);
  const end = polarToCartesian(cx, cy, r, endAngle);
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
  return [
    `M ${cx} ${cy}`,
    `L ${start.x} ${start.y}`,
    `A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`,
    "Z",
  ].join(" ");
}

function PieChart({ slices }: { slices: PieSlice[] }) {
  const cx = 160, cy = 160, r = 140;
  // single slice: draw full circle
  if (slices.length === 1) {
    return (
      <svg width={320} height={320} viewBox="0 0 320 320">
        <circle cx={cx} cy={cy} r={r} fill={slices[0].color} />
      </svg>
    );
  }
  return (
    <svg width={320} height={320} viewBox="0 0 320 320">
      {slices.map((s, i) => (
        <path key={i} d={slicePath(cx, cy, r, s.startAngle, s.endAngle)} fill={s.color} stroke="white" strokeWidth={1} />
      ))}
    </svg>
  );
}

export default function ChannelsUserAgent() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const fetchAll = useCallback(() => getAllChannels(), []);
  const { data, isLoading, refresh } = useFetchData<NetworkChannel[]>(fetchAll);

  const uaCounts = useMemo(() => countUserAgents(data ?? []), [data]);
  const total = useMemo(() => uaCounts.reduce((s, d) => s + d.count, 0), [uaCounts]);
  const slices = useMemo(() => buildSlices(uaCounts), [uaCounts]);

  return (
    <div className="mt-4">
      <div className="flex items-center gap-3 mb-4">
        <Button variant="outline" size="sm" onClick={() => navigate("/network-channels")}>
          <ArrowLeft className="w-4 h-4 mr-1" /> {t("networkChannels.backButton")}
        </Button>
        <Button variant="outline" size="sm" onClick={refresh} disabled={isLoading}>
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
        </Button>
        {isLoading && (
          <span className="text-sm text-muted-foreground flex items-center gap-1">
            <Loader2 className="w-3 h-3 animate-spin" /> {t("common.loading")}
          </span>
        )}
      </div>

      {!isLoading && total === 0 && (
        <p className="text-sm text-muted-foreground">{t("networkChannels.noActiveChannels")}</p>
      )}

      {total > 0 && (
        <div className="flex flex-col md:flex-row gap-8 items-start">
          <PieChart slices={slices} />
          <div className="flex flex-col gap-2 min-w-0">
            <p className="text-sm text-muted-foreground mb-1">{t("networkChannels.totalConnections", { count: total })}</p>
            {slices.map((s, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className="inline-block w-3 h-3 rounded-full flex-shrink-0" style={{ background: s.color }} />
                <span className="truncate max-w-xs font-mono">{s.label}</span>
                <span className="text-muted-foreground ml-auto pl-4 flex-shrink-0">
                  {s.count} ({((s.count / total) * 100).toFixed(1)}%)
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
