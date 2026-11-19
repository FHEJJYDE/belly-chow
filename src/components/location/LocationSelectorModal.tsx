import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  MapPin,
  Search,
  Star,
  Building,
  School,
  BookOpen,
  Compass,
  Landmark,
  Check,
  ChevronDown,
  Plus,
  Sparkles,
  Navigation,
  Clock,
  Bookmark,
  DoorOpen,
  Map as MapIcon,
  Tag,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  useCampusLocations,
  CampusLocationItem,
  SavedCampusSpot,
  filterCampusLocations,
  findNearestCampusLocation,
  DEFAULT_DROPOFF_BY_CATEGORY,
} from '@/hooks/useCampusLocations';
import { useGeolocation } from '@/hooks/useGeolocation';
import CampusPinMap from './CampusPinMap';

export type CampusLocation = CampusLocationItem;

export interface LocationSelectionMeta {
  dropoffPoint?: string;
  roomNumber?: string;
  deliveryFee?: number;
  estimatedMins?: number;
  zoneName?: string;
  lat?: number | null;
  lng?: number | null;
}

interface LocationSelectorProps {
  currentLocation?: string;
  onLocationSelect?: (
    locationName: string,
    locationObj?: CampusLocation | null,
    meta?: LocationSelectionMeta
  ) => void;
  triggerButton?: React.ReactNode;
  className?: string;
}

const SAVED_SPOTS_STORAGE_KEY = 'belly_chow_saved_spots_v1';

const PRESET_SLOT_META: { id: SavedCampusSpot['id']; title: string; emoji: string }[] = [
  { id: 'hostel', title: 'My Hostel', emoji: '🛏️' },
  { id: 'faculty', title: 'My Dept / Class', emoji: '📚' },
  { id: 'study', title: 'Chill / Study Spot', emoji: '⚡' },
];

