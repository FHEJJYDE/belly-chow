import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix default marker icons
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const riderIcon = new L.Icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  className: 'hue-rotate-[200deg]',
});

const customerIcon = new L.Icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  className: 'hue-rotate-[120deg]',
});

interface DeliveryMapProps {
  riderLat?: number | null;
  riderLng?: number | null;
  customerLat?: number | null;
  customerLng?: number | null;
  className?: string;
}

const DeliveryMap = ({ riderLat, riderLng, customerLat, customerLng, className = '' }: DeliveryMapProps) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const riderMarkerRef = useRef<L.Marker | null>(null);
  const customerMarkerRef = useRef<L.Marker | null>(null);
  const routeLineRef = useRef<L.Polyline | null>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const defaultCenter: L.LatLngExpression = [6.5244, 3.3792]; // Lagos default
    mapInstanceRef.current = L.map(mapRef.current).setView(defaultCenter, 14);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
    }).addTo(mapInstanceRef.current);

    return () => {
      mapInstanceRef.current?.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Update rider marker
    if (riderLat && riderLng) {
      if (riderMarkerRef.current) {
        riderMarkerRef.current.setLatLng([riderLat, riderLng]);
      } else {
        riderMarkerRef.current = L.marker([riderLat, riderLng], { icon: riderIcon })
          .addTo(map)
          .bindPopup('🏍️ You (Rider)');
      }
    }

    // Update customer marker
    if (customerLat && customerLng) {
      if (customerMarkerRef.current) {
        customerMarkerRef.current.setLatLng([customerLat, customerLng]);
      } else {
        customerMarkerRef.current = L.marker([customerLat, customerLng], { icon: customerIcon })
          .addTo(map)
          .bindPopup('📍 Customer');
      }
    }

    // Draw route line
    if (riderLat && riderLng && customerLat && customerLng) {
      if (routeLineRef.current) {
        routeLineRef.current.setLatLngs([[riderLat, riderLng], [customerLat, customerLng]]);
      } else {
        routeLineRef.current = L.polyline(
          [[riderLat, riderLng], [customerLat, customerLng]],
          { color: 'hsl(var(--primary))', weight: 3, dashArray: '10, 10' }
        ).addTo(map);
      }
    }

    // Fit bounds
    const bounds: L.LatLngExpression[] = [];
    if (riderLat && riderLng) bounds.push([riderLat, riderLng]);
    if (customerLat && customerLng) bounds.push([customerLat, customerLng]);
    if (bounds.length > 0) {
      map.fitBounds(L.latLngBounds(bounds), { padding: [50, 50], maxZoom: 16 });
    }
  }, [riderLat, riderLng, customerLat, customerLng]);

  return <div ref={mapRef} className={`h-[300px] w-full rounded-lg ${className}`} />;
};

export default DeliveryMap;
