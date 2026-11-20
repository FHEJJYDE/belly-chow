import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { CampusLocationItem, findNearestCampusLocation } from '@/hooks/useCampusLocations';

interface CampusPinMapProps {
  lat: number;
  lng: number;
  locations: CampusLocationItem[];
  onPinMove: (lat: number, lng: number, nearest?: { location: CampusLocationItem; distanceMeters: number } | null) => void;
  height?: string;
}

const mainPinIcon = L.divIcon({
  className: '',
  html: `
    <div style="position:relative; width:44px; height:54px; display:flex; flex-direction:column; align-items:center; cursor:grab;">
      <div style="position:relative; width:40px; height:40px; display:flex; align-items:center; justify-content:center;">
        <span class="bc-marker-pulse" style="background:rgba(249,115,22,0.45);"></span>
        <div style="
          position:relative; z-index:2;
          display:flex; align-items:center; justify-content:center;
          width:40px; height:40px; border-radius:50%;
          background:#f97316; border:3px solid #fff;
          box-shadow:0 6px 16px rgba(249,115,22,0.5);
          color:#fff; font-size:16px;
        ">
          <i class="fa-solid fa-location-dot"></i>
        </div>
      </div>
      <div style="
        width:0; height:0; margin-top:-2px;
        border-left:7px solid transparent;
        border-right:7px solid transparent;
        border-top:10px solid #f97316;
      "></div>
    </div>`,
  iconSize: [44, 54],
  iconAnchor: [22, 52],
});

const landmarkDotIcon = (label: string) =>
  L.divIcon({
    className: '',
    html: `
      <div style="
        display:inline-flex; align-items:center; gap:5px;
        background:rgba(15,23,42,0.92); color:#fff;
        padding:3px 8px; border-radius:999px;
        font-size:10px; font-weight:600; white-space:nowrap;
        border:1.5px solid rgba(255,255,255,0.8);
        box-shadow:0 2px 8px rgba(0,0,0,0.3);
      ">
        <i class="fa-solid fa-building text-[9px] text-amber-400"></i>
        <span>${label}</span>
      </div>`,
    iconSize: [96, 24],
    iconAnchor: [48, 12],
  });

export const CampusPinMap: React.FC<CampusPinMapProps> = ({
  lat,
  lng,
  locations,
  onPinMove,
  height = '240px',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const baseTileGroupRef = useRef<L.LayerGroup | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const landmarkGroupRef = useRef<L.LayerGroup | null>(null);
  const [mapMode, setMapMode] = useState<'streets' | 'satellite'>('streets');

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: false,
    }).setView([lat, lng], 17);

    mapRef.current = map;

    const tileGroup = L.layerGroup().addTo(map);
    baseTileGroupRef.current = tileGroup;

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    const marker = L.marker([lat, lng], {
      icon: mainPinIcon,
      draggable: true,
      zIndexOffset: 300,
    }).addTo(map);

    markerRef.current = marker;

    const handleCoordsChange = (newLat: number, newLng: number) => {
      const nearest = findNearestCampusLocation(newLat, newLng, locations);
      onPinMove(newLat, newLng, nearest);
    };

    marker.on('dragend', () => {
      const pos = marker.getLatLng();
      map.panTo(pos);
      handleCoordsChange(pos.lat, pos.lng);
    });

    map.on('click', (e: L.LeafletMouseEvent) => {
      marker.setLatLng(e.latlng);
      map.panTo(e.latlng);
      handleCoordsChange(e.latlng.lat, e.latlng.lng);
    });

    const group = L.layerGroup().addTo(map);
    landmarkGroupRef.current = group;

    locations.forEach((loc) => {
      if (loc.lat != null && loc.lng != null) {
        const tag = loc.short_code || loc.name.split('(')[0].trim();
        const lm = L.marker([Number(loc.lat), Number(loc.lng)], {
          icon: landmarkDotIcon(tag),
        });
        lm.on('click', () => {
          const target = L.latLng(Number(loc.lat), Number(loc.lng));
          marker.setLatLng(target);
          map.panTo(target);
          onPinMove(target.lat, target.lng, { location: loc, distanceMeters: 0 });
        });
        lm.addTo(group);
      }
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Switch between Google Maps Streets and Google Maps Hybrid Satellite (up to Zoom 21)
  useEffect(() => {
    const tileGroup = baseTileGroupRef.current;
    if (!tileGroup) return;
    tileGroup.clearLayers();

    if (mapMode === 'streets') {
      L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
        maxZoom: 21,
      }).addTo(tileGroup);
    } else {
      L.tileLayer('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
        maxZoom: 21,
      }).addTo(tileGroup);
    }
  }, [mapMode]);

  // Update marker position if parent changes lat/lng externally
  useEffect(() => {
    if (mapRef.current && markerRef.current && lat && lng) {
      const curr = markerRef.current.getLatLng();
      if (Math.abs(curr.lat - lat) > 0.00005 || Math.abs(curr.lng - lng) > 0.00005) {
        markerRef.current.setLatLng([lat, lng]);
        mapRef.current.setView([lat, lng], 17);
      }
    }
  }, [lat, lng]);

  return (
    <div className="relative w-full rounded-2xl overflow-hidden border border-border/80 bg-slate-100 dark:bg-slate-900 shadow-inner" style={{ height }}>
      <div ref={containerRef} className="h-full w-full" />
      <div className=" absolute top-2.5 left-2.5 right-2.5 z-[1000] flex items-center justify-between gap-2 pointer-events-none">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-card/95 backdrop-blur-md px-3 py-1 text-[11px] font-semibold text-foreground shadow border border-border/80">
          <i className="fa-solid fa-hand-pointer text-primary text-[10px]" />
          <span>Drag pin to your exact building or tap a badge</span>
        </span>

        {/* Google Map vs Google Satellite Switcher */}
        <div className="pointer-events-auto flex items-center gap-1 rounded-xl bg-slate-900/90 p-1 text-white shadow-md">
          <button
            type="button"
            onClick={() => setMapMode('streets')}
            className={`rounded-lg px-2 py-0.5 text-[10px] font-semibold transition-all ${
              mapMode === 'streets' ? 'bg-primary text-white' : 'text-white/75 hover:text-white'
            }`}
          >
            Google Map
          </button>
          <button
            type="button"
            onClick={() => setMapMode('satellite')}
            className={`rounded-lg px-2 py-0.5 text-[10px] font-semibold transition-all ${
              mapMode === 'satellite' ? 'bg-primary text-white' : 'text-white/75 hover:text-white'
            }`}
          >
            Satellite
          </button>
        </div>
      </div>
    </div>
  );
};

export default CampusPinMap;
