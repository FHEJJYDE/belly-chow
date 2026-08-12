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

// ── Custom SVG marker factory ────────────────────────────────────────────────
function makeSvgIcon(emoji: string, bgColor: string): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `
      <div style="
        display:flex; align-items:center; justify-content:center;
        width:40px; height:40px; border-radius:50%;
        background:${bgColor}; border:3px solid #fff;
        box-shadow:0 2px 8px rgba(0,0,0,0.35);
        font-size:20px; line-height:1;
      ">${emoji}</div>
      <div style="
        width:0; height:0; margin:-1px auto 0;
        border-left:8px solid transparent;
        border-right:8px solid transparent;
        border-top:10px solid ${bgColor};
      "></div>`,
    iconSize: [40, 50],
    iconAnchor: [20, 50],
    popupAnchor: [0, -52],
  });
}

const riderIcon = makeSvgIcon('🏍️', '#f97316');   // orange
const customerIcon = makeSvgIcon('📍', '#3b82f6'); // blue
const vendorIcon = makeSvgIcon('🏪', '#8b5cf6');   // purple

const lightTiles = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
const darkTiles = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';

// ── Component ────────────────────────────────────────────────────────────────

export interface DeliveryMapProps {
  riderLat?: number | null;
  riderLng?: number | null;
  customerLat?: number | null;
  customerLng?: number | null;
  vendorLat?: number | null;
  vendorLng?: number | null;
  /** Label shown in rider marker popup */
  riderLabel?: string;
  /** Label shown in customer marker popup */
  customerLabel?: string;
  /** Label shown in vendor marker popup */
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
  riderLabel = 'Rider 🏍️',
  customerLabel = 'Your location 📍',
  vendorLabel = 'Vendor 🏪',
  className = '',
  height = '320px',
}: DeliveryMapProps) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const riderMarkerRef = useRef<L.Marker | null>(null);
  const customerMarkerRef = useRef<L.Marker | null>(null);
  const vendorMarkerRef = useRef<L.Marker | null>(null);
  const routeLineRef = useRef<L.Polyline | null>(null);

  const [routeCoords, setRouteCoords] = useState<L.LatLngExpression[] | null>(null);

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
      map.fitBounds(L.latLngBounds(pts as L.LatLngTuple[]), { padding: [60, 60], maxZoom: 17 });
    }
  }, [riderLat, riderLng, customerLat, customerLng, vendorLat, vendorLng]);

  // ── OSRM Routing Fetch Effect ──────────────────────────────────────────────
  useEffect(() => {
    let active = true;
    const startLat = riderLat ?? vendorLat;
    const startLng = riderLng ?? vendorLng;

    if (!startLat || !startLng || !customerLat || !customerLng) {
      setRouteCoords(null);
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
          const coords = data.routes[0].geometry.coordinates.map(([lng, lat]: [number, number]) => [lat, lng]);
          setRouteCoords(coords);
        } else if (active) {
          setRouteCoords([[startLat, startLng], [customerLat, customerLng]]);
        }
      } catch (err) {
        console.warn('OSRM routing failed, falling back to straight line:', err);
        if (active) {
          setRouteCoords([[startLat, startLng], [customerLat, customerLng]]);
        }
      }
    };

    getRoute();
    return () => { active = false; };
  }, [riderLat, riderLng, vendorLat, vendorLng, customerLat, customerLng]);

  // ── Initialise map once ────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const defaultCenter: L.LatLngExpression = [6.5244, 3.3792]; // Lagos fallback
    const isInitialDark = document.documentElement.classList.contains('dark');
    const initialTiles = isInitialDark ? darkTiles : lightTiles;

    const map = L.map(mapRef.current, { zoomControl: false }).setView(defaultCenter, 14);
    mapInstanceRef.current = map;

    const tileLayer = L.tileLayer(initialTiles, {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);
    tileLayerRef.current = tileLayer;

    // Native zoom control — bottom-right
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // ── Re-centre button ─────────────────────────────────────────────────────
    const RecenterControl = L.Control.extend({
      onAdd() {
        const btn = L.DomUtil.create('button');
        btn.innerHTML = '⊕';
        btn.title = 'Re-centre map';
        btn.style.cssText = `
          width:34px; height:34px; background:#fff; border:2px solid rgba(0,0,0,.2);
          border-radius:4px; cursor:pointer; font-size:20px; line-height:1;
          display:flex; align-items:center; justify-content:center;
          color:#000;
        `;
        L.DomEvent.on(btn, 'click', (e) => {
          L.DomEvent.stopPropagation(e);
          fitBounds(map);
        });
        return btn;
      },
    });
    new RecenterControl({ position: 'bottomright' }).addTo(map);

    // ── Watch dark mode class updates ─────────────────────────────────────────
    const observer = new MutationObserver(() => {
      const isDark = document.documentElement.classList.contains('dark');
      const url = isDark ? darkTiles : lightTiles;
      if (tileLayerRef.current) {
        tileLayerRef.current.setUrl(url);
      }
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    return () => {
      observer.disconnect();
      map.remove();
      mapInstanceRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Update markers + route whenever coords change ─────────────────────────
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Rider marker
    if (riderLat && riderLng) {
      if (riderMarkerRef.current) {
        riderMarkerRef.current.setLatLng([riderLat, riderLng]);
      } else {
        riderMarkerRef.current = L.marker([riderLat, riderLng], { icon: riderIcon })
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
        customerMarkerRef.current = L.marker([customerLat, customerLng], { icon: customerIcon })
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
        vendorMarkerRef.current = L.marker([vendorLat, vendorLng], { icon: vendorIcon })
          .addTo(map)
          .bindPopup(vendorLabel);
      }
    } else if (vendorMarkerRef.current) {
      vendorMarkerRef.current.remove();
      vendorMarkerRef.current = null;
    }

    // Route line
    if (routeCoords && routeCoords.length > 0) {
      if (routeLineRef.current) {
        routeLineRef.current.setLatLngs(routeCoords);
      } else {
        routeLineRef.current = L.polyline(routeCoords, {
          color: '#f97316',
          weight: 4,
          opacity: 0.85,
        }).addTo(map);
      }
    } else if (routeLineRef.current) {
      routeLineRef.current.remove();
      routeLineRef.current = null;
    }

    // Auto-fit bounds when coords update
    fitBounds(map);
  }, [riderLat, riderLng, customerLat, customerLng, vendorLat, vendorLng, riderLabel, customerLabel, vendorLabel, routeCoords, fitBounds]);

  return (
    <div className={`relative w-full rounded-xl overflow-hidden shadow-md ${className}`} style={{ height }}>
      <div ref={mapRef} className="h-full w-full" />
      {/* Legend */}
      <div className="absolute bottom-10 left-2 z-[1000] flex flex-col gap-1 rounded-lg bg-background/90 backdrop-blur-sm px-2 py-1.5 text-xs shadow border border-border">
        {vendorLat && vendorLng && (
          <span className="flex items-center gap-1"><span>🏪</span> {vendorLabel}</span>
        )}
        {riderLat && riderLng && (
          <span className="flex items-center gap-1"><span>🏍️</span> {riderLabel}</span>
        )}
        {customerLat && customerLng && (
          <span className="flex items-center gap-1"><span>📍</span> {customerLabel}</span>
        )}
      </div>
    </div>
  );
};

export default DeliveryMap;
