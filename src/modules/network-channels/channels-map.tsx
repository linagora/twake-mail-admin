import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { getAllChannels } from "./api-client";
import { NetworkChannel } from "./types";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, RefreshCw } from "lucide-react";

function parseIP(remoteAddress: string): string | null {
  if (!remoteAddress) return null;
  // IPv6 with port: [::1]:1234
  const ipv6Match = remoteAddress.match(/^\[(.+)\]/);
  if (ipv6Match) return ipv6Match[1];
  // IPv4 with port: 1.2.3.4:5678
  const colonIdx = remoteAddress.lastIndexOf(":");
  if (colonIdx !== -1 && !remoteAddress.includes(".")) {
    // pure IPv6, no port
    return remoteAddress;
  }
  if (colonIdx !== -1) return remoteAddress.slice(0, colonIdx);
  return remoteAddress;
}

function isPrivateIP(ip: string): boolean {
  return (
    ip === "localhost" ||
    ip === "::1" ||
    ip.startsWith("127.") ||
    ip.startsWith("10.") ||
    ip.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip) ||
    ip.startsWith("fc") ||
    ip.startsWith("fd")
  );
}

function loadLeaflet(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as any).L) { resolve(); return; }

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(link);

    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Leaflet"));
    document.head.appendChild(script);
  });
}

export default function ChannelsMap() {
  const navigate = useNavigate();
  const mapRef = useRef<HTMLDivElement>(null);
  const [statusText, setStatusText] = useState("Loading channels...");
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    setStatusText("Loading channels...");
    setError(null);
    let cancelled = false;
    let mapInstance: any = null;

    async function init() {
      // 1. Fetch channels
      let channels: NetworkChannel[];
      try {
        channels = await getAllChannels();
      } catch {
        if (!cancelled) setError("Failed to fetch channels.");
        return;
      }

      if (cancelled) return;

      // 2. Extract unique public IPs and count connections per IP
      const ipCount: Record<string, number> = {};
      channels.forEach((c) => {
        const ip = parseIP(c.remoteAddress ?? "");
        if (ip && !isPrivateIP(ip)) {
          ipCount[ip] = (ipCount[ip] ?? 0) + 1;
        }
      });
      const uniqueIPs = Object.keys(ipCount);

      // 3. Load Leaflet from CDN
      setStatusText("Loading map...");
      try {
        await loadLeaflet();
      } catch {
        if (!cancelled) setError("Failed to load Leaflet from CDN.");
        return;
      }

      if (cancelled || !mapRef.current) return;

      // 4. Init map
      const L = (window as any).L;
      mapInstance = L.map(mapRef.current).setView([20, 0], 2);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors',
      }).addTo(mapInstance);

      if (uniqueIPs.length === 0) {
        setStatusText("No public IPs to geolocate.");
        return;
      }

      // 5. Geolocate IPs via ip-api.com batch (free, CORS supported)
      setStatusText(`Geolocating ${uniqueIPs.length} IP(s)…`);
      let geoResults: ({ ip: string; lat: number; lon: number; city: string; country: string } | null)[] = [];
      try {
        const res = await fetch("http://ip-api.com/batch?fields=status,lat,lon,city,country,query", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(uniqueIPs.map((ip) => ({ query: ip }))),
        });
        const data = await res.json();
        geoResults = (data as any[]).map((d) =>
          d.status === "success"
            ? { ip: d.query, lat: d.lat, lon: d.lon, city: d.city, country: d.country }
            : null
        );
      } catch {
        setStatusText("Geolocation failed.");
      }

      if (cancelled) return;

      // 6. Add markers
      geoResults.forEach((geo) => {
        if (!geo) return;
        const count = ipCount[geo.ip];
        L.marker([geo.lat, geo.lon])
          .addTo(mapInstance)
          .bindPopup(
            `<b>${geo.ip}</b><br>${geo.city}, ${geo.country}<br>${count} connection${count > 1 ? "s" : ""}`
          );
      });

      setStatusText("");
    }

    init();

    return () => {
      cancelled = true;
      mapInstance?.remove();
    };
  }, [reloadKey]);

  return (
    <div className="mt-4">
      <div className="flex items-center gap-3 mb-3">
        <Button variant="outline" size="sm" onClick={() => navigate("/network-channels")}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        <Button variant="outline" size="sm" onClick={() => setReloadKey((k) => k + 1)} disabled={!!statusText && !error}>
          <RefreshCw className="w-4 h-4" />
        </Button>
        {error ? (
          <span className="text-sm text-red-500">{error}</span>
        ) : statusText ? (
          <span className="text-sm text-muted-foreground flex items-center gap-1">
            <Loader2 className="w-3 h-3 animate-spin" /> {statusText}
          </span>
        ) : null}
      </div>
      <div ref={mapRef} style={{ height: "calc(100vh - 180px)", width: "calc(100vw - 320px)" }} className="rounded border" />
    </div>
  );
}