export const LocationSelectorModal: React.FC<LocationSelectorProps> = ({
  currentLocation,
  onLocationSelect,
  triggerButton,
  className,
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { locations, zones, addStudentSlang } = useCampusLocations();
  const { position: gpsPos, loading: gpsLoading, getPosition } = useGeolocation();

  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'list' | 'map'>('list');
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [customLocationInput, setCustomLocationInput] = useState('');
  const [customZoneName, setCustomZoneName] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);

  // Student-Contributed Slang State
  const [showSlangInput, setShowSlangInput] = useState(false);
  const [newSlangText, setNewSlangText] = useState('');
  const [addingSlang, setAddingSlang] = useState(false);

  // Selected Campus Building + Micro-Dropoff Config
  const [activeLocation, setActiveLocation] = useState<string>(() => {
    return currentLocation || localStorage.getItem('selected_campus_location') || 'Select Location';
  });
  const [selectedCampusObj, setSelectedCampusObj] = useState<CampusLocation | null>(null);
  const [selectedDropoff, setSelectedDropoff] = useState<string>(() => {
    return localStorage.getItem('selected_campus_dropoff') || '';
  });
  const [roomNumber, setRoomNumber] = useState<string>(() => {
    return localStorage.getItem('selected_campus_room') || '';
  });

  // Map Pin Coordinates
  const [pinCoords, setPinCoords] = useState<{ lat: number; lng: number }>({
    lat: 7.4441,
    lng: 3.8985,
  });
  const [snappedNearest, setSnappedNearest] = useState<{
    location: CampusLocation;
    distanceMeters: number;
  } | null>(null);

  // Saved Places (My Hostel, My Dept, Study Spot)
  const [savedSpots, setSavedSpots] = useState<SavedCampusSpot[]>(() => {
    try {
      const raw = localStorage.getItem(SAVED_SPOTS_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    if (currentLocation) {
      setActiveLocation(currentLocation);
    }
  }, [currentLocation]);

  useEffect(() => {
    if (zones.length > 0 && !customZoneName) {
      setCustomZoneName(zones[0].zone_name);
    }
  }, [zones, customZoneName]);

  // Match activeLocation string to a CampusLocation object from DB
  useEffect(() => {
    if (locations.length > 0 && activeLocation && activeLocation !== 'Select Location') {
      const baseName = activeLocation.split(' • ')[0].trim();
      const found = locations.find(
        (l) =>
          l.name.toLowerCase() === baseName.toLowerCase() ||
          activeLocation.toLowerCase().includes(l.name.toLowerCase())
      );
      if (found) {
        setSelectedCampusObj(found);
        if (found.lat && found.lng) {
          setPinCoords({ lat: Number(found.lat), lng: Number(found.lng) });
        }
      }
    }
  }, [locations, activeLocation]);

  // Load user's default location and saved places from profile
  useEffect(() => {
    if (!user) return;
    supabase
      .from('profiles')
      .select('default_location_name, campus_location, default_lat, default_lng, saved_locations')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        const d = data as any;
        if (!currentLocation && !localStorage.getItem('selected_campus_location')) {
          const loc = d.default_location_name || d.campus_location;
          if (loc) {
            setActiveLocation(loc);
            localStorage.setItem('selected_campus_location', loc);
          }
        }
        if (Array.isArray(d.saved_locations) && d.saved_locations.length > 0) {
          setSavedSpots(d.saved_locations);
          localStorage.setItem(SAVED_SPOTS_STORAGE_KEY, JSON.stringify(d.saved_locations));
        }
      });
  }, [user, currentLocation]);

  // When GPS resolves, snap to nearest campus building
  useEffect(() => {
    if (!gpsPos) return;
    setPinCoords({ lat: gpsPos.lat, lng: gpsPos.lng });
    const nearest = findNearestCampusLocation(gpsPos.lat, gpsPos.lng, locations);
    setSnappedNearest(nearest);
    if (nearest && nearest.distanceMeters <= 800) {
      setSelectedCampusObj(nearest.location);
    }
  }, [gpsPos, locations]);

  // Resolve fee dynamically from admin-configured delivery_zones first, then location.delivery_fee
  const resolveLocationFee = (loc?: CampusLocation | null, fallbackZoneName?: string): number => {
    const targetZoneName = loc?.zone_name || fallbackZoneName;
    if (targetZoneName && zones.length > 0) {
      const matchedZone = zones.find(
        (z) => z.zone_name.toLowerCase() === targetZoneName.toLowerCase()
      );
      if (matchedZone) return Number(matchedZone.delivery_fee);
    }
    if (loc?.delivery_fee != null) return Number(loc.delivery_fee);
    if (zones.length > 0) return Number(zones[0].delivery_fee);
    return 500;
  };

  const popularLocations = useMemo(() => {
    return locations.filter((l) => l.is_popular);
  }, [locations]);

  const categories = useMemo(() => {
    const cats = new Set(locations.map((l) => l.category));
    return Array.from(cats).filter(Boolean);
  }, [locations]);

  const filteredLocations = useMemo(() => {
    return filterCampusLocations(locations, search, selectedCategory);
  }, [locations, search, selectedCategory]);

  const availableDropoffs = useMemo(() => {
    if (!selectedCampusObj) return DEFAULT_DROPOFF_BY_CATEGORY.Hostel;
    if (
      Array.isArray(selectedCampusObj.dropoff_points) &&
      selectedCampusObj.dropoff_points.length > 0
    ) {
      return selectedCampusObj.dropoff_points;
    }
    return (
      DEFAULT_DROPOFF_BY_CATEGORY[selectedCampusObj.category] ||
      DEFAULT_DROPOFF_BY_CATEGORY.Hostel
    );
  }, [selectedCampusObj]);

  const commitLocationSelection = async (
    locName: string,
    locObj?: CampusLocation | null,
    dropoffOverride?: string,
    roomOverride?: string,
    coordsOverride?: { lat: number; lng: number } | null,
    zoneOverride?: string
  ) => {
    const dropoff = dropoffOverride !== undefined ? dropoffOverride : selectedDropoff;
    const room = roomOverride !== undefined ? roomOverride : roomNumber;

    const parts = [locName];
    if (dropoff) parts.push(dropoff);
    if (room.trim()) parts.push(`Rm/Blk: ${room.trim()}`);
    const formattedFullAddress = parts.join(' • ');

    const finalLat = coordsOverride?.lat ?? (locObj?.lat ? Number(locObj.lat) : pinCoords.lat);
    const finalLng = coordsOverride?.lng ?? (locObj?.lng ? Number(locObj.lng) : pinCoords.lng);
    const zone = zoneOverride || locObj?.zone_name || zones[0]?.zone_name || 'Campus Delivery';
    const fee = resolveLocationFee(locObj, zone);
    const mins = Number(locObj?.estimated_delivery_mins ?? 15);

    setActiveLocation(formattedFullAddress);
    localStorage.setItem('selected_campus_location', formattedFullAddress);
    localStorage.setItem('selected_campus_dropoff', dropoff || '');
    localStorage.setItem('selected_campus_room', room.trim());
    localStorage.setItem('selected_campus_fee', String(fee));
    localStorage.setItem('selected_campus_eta', String(mins));
    localStorage.setItem('selected_campus_zone', zone);

    if (finalLat && finalLng) {
      localStorage.setItem(
        'selected_campus_coords',
        JSON.stringify({ lat: finalLat, lng: finalLng })
      );
    }

    if (onLocationSelect) {
      onLocationSelect(formattedFullAddress, locObj, {
        dropoffPoint: dropoff,
        roomNumber: room.trim(),
        deliveryFee: fee,
        estimatedMins: mins,
        zoneName: zone,
        lat: finalLat,
        lng: finalLng,
      });
    }

    // Sync to profile if logged in
    if (user) {
      try {
        await supabase
          .from('profiles')
          .update({
            campus_location: formattedFullAddress,
            default_location_name: formattedFullAddress,
            ...(finalLat && finalLng ? { default_lat: finalLat, default_lng: finalLng } : {}),
            updated_at: new Date().toISOString(),
          } as any)
          .eq('user_id', user.id);
      } catch (err) {
        console.error('Failed to sync profile location:', err);
      }
    }

    toast({
      title: 'Delivery spot locked in 📍',
      description: `${formattedFullAddress} (₦${fee.toLocaleString()} delivery)`,
    });

    setOpen(false);
    setSearch('');
    setShowCustomInput(false);
  };

  const handleBuildingClick = (loc: CampusLocation) => {
    setSelectedCampusObj(loc);
    setShowSlangInput(false);
    setNewSlangText('');
    const defaultDrop =
      Array.isArray(loc.dropoff_points) && loc.dropoff_points.length > 0
        ? loc.dropoff_points[0]
        : "Main Gate / Porter's Lodge";
    setSelectedDropoff(defaultDrop);
    if (loc.lat && loc.lng) {
      setPinCoords({ lat: Number(loc.lat), lng: Number(loc.lng) });
    }
  };

  const handleAddStudentSlang = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCampusObj || !newSlangText.trim()) return;
    if (!user) {
      toast({
        title: 'Sign in required',
        description: 'Log in to add a campus slang or nickname for this spot.',
        variant: 'destructive',
      });
      return;
    }

    setAddingSlang(true);
    try {
      const updatedAliases = await addStudentSlang(selectedCampusObj.id, newSlangText.trim());
      setSelectedCampusObj({
        ...selectedCampusObj,
        aliases: updatedAliases,
      });
      toast({
        title: 'Campus slang added! 🎉',
        description: `Students can now search "${newSlangText.trim()}" to find ${selectedCampusObj.name}.`,
      });
      setNewSlangText('');
      setShowSlangInput(false);
    } catch (err: any) {
      toast({
        title: 'Could not add slang',
        description: err.message || 'Try a shorter nickname (2-30 chars)',
        variant: 'destructive',
      });
    } finally {
      setAddingSlang(false);
    }
  };

  const handleSavePresetSlot = async (slotId: SavedCampusSpot['id'], slotTitle: string) => {
    if (!selectedCampusObj && activeLocation === 'Select Location') {
      toast({
        title: 'Pick a campus building first',
        description: 'Tap any location below before saving to your 1-tap presets.',
        variant: 'destructive',
      });
      return;
    }

    const baseName = selectedCampusObj?.name || activeLocation.split(' • ')[0];
    const fee = resolveLocationFee(selectedCampusObj);
    const newSpot: SavedCampusSpot = {
      id: slotId,
      label: slotTitle,
      locationName: baseName,
      dropoffPoint: selectedDropoff || undefined,
      roomNumber: roomNumber.trim() || undefined,
      deliveryFee: fee,
      estimatedMins: Number(selectedCampusObj?.estimated_delivery_mins ?? 15),
      lat: selectedCampusObj?.lat ?? pinCoords.lat,
      lng: selectedCampusObj?.lng ?? pinCoords.lng,
    };

    const updated = [...savedSpots.filter((s) => s.id !== slotId), newSpot];
    setSavedSpots(updated);
    localStorage.setItem(SAVED_SPOTS_STORAGE_KEY, JSON.stringify(updated));

    if (user) {
      await supabase
        .from('profiles')
        .update({ saved_locations: updated } as any)
        .eq('user_id', user.id);
    }

    toast({
      title: `Saved as ${slotTitle} ⭐`,
      description: `${baseName}${selectedDropoff ? ` • ${selectedDropoff}` : ''}`,
    });
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customLocationInput.trim()) return;
    commitLocationSelection(customLocationInput.trim(), null, '', '', null, customZoneName);
    setCustomLocationInput('');
  };

  const getCategoryIcon = (category: string) => {
    switch (category?.toLowerCase()) {
      case 'hostel':
        return <Building className="h-4 w-4 text-orange-500" />;
      case 'faculty':
      case 'lecture hall':
        return <School className="h-4 w-4 text-blue-500" />;
      case 'library':
        return <BookOpen className="h-4 w-4 text-emerald-500" />;
      case 'gate':
        return <Compass className="h-4 w-4 text-purple-500" />;
      default:
        return <Landmark className="h-4 w-4 text-amber-500" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {triggerButton ? (
          triggerButton
        ) : (
          <button
            type="button"
            className={`inline-flex items-center gap-1.5 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-md px-3.5 py-1.5 text-xs font-semibold text-white border border-white/30 shadow-sm transition-all duration-200 group ${className || ''}`}
          >
            <MapPin className="h-3.5 w-3.5 text-amber-300 animate-pulse shrink-0" />
            <span className="truncate max-w-[170px] sm:max-w-[230px]">
              {activeLocation === 'Select Location' ? 'Choose Delivery Location' : activeLocation}
            </span>
            <ChevronDown className="h-3.5 w-3.5 text-white/70 group-hover:translate-y-0.5 transition-transform shrink-0" />
          </button>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-[540px] p-0 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Top Header */}
        <div className="p-4 sm:p-5 pb-3 border-b bg-gradient-to-r from-primary/10 via-amber-500/5 to-orange-500/10">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-primary/15 text-primary">
                <MapPin className="h-5 w-5 text-primary" />
              </div>
              <div>
                <DialogTitle className="font-heading text-base sm:text-lg font-bold">
                  Campus Delivery Spot
                </DialogTitle>
                <p className="text-[11px] text-muted-foreground">
                  Search by name or student slang, or pin your exact spot
                </p>
              </div>
            </div>

            {/* Mode Switcher: List vs Interactive Map */}
            <div className="flex items-center rounded-xl bg-muted p-1 border">
              <button
                type="button"
                onClick={() => setActiveTab('list')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'list'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Spots
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('map')}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'map'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <MapIcon className="h-3 w-3 text-primary" /> Pin Map
              </button>
            </div>
          </div>

          {/* 1-Tap Saved Student Presets (My Hostel / My Dept / Study Spot) */}
          <div className="mt-3 grid grid-cols-3 gap-1.5">
            {PRESET_SLOT_META.map((slot) => {
              const saved = savedSpots.find((s) => s.id === slot.id);
              return (
                <div
                  key={slot.id}
                  className={`flex items-center justify-between rounded-xl border px-2.5 py-1.5 text-left transition-all ${
                    saved
                      ? 'bg-background/90 border-primary/30 hover:border-primary shadow-sm'
                      : 'bg-muted/40 border-dashed border-border'
                  }`}
                >
                  <button
                    type="button"
                    className="flex-1 min-w-0 text-left"
                    onClick={() => {
                      if (saved) {
                        const matchObj = locations.find((l) => l.name === saved.locationName);
                        commitLocationSelection(
                          saved.locationName,
                          matchObj || null,
                          saved.dropoffPoint || '',
                          saved.roomNumber || '',
                          saved.lat && saved.lng ? { lat: saved.lat, lng: saved.lng } : null
                        );
                      } else {
                        handleSavePresetSlot(slot.id, slot.title);
                      }
                    }}
                  >
                    <div className="flex items-center gap-1">
                      <span className="text-xs">{slot.emoji}</span>
                      <span className="text-[11px] font-bold text-foreground truncate">
                        {slot.title}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                      {saved ? saved.locationName : '+ Save current'}
                    </p>
                  </button>
                  {saved && (
                    <button
                      type="button"
                      title={`Overwrite ${slot.title} with current selection`}
                      onClick={() => handleSavePresetSlot(slot.id, slot.title)}
                      className="ml-1 p-1 rounded hover:bg-muted text-muted-foreground hover:text-primary shrink-0"
                    >
                      <Bookmark className="h-3 w-3" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Search & Auto-Detect GPS Row */}
          {activeTab === 'list' && (
            <div className="flex gap-2 mt-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  autoFocus
                  placeholder="Search hostel, faculty, or student slang..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 pr-3 h-10 bg-background rounded-xl border text-xs sm:text-sm font-medium"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => getPosition()}
                disabled={gpsLoading}
                className="h-10 rounded-xl px-3 gap-1.5 text-xs font-semibold shrink-0 border-primary/30 hover:bg-primary/10"
              >
                <Navigation className={`h-3.5 w-3.5 text-primary ${gpsLoading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">{gpsLoading ? 'Locating...' : 'Snap GPS'}</span>
              </Button>
            </div>
          )}
        </div>

        {/* Body Content */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1 hide-scrollbar">
          {/* Snap-to-Landmark GPS Banner when GPS is active */}
          {snappedNearest && (
            <div className="flex items-center justify-between gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 shrink-0">
                  <Navigation className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-foreground truncate">
                    Nearest Spot: {snappedNearest.location.name}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {snappedNearest.distanceMeters < 1000
                      ? `${snappedNearest.distanceMeters}m away`
                      : `${(snappedNearest.distanceMeters / 1000).toFixed(1)}km away`}{' '}
                    • ₦{resolveLocationFee(snappedNearest.location).toLocaleString()}
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                className="h-8 rounded-lg text-xs shrink-0"
                onClick={() => handleBuildingClick(snappedNearest.location)}
              >
                Use Spot
              </Button>
            </div>
          )}

          {/* TAB 2: INTERACTIVE DRAG-THE-PIN CAMPUS MAP */}
          {activeTab === 'map' && (
            <div className="space-y-3">
              <CampusPinMap
                lat={pinCoords.lat}
                lng={pinCoords.lng}
                locations={locations}
                onPinMove={(newLat, newLng, nearest) => {
                  setPinCoords({ lat: newLat, lng: newLng });
                  if (nearest) {
                    setSnappedNearest(nearest);
                    if (nearest.distanceMeters <= 450) {
                      setSelectedCampusObj(nearest.location);
                    }
                  }
                }}
              />
              <div className="flex items-center justify-between rounded-xl border bg-muted/30 p-3">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-foreground truncate">
                    {selectedCampusObj
                      ? selectedCampusObj.name
                      : snappedNearest
                      ? `Near ${snappedNearest.location.name}`
                      : 'Custom Campus Pin'}
                  </p>
                  <p className="text-[11px] text-muted-foreground font-mono">
                    📍 {pinCoords.lat.toFixed(5)}, {pinCoords.lng.toFixed(5)}
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() =>
                    commitLocationSelection(
                      selectedCampusObj?.name ||
                        (snappedNearest
                          ? `Near ${snappedNearest.location.name}`
                          : `Pinned Spot (${pinCoords.lat.toFixed(4)}, ${pinCoords.lng.toFixed(4)})`),
                      selectedCampusObj || snappedNearest?.location || null,
                      selectedDropoff,
                      roomNumber,
                      pinCoords
                    )
                  }
                >
                  Confirm Pin Location
                </Button>
              </div>
            </div>
          )}

          {/* MICRO-DROPOFF + STUDENT SLANG CONFIGURER (Shows when a building is selected) */}
          {selectedCampusObj && (
            <div className="rounded-2xl border-2 border-primary/30 bg-primary/5 p-3.5 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Badge className="bg-primary text-primary-foreground text-[10px] px-2 py-0">
                      Selected Spot
                    </Badge>
                    {selectedCampusObj.short_code && (
                      <Badge variant="outline" className="text-[10px] font-bold">
                        {selectedCampusObj.short_code}
                      </Badge>
                    )}
                    {selectedCampusObj.zone_name && (
                      <Badge variant="secondary" className="text-[10px]">
                        {selectedCampusObj.zone_name}
                      </Badge>
                    )}
                  </div>
                  <h4 className="font-heading font-bold text-sm mt-1 text-foreground">
                    {selectedCampusObj.name}
                  </h4>
                  <p className="text-[11px] text-muted-foreground flex items-center gap-2 mt-0.5">
                    <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                      <Clock className="h-3 w-3" /> ~{selectedCampusObj.estimated_delivery_mins || 15}{' '}
                      mins
                    </span>
                    <span>•</span>
                    <span className="font-semibold text-foreground">
                      ₦{resolveLocationFee(selectedCampusObj).toLocaleString()} delivery
                    </span>
                  </p>
                </div>
              </div>

              {/* Student-Contributed Campus Slangs & Nicknames */}
              <div className="space-y-1.5 pt-1 border-t border-primary/15">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                    <Tag className="h-3 w-3 text-amber-500" /> Campus Slangs / Nicknames:
                  </span>
                  {!showSlangInput && (
                    <button
                      type="button"
                      onClick={() => setShowSlangInput(true)}
                      className="text-[11px] font-bold text-primary hover:underline flex items-center gap-0.5"
                    >
                      <Plus className="h-3 w-3" /> Add Slang
                    </button>
                  )}
                </div>

                {Array.isArray(selectedCampusObj.aliases) && selectedCampusObj.aliases.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {selectedCampusObj.aliases.map((alias) => (
                      <Badge
                        key={alias}
                        variant="outline"
                        className="text-[10px] bg-background/80 px-2 py-0 font-medium"
                      >
                        "{alias}"
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-muted-foreground italic">
                    No student slang added yet — tap "+ Add Slang" to add what students call this spot!
                  </p>
                )}

                {showSlangInput && (
                  <form onSubmit={handleAddStudentSlang} className="flex gap-1.5 pt-1">
                    <Input
                      placeholder="What do students call this place? (e.g. Indy, KDL, SLT)"
                      value={newSlangText}
                      onChange={(e) => setNewSlangText(e.target.value)}
                      maxLength={30}
                      className="h-8 text-xs bg-background flex-1"
                      autoFocus
                    />
                    <Button type="submit" size="sm" disabled={addingSlang} className="h-8 px-3 text-xs">
                      {addingSlang ? 'Adding...' : 'Save Slang'}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowSlangInput(false)}
                      className="h-8 px-2 text-xs"
                    >
                      Cancel
                    </Button>
                  </form>
                )}
              </div>

              {/* 1-Tap Exact Meet Point Pills */}
              <div className="space-y-1.5 pt-1 border-t border-primary/15">
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <DoorOpen className="h-3.5 w-3.5 text-primary" /> Exact Rider Meet / Drop-off Spot:
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {availableDropoffs.map((point) => {
                    const active = selectedDropoff === point;
                    return (
                      <button
                        key={point}
                        type="button"
                        onClick={() => setSelectedDropoff(point)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all border ${
                          active
                            ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                            : 'bg-background hover:bg-muted text-foreground border-border'
                        }`}
                      >
                        {point}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Optional Room / Wing / Note + Confirm CTA */}
              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                <Input
                  placeholder="Room / Wing / Landmark (e.g. Block B Room 204)"
                  value={roomNumber}
                  onChange={(e) => setRoomNumber(e.target.value)}
                  className="h-9 text-xs bg-background flex-1"
                />
                <Button
                  type="button"
                  size="sm"
                  className="h-9 px-4 text-xs font-bold gap-1.5 shrink-0"
                  onClick={() =>
                    commitLocationSelection(
                      selectedCampusObj.name,
                      selectedCampusObj,
                      selectedDropoff,
                      roomNumber
                    )
                  }
                >
                  <Check className="h-3.5 w-3.5" /> Confirm Spot
                </Button>
              </div>
            </div>
          )}

          {/* TAB 1: LIST & QUICK PICKS */}
          {activeTab === 'list' && (
            <>
              {/* Popular 1-Tap Quick Picks */}
              {!search && popularLocations.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-amber-500" /> Popular Campus Hubs
                    </span>
                    <span className="text-[11px] text-muted-foreground">Tap to select</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {popularLocations.map((loc) => {
                      const isSelected = selectedCampusObj?.id === loc.id;
                      return (
                        <button
                          key={loc.id}
                          type="button"
                          onClick={() => handleBuildingClick(loc)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 border ${
                            isSelected
                              ? 'bg-primary text-primary-foreground border-primary shadow-sm ring-2 ring-primary/30'
                              : 'bg-muted/60 hover:bg-muted text-foreground hover:border-primary/40'
                          }`}
                        >
                          <Star
                            className={`h-3 w-3 ${
                              isSelected
                                ? 'fill-primary-foreground text-primary-foreground'
                                : 'fill-amber-400 text-amber-500'
                            }`}
                          />
                          <span>
                            {loc.short_code ? `${loc.short_code} • ` : ''}
                            {loc.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Category Filter Chips */}
              {categories.length > 0 && (
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs hide-scrollbar">
                  <button
                    type="button"
                    onClick={() => setSelectedCategory('all')}
                    className={`px-3 py-1 rounded-full font-medium transition-colors ${
                      selectedCategory === 'all'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    All ({locations.length})
                  </button>
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-3 py-1 rounded-full font-medium transition-colors shrink-0 ${
                        selectedCategory === cat
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground hover:bg-muted/80'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              )}

              {/* Search / Filtered List */}
              <div className="space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {search ? `Matches (${filteredLocations.length})` : 'Campus Locations'}
                </p>

                {filteredLocations.length === 0 ? (
                  <div className="text-center py-6 border rounded-2xl bg-muted/20 space-y-3 px-4">
                    <p className="text-sm font-medium text-muted-foreground">
                      {search ? (
                        <>
                          No campus building matching{' '}
                          <span className="font-semibold text-foreground">"{search}"</span>
                        </>
                      ) : (
                        'No campus locations configured yet. You can enter your custom address below or add locations in the Admin panel.'
                      )}
                    </p>
                    {search && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-full gap-1 text-xs"
                        onClick={() => commitLocationSelection(search.trim(), null, '', '')}
                      >
                        <Plus className="h-3.5 w-3.5" /> Deliver to "{search}"
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="divide-y border rounded-2xl overflow-hidden bg-card">
                    {filteredLocations.map((loc) => {
                      const isSelected = selectedCampusObj?.id === loc.id;
                      const fee = resolveLocationFee(loc);
                      return (
                        <div
                          key={loc.id}
                          className={`w-full p-3 flex items-center justify-between gap-3 transition-colors ${
                            isSelected ? 'bg-primary/10' : 'hover:bg-muted/60'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => handleBuildingClick(loc)}
                            className="flex items-start text-left gap-3 flex-1 min-w-0"
                          >
                            <div className="p-2 rounded-xl bg-muted shrink-0 mt-0.5">
                              {getCategoryIcon(loc.category)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span
                                  className={`font-semibold text-sm truncate ${
                                    isSelected ? 'text-primary' : 'text-foreground'
                                  }`}
                                >
                                  {loc.name}
                                </span>
                                {loc.short_code && (
                                  <Badge
                                    variant="secondary"
                                    className="text-[10px] px-1.5 py-0 font-bold"
                                  >
                                    {loc.short_code}
                                  </Badge>
                                )}
                                <Badge
                                  variant="outline"
                                  className="text-[10px] px-1.5 py-0 capitalize font-normal"
                                >
                                  {loc.category}
                                </Badge>
                              </div>
                              {Array.isArray(loc.aliases) && loc.aliases.length > 0 && (
                                <p className="text-[11px] text-amber-600 dark:text-amber-400 truncate mt-0.5">
                                  AKA: {loc.aliases.join(', ')}
                                </p>
                              )}
                              {loc.description && (
                                <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                                  {loc.description}
                                </p>
                              )}
                              <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
                                <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                                  ⚡ ~{loc.estimated_delivery_mins || 15} mins
                                </span>
                                <span>•</span>
                                <span className="font-medium text-foreground">
                                  ₦{fee.toLocaleString()} fee
                                </span>
                                {loc.zone_name && (
                                  <>
                                    <span>•</span>
                                    <span className="truncate">{loc.zone_name}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </button>

                          <Button
                            type="button"
                            size="sm"
                            variant={isSelected ? 'default' : 'outline'}
                            className="h-8 px-3 text-xs rounded-xl shrink-0"
                            onClick={() =>
                              commitLocationSelection(
                                loc.name,
                                loc,
                                loc.dropoff_points?.[0] || "Main Gate / Porter's Lodge",
                                roomNumber
                              )
                            }
                          >
                            Select
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Custom Address Input Option with Zone Picker */}
              <div className="pt-2 border-t">
                {!showCustomInput ? (
                  <button
                    type="button"
                    onClick={() => setShowCustomInput(true)}
                    className="text-xs font-semibold text-primary hover:underline flex items-center gap-1.5"
                  >
                    <Plus className="h-3.5 w-3.5" /> Enter a custom room, lodge, or off-campus address
                  </button>
                ) : (
                  <form onSubmit={handleCustomSubmit} className="space-y-2.5">
                    <label className="text-xs font-semibold text-foreground block">
                      Custom Lodge / Address & Delivery Zone
                    </label>
                    {zones.length > 0 && (
                      <select
                        value={customZoneName}
                        onChange={(e) => setCustomZoneName(e.target.value)}
                        className="w-full h-9 rounded-md border border-input bg-background px-2.5 text-xs"
                      >
                        {zones.map((z) => (
                          <option key={z.id} value={z.zone_name}>
                            {z.zone_name} — ₦{Number(z.delivery_fee).toLocaleString()} delivery
                          </option>
                        ))}
                      </select>
                    )}
                    <div className="flex gap-2">
                      <Input
                        placeholder="Type your lodge, room, or street address..."
                        value={customLocationInput}
                        onChange={(e) => setCustomLocationInput(e.target.value)}
                        className="h-9 text-xs"
                        autoFocus
                      />
                      <Button type="submit" size="sm" className="h-9 px-4 text-xs shrink-0">
                        Set Address
                      </Button>
                    </div>
                  </form>
                )}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LocationSelectorModal;
