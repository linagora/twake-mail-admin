import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { getAllChannels } from "./api-client";
import { NetworkChannel } from "./types";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, RefreshCw } from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

// Leaflet is bundled (no third-party CDN): point its default marker at the bundled images
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({ iconUrl: markerIcon, iconRetinaUrl: markerIcon2x, shadowUrl: markerShadow });

export interface GeoLocation {
  ip: string;
  lat: number;
  lon: number;
  city: string;
  country: string;
}

/**
 * The ip-api compatible batch endpoint used to geolocate client IPs (window.__ENV__.GEOIP_URL).
 * Geolocation sends client IPs to that service, so it is opt-in and only over https.
 */
export function geoipUrl(): string | null {
  const url = window.__ENV__?.GEOIP_URL;
  return url && url.startsWith("https://") ? url : null;
}

/** The popup of a marker, built as text nodes: the geolocation service is a third party. */
export function buildPopup(geo: GeoLocation, count: number): HTMLElement {
  const popup = document.createElement("div");
  const ip = document.createElement("b");
  ip.textContent = String(geo.ip);
  popup.append(
    ip,
    document.createElement("br"),
    `${geo.city}, ${geo.country}`,
    document.createElement("br"),
    `${count} connection${count > 1 ? "s" : ""}`,
  );
  return popup;
}

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

export default function ChannelsMap() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const mapRef = useRef<HTMLDivElement>(null);
  const [statusText, setStatusText] = useState(() => t("networkChannels.loadingChannels"));
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    setStatusText(t("networkChannels.loadingChannels"));
    setError(null);
    let cancelled = false;
    let mapInstance: L.Map | null = null;

    async function init() {
      // 1. Fetch channels
      let channels: NetworkChannel[];
      try {
        channels = await getAllChannels();
      } catch {
        if (!cancelled) setError(t("networkChannels.fetchError"));
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

      // 3. Init map
      setStatusText(t("networkChannels.loadingMap"));
      if (cancelled || !mapRef.current) return;
      const map = L.map(mapRef.current).setView([20, 0], 2);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors',
      }).addTo(map);
      mapInstance = map;

      if (uniqueIPs.length === 0) {
        setStatusText(t("networkChannels.noPublicIPs"));
        return;
      }

      // 4. Geolocate IPs via the configured ip-api compatible batch endpoint (opt-in, https only)
      const url = geoipUrl();
      if (!url) {
        setStatusText("");
        setError(t("networkChannels.geolocationNotConfigured"));
        return;
      }
      setStatusText(t("networkChannels.geolocatingIPs", { count: uniqueIPs.length }));
      let geoResults: (GeoLocation | null)[];
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(uniqueIPs.map((ip) => ({ query: ip }))),
        });
        if (!res.ok) throw new Error(`Geolocation answered ${res.status}`);
        const data = await res.json();
        geoResults = (data as any[]).map((d) =>
          d.status === "success"
            ? { ip: d.query, lat: d.lat, lon: d.lon, city: d.city, country: d.country }
            : null
        );
      } catch {
        if (!cancelled) {
          setStatusText("");
          setError(t("networkChannels.geolocationFailed"));
        }
        return;
      }

      if (cancelled) return;

      // 5. Add markers
      geoResults.forEach((geo) => {
        if (!geo) return;
        L.marker([geo.lat, geo.lon])
          .addTo(map)
          .bindPopup(buildPopup(geo, ipCount[geo.ip]));
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
          <ArrowLeft className="w-4 h-4 mr-1" /> {t("networkChannels.backButton")}
        </Button>
        <Button variant="outline" size="sm" onClick={() => setReloadKey((k) => k + 1)} disabled={!!statusText && !error} aria-label={t("common.refresh")} title={t("common.refresh")}>
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
