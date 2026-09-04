import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MapPin, Search, Star, Building, School, BookOpen, Compass, Landmark, Check, ChevronDown, Plus, Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export interface CampusLocation {
  id: string;
  name: string;
  category: string;
  description: string | null;
  is_popular: boolean;
  is_active: boolean;
  lat: number | null;
  lng: number | null;
}

// Sensible fallback locations if DB query hasn't run yet or table is empty
const FALLBACK_LOCATIONS: CampusLocation[] = [
  { id: '1', name: 'Hall 1 (Independence Hall)', category: 'Hostel', description: 'Male Hostel, Main Campus', is_popular: true, is_active: true, lat: null, lng: null },
  { id: '2', name: 'Hall 2 (Queen Elizabeth)', category: 'Hostel', description: 'Female Hostel, Central Area', is_popular: true, is_active: true, lat: null, lng: null },
  { id: '3', name: 'Hall 3 (Alexander Brown)', category: 'Hostel', description: 'Medical Hostel, East Wing', is_popular: true, is_active: true, lat: null, lng: null },
  { id: '4', name: 'Hall 4 (Sultan Bello)', category: 'Hostel', description: 'Male Hostel, North Gate', is_popular: true, is_active: true, lat: null, lng: null },
  { id: '5', name: 'Hall 5 (Queen Idia)', category: 'Hostel', description: 'Female Hostel, Near Gate 2', is_popular: true, is_active: true, lat: null, lng: null },
  { id: '6', name: 'Main University Library (Kenneth Dike)', category: 'Library', description: 'Central Reading Halls & Quadrangle', is_popular: true, is_active: true, lat: null, lng: null },
  { id: '7', name: 'Faculty of Engineering', category: 'Faculty', description: 'Engineering Lecture Theatres & Labs', is_popular: true, is_active: true, lat: null, lng: null },
  { id: '8', name: 'Faculty of Social Sciences', category: 'Faculty', description: 'Faculty Complex & Departmental Blocks', is_popular: false, is_active: true, lat: null, lng: null },
  { id: '9', name: 'SUB (Student Union Building)', category: 'Landmark', description: 'Student Plaza, Arcade & Chow Square', is_popular: true, is_active: true, lat: null, lng: null },
  { id: '10', name: 'Main University Gate (Security Post)', category: 'Gate', description: 'Front Entrance & Transit Station', is_popular: false, is_active: true, lat: null, lng: null },
];

interface LocationSelectorProps {
  currentLocation?: string;
  onLocationSelect?: (locationName: string, locationObj?: CampusLocation | null) => void;
  triggerButton?: React.ReactNode;
  className?: string;
}

