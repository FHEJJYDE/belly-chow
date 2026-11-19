import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CampusLocationItem {
  id: string;
  name: string;
  category: string;
  description: string | null;
  short_code?: string | null;
  aliases?: string[] | null;
  zone_name?: string | null;
  delivery_fee?: number | null;
  estimated_delivery_mins?: number | null;
  dropoff_points?: string[] | null;
  is_popular: boolean;
  is_active: boolean;
  display_order?: number | null;
  lat: number | null;
  lng: number | null;
}

export interface DeliveryZoneItem {
  id: string;
  zone_name: string;
  delivery_fee: number;
  rider_fee: number;
  is_active: boolean;
}

export interface SavedCampusSpot {
  id: 'hostel' | 'faculty' | 'study';
  label: string;
  locationName: string;
  dropoffPoint?: string;
  roomNumber?: string;
  deliveryFee?: number;
  estimatedMins?: number;
  lat?: number | null;
  lng?: number | null;
}

export const DELIVERY_INSTRUCTION_PRESETS = [
  "Meet at Porter's Lodge / Main Gate",
  'Call me when arriving at the gate',
  'Leave with Porter / Security desk',
  'Meet at building entrance / lobby',
  'Do not knock — call my phone',
];

export const DEFAULT_DROPOFF_BY_CATEGORY: Record<string, string[]> = {
  Hostel: ["Porter's Lodge (Main Gate)", 'Block A Entrance', 'Block B Entrance', 'Common Room / Buttery'],
  Faculty: ['Main Lecture Theatre', 'Faculty Car Park', "Dean's Office Entrance", 'Departmental Lobby'],
  Library: ['Front Steps / Main Entrance', 'Library Car Park', 'Reading Hall Annex'],
  Landmark: ['Main Plaza / Front Entrance', 'Arcade / Walkway', 'Car Park'],
  Gate: ['Pedestrian Turnstile', 'Campus Cab Park', 'Security Post'],
  Commercial: ['Front Complex Gate', 'Street / Lodge Entrance', 'Main Junction'],
};

const LOCATIONS_CACHE_KEY = 'belly_chow_campus_locations_live_v3';
const ZONES_CACHE_KEY = 'belly_chow_delivery_zones_live_v1';

/** Haversine distance in meters between two GPS coordinates */
export function getDistanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371e3; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/** Finds the nearest campus landmark to given coordinates */
export function findNearestCampusLocation(
  lat: number,
  lng: number,
  locations: CampusLocationItem[]
): { location: CampusLocationItem; distanceMeters: number } | null {
  let nearest: CampusLocationItem | null = null;
  let minDistance = Infinity;

  for (const loc of locations) {
    if (loc.lat != null && loc.lng != null) {
      const dist = getDistanceMeters(lat, lng, Number(loc.lat), Number(loc.lng));
      if (dist < minDistance) {
        minDistance = dist;
        nearest = loc;
      }
    }
  }

  return nearest ? { location: nearest, distanceMeters: minDistance } : null;
}

/** Smart fuzzy/alias search for campus locations (matches student-added slang & location names) */
export function filterCampusLocations(
  locations: CampusLocationItem[],
  query: string,
  category: string = 'all'
): CampusLocationItem[] {
  const q = query.toLowerCase().trim();

  return locations
    .filter((loc) => {
      if (category !== 'all' && loc.category.toLowerCase() !== category.toLowerCase()) {
        return false;
      }
      if (!q) return true;

      const nameMatch = loc.name.toLowerCase().includes(q);
      const codeMatch = loc.short_code?.toLowerCase().includes(q);
      const descMatch = loc.description?.toLowerCase().includes(q);
      const catMatch = loc.category.toLowerCase().includes(q);
      const aliasMatch = Array.isArray(loc.aliases)
        ? loc.aliases.some((a) => a.toLowerCase().includes(q))
        : false;
      const dropoffMatch = Array.isArray(loc.dropoff_points)
        ? loc.dropoff_points.some((d) => d.toLowerCase().includes(q))
        : false;

      return Boolean(nameMatch || codeMatch || aliasMatch || descMatch || catMatch || dropoffMatch);
    })
    .sort((a, b) => {
      if (!q) return 0;
      const aCodeExact =
        a.short_code?.toLowerCase() === q ||
        a.aliases?.some((al) => al.toLowerCase() === q);
      const bCodeExact =
        b.short_code?.toLowerCase() === q ||
        b.aliases?.some((al) => al.toLowerCase() === q);
      if (aCodeExact && !bCodeExact) return -1;
      if (!aCodeExact && bCodeExact) return 1;
      return 0;
    });
}

/**
 * Live DB-driven hook for campus locations & admin-configured delivery zones.
 * No hardcoded mock campus data — reads strictly from Supabase + caches in React Query for 10,000+ user concurrency.
 */
