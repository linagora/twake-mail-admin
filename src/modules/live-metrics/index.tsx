import { useCallback, useMemo, useState } from "react";
import { Loader2, RefreshCw, Search } from "lucide-react";
import { useFetchData } from "@/hooks/use-fetch-data";
import { getMetrics } from "./api-client";
import Header from "@/components/custom/header";
import { Button } from "@/components/ui/button";

const headerSubTitle = "Live Prometheus metrics from the server.";
const docuUrl = "https://james.staged.apache.org/james-project/3.10.0/servers/distributed/operate/metrics.html";

interface MetricFamily {
  name: string;
  help: string;
  type: string;
  lines: { raw: string; labels: string; value: string }[];
}

function parseMetrics(raw: string): MetricFamily[] {
  const families: MetricFamily[] = [];
  let current: MetricFamily | null = null;

  for (const line of raw.split("\n")) {
    if (line.startsWith("# HELP ")) {
      const rest = line.slice(7);
      const spaceIdx = rest.indexOf(" ");
      const name = spaceIdx >= 0 ? rest.slice(0, spaceIdx) : rest;
      const help = spaceIdx >= 0 ? rest.slice(spaceIdx + 1) : "";
      current = { name, help, type: "", lines: [] };
      families.push(current);
    } else if (line.startsWith("# TYPE ")) {
      if (current) {
        const rest = line.slice(7);
        const spaceIdx = rest.indexOf(" ");
        current.type = spaceIdx >= 0 ? rest.slice(spaceIdx + 1) : "";
      }
    } else if (line && !line.startsWith("#")) {
      const match = line.match(/^([^{}\s]+)(\{[^}]*\})?\s+(.+)$/);
      if (match) {
        const labels = match[2] ?? "";
        const value = match[3];
        if (!current || !line.startsWith(current.name)) {
          current = { name: match[1], help: "", type: "", lines: [] };
          families.push(current);
        }
        current.lines.push({ raw: line, labels, value });
      }
    }
  }

  return families;
}

function formatValue(val: string): string {
  const num = Number(val);
  if (isNaN(num)) return val;
  if (Number.isInteger(num)) return num.toLocaleString();
  return num.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

export default function LiveMetrics() {
  const fetchMetrics = useCallback(() => getMetrics(), []);
  const { data: raw, isLoading, refresh } = useFetchData<string>(fetchMetrics);
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const families = useMemo(() => {
    if (!raw) return [];
    return parseMetrics(raw);
  }, [raw]);

  const filtered = useMemo(() => {
    if (!search) return families;
    const lower = search.toLowerCase();
    return families.filter(
      (f) =>
        f.name.toLowerCase().includes(lower) ||
        f.help.toLowerCase().includes(lower)
    );
  }, [families, search]);

  const toggleCollapse = (name: string) => {
    setCollapsed((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  return (
    <div className="p-4">
      <Header headerSubTitle={headerSubTitle} docuUrl={docuUrl} />

      <div className="mt-4 flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={refresh} disabled={isLoading}>
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
        </Button>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter metrics..."
            className="w-full pl-9 pr-4 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        {families.length > 0 && (
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            {filtered.length} / {families.length} families
          </span>
        )}
      </div>

      {isLoading && !raw && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <div className="h-[80px] rounded-2 animate-pulse bg-gray-200" />
          <div className="h-[80px] rounded-2 animate-pulse bg-gray-200" />
          <div className="h-[80px] rounded-2 animate-pulse bg-gray-200" />
        </div>
      )}

      <div className="mt-4 space-y-2">
        {filtered.map((family) => {
          const isCollapsed = collapsed[family.name];
          return (
            <div key={family.name} className="bg-gray-50 rounded-2 overflow-hidden">
              <button
                onClick={() => toggleCollapse(family.name)}
                className="w-full flex items-center justify-between p-3 hover:bg-gray-100 transition text-left"
              >
                <div className="min-w-0">
                  <span className="font-mono text-sm font-semibold">{family.name}</span>
                  {family.type && (
                    <span className="ml-2 text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">
                      {family.type}
                    </span>
                  )}
                  {family.help && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{family.help}</p>
                  )}
                </div>
                <span className="text-xs text-muted-foreground ml-2 whitespace-nowrap">
                  {family.lines.length} sample{family.lines.length !== 1 ? "s" : ""}
                </span>
              </button>

              {!isCollapsed && (
                <div className="border-t px-3 pb-2">
                  <table className="w-full text-sm">
                    <tbody>
                      {family.lines.map((line, i) => (
                        <tr key={i} className="border-b last:border-0 border-gray-100">
                          <td className="py-1 pr-2 font-mono text-xs text-muted-foreground truncate max-w-[500px]">
                            {line.labels || "{}"}
                          </td>
                          <td className="py-1 text-right font-mono text-sm font-medium whitespace-nowrap">
                            {formatValue(line.value)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