export const LocationSelectorModal: React.FC<LocationSelectorProps> = ({
  currentLocation,
  onLocationSelect,
  triggerButton,
  className,
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [locations, setLocations] = useState<CampusLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [customLocationInput, setCustomLocationInput] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);

  // Active selected location state
  const [activeLocation, setActiveLocation] = useState<string>(() => {
    return currentLocation || localStorage.getItem('selected_campus_location') || 'Select Location';
  });

  useEffect(() => {
    if (currentLocation) {
      setActiveLocation(currentLocation);
    }
  }, [currentLocation]);

  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const { data, error } = await supabase
          .from('campus_locations')
          .select('*')
          .eq('is_active', true)
          .order('is_popular', { ascending: false })
          .order('name', { ascending: true });

        if (error || !data || data.length === 0) {
          setLocations(FALLBACK_LOCATIONS);
        } else {
          setLocations(data);
        }
      } catch (err) {
        setLocations(FALLBACK_LOCATIONS);
      } finally {
        setLoading(false);
      }
    };

    fetchLocations();
  }, []);

  // Fetch user default location from profile if not set
  useEffect(() => {
    if (user && !currentLocation && !localStorage.getItem('selected_campus_location')) {
      supabase
        .from('profiles')
        .select('default_location_name, campus_location')
        .eq('user_id', user.id)
        .single()
        .then(({ data }) => {
          if (data) {
            const loc = (data as any).default_location_name || data.campus_location;
            if (loc) {
              setActiveLocation(loc);
              localStorage.setItem('selected_campus_location', loc);
            }
          }
        });
    }
  }, [user, currentLocation]);

  const popularLocations = useMemo(() => {
    return locations.filter(l => l.is_popular);
  }, [locations]);

  const categories = useMemo(() => {
    const cats = new Set(locations.map(l => l.category));
    return Array.from(cats).filter(Boolean);
  }, [locations]);

  const filteredLocations = useMemo(() => {
    const q = search.toLowerCase().trim();
    return locations.filter(loc => {
      const matchesQuery =
        !q ||
        loc.name.toLowerCase().includes(q) ||
        (loc.description && loc.description.toLowerCase().includes(q)) ||
        loc.category.toLowerCase().includes(q);

      const matchesCategory = selectedCategory === 'all' || loc.category === selectedCategory;

      return matchesQuery && matchesCategory;
    });
  }, [locations, search, selectedCategory]);

  const handleSelect = async (locName: string, locObj?: CampusLocation | null) => {
    setActiveLocation(locName);
    localStorage.setItem('selected_campus_location', locName);
    if (locObj?.lat && locObj?.lng) {
      localStorage.setItem('selected_campus_coords', JSON.stringify({ lat: locObj.lat, lng: locObj.lng }));
    }

    if (onLocationSelect) {
      onLocationSelect(locName, locObj);
    }

    // Sync to profile if logged in
    if (user) {
      try {
        await supabase
          .from('profiles')
          .update({
            campus_location: locName,
            default_location_name: locName,
            ...(locObj?.lat && locObj?.lng ? { default_lat: locObj.lat, default_lng: locObj.lng } : {}),
            updated_at: new Date().toISOString(),
          } as any)
          .eq('user_id', user.id);
      } catch (err) {
        console.error('Failed to sync profile location:', err);
      }
    }

    toast({
      title: 'Delivery spot updated 📍',
      description: `Delivering to ${locName}`,
    });

    setOpen(false);
    setSearch('');
    setShowCustomInput(false);
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customLocationInput.trim()) return;
    handleSelect(customLocationInput.trim(), null);
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
            <span className="truncate max-w-[160px] sm:max-w-[200px]">
              {activeLocation === 'Select Location' ? 'Choose Delivery Location' : activeLocation}
            </span>
            <ChevronDown className="h-3.5 w-3.5 text-white/70 group-hover:translate-y-0.5 transition-transform shrink-0" />
          </button>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="p-5 pb-3 border-b bg-gradient-to-r from-primary/5 via-amber-500/5 to-orange-500/5">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <MapPin className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="font-heading text-lg font-bold">
                Select Delivery Location
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Choose your hostel, faculty building, or campus landmark
              </p>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative mt-4">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              autoFocus
              placeholder="Type keyword (e.g. Hall 3, Library, Engr, SUB)..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10 pr-4 h-11 bg-background rounded-xl border focus-visible:ring-primary text-sm font-medium"
            />
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1 hide-scrollbar">
          {/* Popular 1-Tap Quick Picks (Show when not deeply searching) */}
          {!search && popularLocations.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-amber-500" /> Popular Campus Spots
                </span>
                <span className="text-[11px] text-muted-foreground">1-Tap Select</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {popularLocations.map(loc => {
                  const isSelected = activeLocation === loc.name;
                  return (
                    <button
                      key={loc.id}
                      onClick={() => handleSelect(loc.name, loc)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 border ${
                        isSelected
                          ? 'bg-primary text-primary-foreground border-primary shadow-sm ring-2 ring-primary/30'
                          : 'bg-muted/60 hover:bg-muted text-foreground hover:border-primary/40'
                      }`}
                    >
                      <Star className={`h-3 w-3 ${isSelected ? 'fill-primary-foreground text-primary-foreground' : 'fill-amber-400 text-amber-500'}`} />
                      <span>{loc.name}</span>
                      {isSelected && <Check className="h-3 w-3 ml-0.5" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Category Filter Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs hide-scrollbar">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1 rounded-full font-medium transition-colors ${
                selectedCategory === 'all'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              All
            </button>
            {categories.map(cat => (
              <button
                key={cat}
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

          {/* Search / Filtered List */}
          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {search ? `Suggestions (${filteredLocations.length})` : 'All Campus Locations'}
            </p>

            {filteredLocations.length === 0 ? (
              <div className="text-center py-6 border rounded-2xl bg-muted/20 space-y-3">
                <p className="text-sm font-medium text-muted-foreground">
                  No campus location found matching <span className="font-semibold text-foreground">"{search}"</span>
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full gap-1 text-xs"
                  onClick={() => {
                    setCustomLocationInput(search);
                    setShowCustomInput(true);
                  }}
                >
                  <Plus className="h-3.5 w-3.5" /> Use "{search}" as my address
                </Button>
              </div>
            ) : (
              <div className="divide-y border rounded-2xl overflow-hidden bg-card">
                {filteredLocations.map(loc => {
                  const isSelected = activeLocation === loc.name;
                  return (
                    <button
                      key={loc.id}
                      onClick={() => handleSelect(loc.name, loc)}
                      className={`w-full p-3.5 flex items-start text-left gap-3 transition-colors ${
                        isSelected
                          ? 'bg-primary/10 hover:bg-primary/15'
                          : 'hover:bg-muted/60'
                      }`}
                    >
                      <div className="p-2 rounded-xl bg-muted shrink-0 mt-0.5">
                        {getCategoryIcon(loc.category)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`font-semibold text-sm truncate ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                            {loc.name}
                          </span>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 capitalize shrink-0 font-normal">
                            {loc.category}
                          </Badge>
                        </div>
                        {loc.description && (
                          <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                            {loc.description}
                          </p>
                        )}
                      </div>
                      {isSelected && (
                        <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center text-primary-foreground shrink-0 self-center">
                          <Check className="h-3.5 w-3.5" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Custom Address Input Option */}
          <div className="pt-2 border-t">
            {!showCustomInput ? (
              <button
                onClick={() => setShowCustomInput(true)}
                className="text-xs font-semibold text-primary hover:underline flex items-center gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" /> Enter a custom room, block, or address
              </button>
            ) : (
              <form onSubmit={handleCustomSubmit} className="space-y-2">
                <label className="text-xs font-semibold text-foreground">
                  Custom Location / Room / Address
                </label>
                <div className="flex gap-2">
                  <Input
                    placeholder="e.g. Off Campus, Block C Flat 4, Agbowo"
                    value={customLocationInput}
                    onChange={e => setCustomLocationInput(e.target.value)}
                    className="h-9 text-xs"
                    autoFocus
                  />
                  <Button type="submit" size="sm" className="h-9 px-4 text-xs shrink-0">
                    Set Location
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LocationSelectorModal;