export function useCampusLocations() {
  const queryClient = useQueryClient();

  const locationsQuery = useQuery({
    queryKey: ['campus_locations_active'],
    queryFn: async (): Promise<CampusLocationItem[]> => {
      const { data, error } = await supabase
        .from('campus_locations')
        .select('*')
        .eq('is_active', true)
        .order('is_popular', { ascending: false })
        .order('name', { ascending: true });

      if (error || !data) {
        return [];
      }

      const formatted: CampusLocationItem[] = data.map((row: any) => ({
        ...row,
        short_code: row.short_code || null,
        aliases: Array.isArray(row.aliases) ? row.aliases : [],
        zone_name: row.zone_name || null,
        delivery_fee: row.delivery_fee != null ? Number(row.delivery_fee) : null,
        estimated_delivery_mins:
          row.estimated_delivery_mins != null ? Number(row.estimated_delivery_mins) : 15,
        dropoff_points:
          Array.isArray(row.dropoff_points) && row.dropoff_points.length > 0
            ? row.dropoff_points
            : DEFAULT_DROPOFF_BY_CATEGORY[row.category] || DEFAULT_DROPOFF_BY_CATEGORY.Hostel,
        lat: row.lat != null ? Number(row.lat) : null,
        lng: row.lng != null ? Number(row.lng) : null,
      }));

      try {
        localStorage.setItem(LOCATIONS_CACHE_KEY, JSON.stringify(formatted));
      } catch {
        /* ignore quota errors */
      }

      return formatted;
    },
    initialData: () => {
      try {
        const raw = localStorage.getItem(LOCATIONS_CACHE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) return parsed;
        }
      } catch {
        /* ignore */
      }
      return undefined;
    },
    staleTime: 1000 * 60 * 15,
    gcTime: 1000 * 60 * 60,
  });

  const zonesQuery = useQuery({
    queryKey: ['delivery_zones_active'],
    queryFn: async (): Promise<DeliveryZoneItem[]> => {
      const { data, error } = await (supabase.from as any)('delivery_zones')
        .select('*')
        .eq('is_active', true)
        .order('delivery_fee', { ascending: true });

      if (error || !data) return [];

      const formatted: DeliveryZoneItem[] = data.map((z: any) => ({
        id: z.id,
        zone_name: z.zone_name,
        delivery_fee: Number(z.delivery_fee) || 500,
        rider_fee: Number(z.rider_fee ?? z.delivery_fee) || 500,
        is_active: Boolean(z.is_active),
      }));

      try {
        localStorage.setItem(ZONES_CACHE_KEY, JSON.stringify(formatted));
      } catch {
        /* ignore */
      }

      return formatted;
    },
    initialData: () => {
      try {
        const raw = localStorage.getItem(ZONES_CACHE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) return parsed;
        }
      } catch {
        /* ignore */
      }
      return undefined;
    },
    staleTime: 1000 * 60 * 15,
  });

  const invalidateLocations = () => {
    localStorage.removeItem(LOCATIONS_CACHE_KEY);
    localStorage.removeItem(ZONES_CACHE_KEY);
    queryClient.invalidateQueries({ queryKey: ['campus_locations_active'] });
    queryClient.invalidateQueries({ queryKey: ['delivery_zones_active'] });
  };

  /** Allows any logged-in student to add a campus slang/nickname tag to a location */
  const addStudentSlang = async (locationId: string, slang: string): Promise<string[]> => {
    const clean = slang.trim();
    if (!clean) throw new Error('Please enter a valid slang or nickname');

    // First try the dedicated SECURITY DEFINER RPC
    const { data: rpcAliases, error: rpcError } = await (supabase.rpc as any)('add_location_slang', {
      p_location_id: locationId,
      p_slang: clean,
    });

    if (!rpcError && Array.isArray(rpcAliases)) {
      invalidateLocations();
      return rpcAliases;
    }

    // Fallback if the admin hasn't run the RPC SQL yet: update aliases array directly
    const current = (locationsQuery.data || []).find((l) => l.id === locationId);
    const existing = Array.isArray(current?.aliases) ? current!.aliases! : [];
    if (existing.some((a) => a.toLowerCase() === clean.toLowerCase())) {
      return existing;
    }
    const updated = [...existing, clean];
    const { error: updateErr } = await supabase
      .from('campus_locations')
      .update({ aliases: updated, updated_at: new Date().toISOString() } as any)
      .eq('id', locationId);

    if (updateErr) throw new Error(rpcError?.message || updateErr.message);
    invalidateLocations();
    return updated;
  };

  return {
    locations: locationsQuery.data || [],
    zones: zonesQuery.data || [],
    loading: locationsQuery.isLoading,
    invalidateLocations,
    addStudentSlang,
  };
}
