import { useEffect, useRef, useCallback, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix default marker icons for bundlers
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

// ── Custom Font Awesome 3D Vector Marker Factory ─────────────────────────────
function makeVectorMarker(faIconClass: string, bgColor: string, pulseColor: string, badgeLabel?: string): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `
      <div style="position:relative; width:42px; height:52px; display:flex; flex-direction:column; align-items:center;">
        ${
          badgeLabel
            ? `<div style="
                position:absolute; top:-22px; left:50%; transform:translateX(-50%);
                background:rgba(15,23,42,0.92); color:#fff; font-size:10px; font-weight:700;
                padding:2px 7px; border-radius:999px; white-space:nowrap;
                box-shadow:0 2px 6px rgba(0,0,0,0.25); border:1px solid rgba(255,255,255,0.2);
                letter-spacing:0.01em; pointer-events:none;
              ">${badgeLabel}</div>`
            : ''
        }
        <div style="position:relative; width:38px; height:38px; display:flex; align-items:center; justify-content:center;">
          <span class="bc-marker-pulse" style="background:${pulseColor};"></span>
          <div style="
            position:relative; z-index:2;
            display:flex; align-items:center; justify-content:center;
            width:38px; height:38px; border-radius:50%;
            background:${bgColor}; border:2.5px solid #ffffff;
            box-shadow:0 6px 16px -2px rgba(15,23,42,0.35);
            color:#ffffff; font-size:15px;
          ">
            <i class="${faIconClass}"></i>
          </div>
        </div>
        <div style="
          position:relative; z-index:1;
          width:0; height:0; margin-top:-2px;
          border-left:7px solid transparent;
          border-right:7px solid transparent;
          border-top:9px solid ${bgColor};
          filter:drop-shadow(0 2px 2px rgba(0,0,0,0.2));
        "></div>
      </div>`,
    iconSize: [42, 52],
    iconAnchor: [21, 50],
    popupAnchor: [0, -52],
  });
}

const riderIcon = makeVectorMarker('fa-solid fa-motorcycle', '#f97316', 'rgba(249,115,22,0.45)', 'Rider');
const customerIcon = makeVectorMarker('fa-solid fa-location-dot', '#2563eb', 'rgba(37,99,235,0.38)', 'Drop-off');
const vendorIcon = makeVectorMarker('fa-solid fa-store', '#0f172a', 'rgba(15,23,42,0.22)', 'Kitchen');

const osmTiles = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

export interface DeliveryMapProps {
  riderLat?: number | null;
  riderLng?: number | null;
  customerLat?: number | null;
  customerLng?: number | null;
  vendorLat?: number | null;
  vendorLng?: number | null;
  riderLabel?: string;
  customerLabel?: string;
  vendorLabel?: string;
  className?: string;
  height?: string;
}

const DeliveryMap = ({
  riderLat,
  riderLng,
  customerLat,
  customerLng,
  vendorLat,
  vendorLng,
  riderLabel = 'Dispatch Rider',
  customerLabel = 'Delivery Point',
  vendorLabel = 'Vendor Kitchen',
  className = '',
  height = '320px',
}: DeliveryMapProps) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const riderMarkerRef = useRef<L.Marker | null>(null);
  const customerMarkerRef = useRef<L.Marker | null>(null);
  const vendorMarkerRef = useRef<L.Marker | null>(null);
  const routeCasingRef = useRef<L.Polyline | null>(null);
  const routeLineRef = useRef<L.Polyline | null>(null);

  const [routeCoords, setRouteCoords] = useState<L.LatLngExpression[] | null>(null);
  const [routeStats, setRouteStats] = useState<{ distanceKm: number; durationMins: number } | null>(null);

  // Haversine fallback distance
  const computeStraightDistanceKm = useCallback((lat1: number, lng1: number, lat2: number, lng2: number) => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }, []);

  // ── Fit bounds helper ──────────────────────────────────────────────────────
  const fitBounds = useCallback((map: L.Map) => {
    const pts: L.LatLngExpression[] = [];
    if (riderLat && riderLng) pts.push([riderLat, riderLng]);
    if (customerLat && customerLng) pts.push([customerLat, customerLng]);
    if (vendorLat && vendorLng) pts.push([vendorLat, vendorLng]);
    if (pts.length === 0) return;
    if (pts.length === 1) {
      map.setView(pts[0] as L.LatLngExpression, 16);
    } else {
      map.fitBounds(L.latLngBounds(pts as L.LatLngTuple[]), { padding: [56, 56], maxZoom: 17 });
    }
  }, [riderLat, riderLng, customerLat, customerLng, vendorLat, vendorLng]);

  // ── OSRM Street Routing & Live Distance/ETA ────────────────────────────────
  useEffect(() => {
    let active = true;
    const startLat = riderLat ?? vendorLat;
    const startLng = riderLng ?? vendorLng;

    if (!startLat || !startLng || !customerLat || !customerLng) {
      setRouteCoords(null);
      setRouteStats(null);
      return;
    }

    const getRoute = async () => {
      try {
        const res = await fetch(
          `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${customerLng},${customerLat}?overview=full&geometries=geojson`
        );
        if (!res.ok) throw new Error('OSRM route network error');
        const data = await res.json();
        if (active && data.routes && data.routes[0]) {
          const r = data.routes[0];
          const coords = r.geometry.coordinates.map(([lng, lat]: [number, number]) => [lat, lng]);
          setRouteCoords(coords);
          const distKm = Number((r.distance / 1000).toFixed(2));
          const mins = Math.max(1, Math.round(r.duration / 60));
          setRouteStats({ distanceKm: distKm, durationMins: mins });
        } else if (active) {
          setRouteCoords([[startLat, startLng], [customerLat, customerLng]]);
          const d = computeStraightDistanceKm(startLat, startLng, customerLat, customerLng);
          setRouteStats({ distanceKm: Number(d.toFixed(2)), durationMins: Math.max(2, Math.round(d * 3)) });
        }
      } catch {
        if (active) {
          setRouteCoords([[startLat, startLng], [customerLat, customerLng]]);
          const d = computeStraightDistanceKm(startLat, startLng, customerLat, customerLng);
          setRouteStats({ distanceKm: Number(d.toFixed(2)), durationMins: Math.max(2, Math.round(d * 3)) });
        }
      }
    };

    getRoute();
    return () => { active = false; };
  }, [riderLat, riderLng, vendorLat, vendorLng, customerLat, customerLng, computeStraightDistanceKm]);

  // ── Initialise map once ────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const defaultCenter: L.LatLngExpression = [6.5244, 3.3792];

    const map = L.map(mapRef.current, {
      zoomControl: false,
      attributionControl: false,
    }).setView(defaultCenter, 15);
    mapInstanceRef.current = map;

    L.tileLayer(osmTiles, {
      maxZoom: 19,
      className: 'bc-clean-tiles',
    }).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // ── Update markers + dual-casing route line whenever coords change ─────────
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Rider marker
    if (riderLat && riderLng) {
      if (riderMarkerRef.current) {
        riderMarkerRef.current.setLatLng([riderLat, riderLng]);
      } else {
        riderMarkerRef.current = L.marker([riderLat, riderLng], { icon: riderIcon, zIndexOffset: 300 })
          .addTo(map)
          .bindPopup(riderLabel);
      }
    } else if (riderMarkerRef.current) {
      riderMarkerRef.current.remove();
      riderMarkerRef.current = null;
    }

    // Customer marker
    if (customerLat && customerLng) {
      if (customerMarkerRef.current) {
        customerMarkerRef.current.setLatLng([customerLat, customerLng]);
      } else {
        customerMarkerRef.current = L.marker([customerLat, customerLng], { icon: customerIcon, zIndexOffset: 200 })
          .addTo(map)
          .bindPopup(customerLabel);
      }
    } else if (customerMarkerRef.current) {
      customerMarkerRef.current.remove();
      customerMarkerRef.current = null;
    }

    // Vendor marker
    if (vendorLat && vendorLng) {
      if (vendorMarkerRef.current) {
        vendorMarkerRef.current.setLatLng([vendorLat, vendorLng]);
      } else {
        vendorMarkerRef.current = L.marker([vendorLat, vendorLng], { icon: vendorIcon, zIndexOffset: 100 })
          .addTo(map)
          .bindPopup(vendorLabel);
      }
    } else if (vendorMarkerRef.current) {
      vendorMarkerRef.current.remove();
      vendorMarkerRef.current = null;
    }

    // Dual-layer Route Polyline (outer dark halo + bright orange inner vector route)
    if (routeCoords && routeCoords.length > 0) {
      if (routeCasingRef.current) {
        routeCasingRef.current.setLatLngs(routeCoords);
      } else {
        routeCasingRef.current = L.polyline(routeCoords, {
          color: '#0f172a',
          weight: 7,
          opacity: 0.25,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(map);
      }

      if (routeLineRef.current) {
        routeLineRef.current.setLatLngs(routeCoords);
      } else {
        routeLineRef.current = L.polyline(routeCoords, {
          color: '#f97316',
          weight: 4.5,
          opacity: 0.95,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(map);
      }
    } else {
      if (routeCasingRef.current) {
        routeCasingRef.current.remove();
        routeCasingRef.current = null;
      }
      if (routeLineRef.current) {
        routeLineRef.current.remove();
        routeLineRef.current = null;
      }
    }

    fitBounds(map);
  }, [riderLat, riderLng, customerLat, customerLng, vendorLat, vendorLng, riderLabel, customerLabel, vendorLabel, routeCoords, fitBounds]);

  return (
    <div className={`relative w-full rounded-2xl overflow-hidden border border-border/70 bg-slate-100 dark:bg-slate-900 shadow-sm ${className}`} style={{ height }}>
      <div ref={mapRef} className="h-full w-full" />

      {/* Top-Left Live Distance & ETA Telemetry Pill */}
      {routeStats && (
        <div className="pointer-events-none absolute top-3 left-3 z-[1000] flex items-center gap-2 rounded-xl bg-slate-900/90 text-white backdrop-blur-md px-3 py-1.5 text-xs font-semibold shadow-lg border border-white/15">
          <i className="fa-solid fa-route text-orange-400 text-[11px]" />
          <span>
            {routeStats.distanceKm < 1
              ? `${Math.round(routeStats.distanceKm * 1000)}m`
              : `${routeStats.distanceKm} km`}
          </span>
          <span className="text-white/40">•</span>
          <span className="text-orange-300">~{routeStats.durationMins} min drive</span>
        </div>
      )}

      {/* Bottom-Left Sleek Glassmorphic Legend Pill */}
      <div className="pointer-events-none absolute bottom-3 left-3 z-[1000] flex flex-wrap items-center gap-2.5 rounded-xl bg-card/95 backdrop-blur-md px-3 py-1.5 text-[11px] font-medium shadow-md border border-border/80">
        {vendorLat && vendorLng && (
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-slate-900 dark:bg-slate-200 inline-block" />
            <span>{vendorLabel.replace(/[^\w\s&'-]/g, '').trim() || 'Kitchen'}</span>
          </span>
        )}
        {riderLat && riderLng && (
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-orange-500 inline-block animate-pulse" />
            <span>{riderLabel.replace(/[^\w\s&'-]/g, '').trim() || 'Rider'}</span>
          </span>
        )}
        {customerLat && customerLng && (
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-blue-600 inline-block" />
            <span>{customerLabel.replace(/[^\w\s&'-]/g, '').trim() || 'Drop-off'}</span>
          </span>
        )}
      </div>

      {/* Top-Right Recenter Button */}
      <button
        type="button"
        onClick={() => mapInstanceRef.current && fitBounds(mapInstanceRef.current)}
        title="Re-center map on route"
        className="absolute bottom-24 right-2.5 z-[1000] flex h-[34px] w-[34px] items-center justify-center rounded-xl bg-white/95 text-slate-900 shadow-md border border-slate-900/10 hover:bg-slate-50 hover:text-primary transition-colors"
      >
        <i className="fa-solid fa-location-crosshairs text-xs" />
      </button>
    </div>
  );
};

export default DeliveryMap;
