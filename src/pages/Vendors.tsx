import { useEffect, useState, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import AppNavbar from '@/components/layout/AppNavbar';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import {
  Search,
  Star,
  Clock,
  MapPin,
  Heart,
  Sparkles,
  SlidersHorizontal,
  Store,
  X,
  ArrowRight,
  Flame,
  CheckCircle,
  Truck
} from 'lucide-react';
import { isVendorOpen, formatTime } from '@/lib/vendorUtils';
import { useFavourites } from '@/hooks/useFavourites';
import { VendorCardSkeleton } from '@/components/Skeletons';
import EmptyState from '@/components/EmptyState';
import type { Database } from '@/integrations/supabase/types';

type Vendor = Database['public']['Tables']['vendors']['Row'];

const CATEGORIES = [
  { id: 'all', label: 'All Cuisines', emoji: '🍽️' },
  { id: 'rice', label: 'Rice & Bowls', emoji: '🍚', keywords: ['rice', 'jollof', 'fried rice', 'beans'] },
  { id: 'swallow', label: 'Swallow & Soups', emoji: '🍲', keywords: ['swallow', 'egusi', 'soup', 'amala', 'fufu', 'pounded yam', 'native'] },
  { id: 'fastfood', label: 'Fast Food & Burgers', emoji: '🍔', keywords: ['burger', 'chips', 'crispy', 'pie', 'pizza', 'sandwich', 'fast food'] },
  { id: 'shawarma', label: 'Shawarma & Grills', emoji: '🌯', keywords: ['shawarma', 'grill', 'bbq', 'suya', 'chicken', 'turkey', 'kebab'] },
  { id: 'drinks', label: 'Pastries & Drinks', emoji: '🧃', keywords: ['drink', 'smoothie', 'juice', 'boba', 'pastry', 'cake', 'doughnut', 'coffee', 'cocktail'] },
];

export default function VendorsPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialCategory = searchParams.get('category') || 'all';
  const initialSearch = searchParams.get('search') || '';

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(initialSearch);
  const [selectedCategory, setSelectedCategory] = useState(initialCategory);
  const [filterOpenOnly, setFilterOpenOnly] = useState(false);
  const [filterTopRated, setFilterTopRated] = useState(false);
  const [filterFeatured, setFilterFeatured] = useState(false);
  const [showFavourites, setShowFavourites] = useState(false);
  const [sortBy, setSortBy] = useState<'default' | 'rating' | 'name' | 'fastest'>('default');

  const { isFavourite, toggleFavourite, favouriteVendorIds } = useFavourites();

  useEffect(() => {
    const fetchVendors = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('vendors')
          .select('*')
          .eq('is_approved', true)
          .order('name');

        if (!error && data) {
          setVendors(data);
        }
      } catch (err) {
        console.error('Error fetching vendors:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchVendors();
  }, []);

  // Sync category state from URL if it changes
  useEffect(() => {
    const cat = searchParams.get('category');
    if (cat) setSelectedCategory(cat);
  }, [searchParams]);

  const filteredVendors = useMemo(() => {
    const query = search.toLowerCase().trim();
    let list = vendors.filter(v => {
      const matchName = v.name.toLowerCase().includes(query);
      const matchDesc = (v.description || '').toLowerCase().includes(query);
      const matchAddr = (v.address || '').toLowerCase().includes(query);
      return matchName || matchDesc || matchAddr;
    });

    // Filter by Category keywords
    if (selectedCategory && selectedCategory !== 'all') {
      const catConfig = CATEGORIES.find(c => c.id === selectedCategory);
      if (catConfig && catConfig.keywords) {
        list = list.filter(v => {
          const text = `${v.name} ${v.description || ''}`.toLowerCase();
          return catConfig.keywords.some(kw => text.includes(kw));
        });
      }
    }

    if (showFavourites) {
      list = list.filter(v => favouriteVendorIds.has(v.id));
    }

    if (filterOpenOnly) {
      list = list.filter(v => isVendorOpen(v.opening_time, v.closing_time, v.is_active));
    }

    if (filterTopRated) {
      list = list.filter(v => Number(v.rating || 0) >= 4.5);
    }

    if (filterFeatured) {
      list = list.filter(v => (v as any).is_featured || (v as any).featured_tier);
    }

    // Sorting
    return list.sort((a, b) => {
      if (sortBy === 'rating') {
        return Number(b.rating || 0) - Number(a.rating || 0);
      }
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name);
      }

      // Default: Featured first, then Open first, then alphabetical
      const aFeatured = (a as any).is_featured || (a as any).featured_tier ? 1 : 0;
      const bFeatured = (b as any).is_featured || (b as any).featured_tier ? 1 : 0;
      if (aFeatured !== bFeatured) return bFeatured - aFeatured;

      const aOpen = isVendorOpen(a.opening_time, a.closing_time, a.is_active);
      const bOpen = isVendorOpen(b.opening_time, b.closing_time, b.is_active);
      if (aOpen !== bOpen) return aOpen ? -1 : 1;

      return a.name.localeCompare(b.name);
    });
  }, [vendors, search, selectedCategory, showFavourites, filterOpenOnly, filterTopRated, filterFeatured, sortBy, favouriteVendorIds]);

  const clearAllFilters = () => {
    setSearch('');
    setSelectedCategory('all');
    setFilterOpenOnly(false);
    setFilterTopRated(false);
    setFilterFeatured(false);
    setShowFavourites(false);
    setSortBy('default');
    setSearchParams({});
  };

  return (
    <div className="min-h-screen bg-background pb-24 md:pb-12">
      <AppNavbar />

      <div className="container py-6 space-y-6 max-w-7xl">
        {/* Header Title Section */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Store className="h-5 w-5" />
              </div>
              <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                Campus Food Marketplace
              </h1>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Discover all student-favorite cafeterias, fast food spots, and local kitchens delivering to your hostel.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-xl self-start sm:self-auto border border-border">
            <span>{vendors.length} Total Verified Eateries</span>
          </div>
        </div>

        {/* Search & Sort Controls Bar */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="relative md:col-span-3">
            <Search className="absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by restaurant name, food type, or campus location..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 pr-9 h-11 bg-card rounded-xl border-border shadow-sm text-sm"
            />
            {search && (
              <button 
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div>
            <Select value={sortBy} onValueChange={(val: any) => setSortBy(val)}>
              <SelectTrigger className="h-11 rounded-xl bg-card border-border shadow-sm text-xs sm:text-sm">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>Sort by: <strong className="capitalize">{sortBy}</strong></span>
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Default (Featured & Open)</SelectItem>
                <SelectItem value="rating">Highest Rating (5★ → 1★)</SelectItem>
                <SelectItem value="name">Alphabetical (A → Z)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Visual Category Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar pb-1">
          {CATEGORIES.map((cat) => {
            const active = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => {
                  setSelectedCategory(cat.id);
                  if (cat.id === 'all') {
                    searchParams.delete('category');
                    setSearchParams(searchParams);
                  } else {
                    setSearchParams({ category: cat.id });
                  }
                }}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all shadow-sm ${
                  active
                    ? 'bg-primary text-primary-foreground shadow-primary/25 scale-[1.02]'
                    : 'bg-card border border-border text-muted-foreground hover:text-foreground hover:border-primary/40'
                }`}
              >
                <span>{cat.emoji}</span>
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>

        {/* Quick Filter Status Chips */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button
            size="sm"
            variant={filterOpenOnly ? 'default' : 'outline'}
            className="rounded-full text-xs h-8 gap-1.5 shadow-sm"
            onClick={() => setFilterOpenOnly(!filterOpenOnly)}
          >
            <span className={`h-2 w-2 rounded-full ${filterOpenOnly ? 'bg-white' : 'bg-emerald-500'}`} />
            <span>Open Now Only</span>
          </Button>

          <Button
            size="sm"
            variant={filterTopRated ? 'default' : 'outline'}
            className="rounded-full text-xs h-8 gap-1 shadow-sm"
            onClick={() => setFilterTopRated(!filterTopRated)}
          >
            <Star className={`h-3 w-3 ${filterTopRated ? 'fill-white' : 'fill-amber-400 text-amber-500'}`} />
            <span>Top Rated (4.5★+)</span>
          </Button>

          <Button
            size="sm"
            variant={filterFeatured ? 'default' : 'outline'}
            className="rounded-full text-xs h-8 gap-1 shadow-sm"
            onClick={() => setFilterFeatured(!filterFeatured)}
          >
            <Sparkles className={`h-3 w-3 ${filterFeatured ? 'text-white fill-white' : 'text-amber-500'}`} />
            <span>Featured (Paid)</span>
          </Button>

          {user && (
            <Button
              size="sm"
              variant={showFavourites ? 'default' : 'outline'}
              className="rounded-full text-xs h-8 gap-1 shadow-sm"
              onClick={() => setShowFavourites(!showFavourites)}
            >
              <Heart className={`h-3 w-3 ${showFavourites ? 'fill-white text-white' : 'fill-red-500 text-red-500'}`} />
              <span>Saved Favorites</span>
            </Button>
          )}

          {(search || selectedCategory !== 'all' || filterOpenOnly || filterTopRated || filterFeatured || showFavourites) && (
            <Button
              size="sm"
              variant="ghost"
              onClick={clearAllFilters}
              className="text-xs h-8 text-muted-foreground hover:text-foreground gap-1 ml-auto"
            >
              <X className="h-3.5 w-3.5" /> Clear filters
            </Button>
          )}
        </div>

        {/* Vendors Grid */}
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <VendorCardSkeleton key={i} />
            ))}
          </div>
        ) : filteredVendors.length === 0 ? (
          <EmptyState
            icon={<Store className="h-10 w-10" />}
            title="No vendors found"
            description="Try adjusting your search keywords, clearing active filters, or browsing other food categories."
            action={
              <button
                onClick={clearAllFilters}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Reset All Filters
              </button>
            }
          />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filteredVendors.map((vendor) => {
              const open = isVendorOpen(vendor.opening_time, vendor.closing_time, vendor.is_active);
              const fav = favouriteVendorIds.has(vendor.id);
              const isFeatured = Boolean((vendor as any).is_featured || (vendor as any).featured_tier);

              return (
                <div key={vendor.id} className="relative group">
                  <Link to={`/vendor/${vendor.id}`} className="block h-full">
                    <Card className={`h-full overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 border-border ${
                      isFeatured ? 'ring-2 ring-amber-500/30' : ''
                    }`}>
                      {/* Vendor Banner / Avatar Area */}
                      <div className="relative h-36 w-full overflow-hidden bg-gradient-to-r from-orange-500/20 via-amber-500/20 to-primary/10 flex items-center justify-center">
                        {vendor.logo_url ? (
                          <img
                            src={vendor.logo_url}
                            alt={vendor.name}
                            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center text-muted-foreground/60 gap-1">
                            <Store className="h-10 w-10 stroke-[1.5]" />
                            <span className="text-[11px] font-medium">Belly-Chow Kitchen</span>
                          </div>
                        )}

                        {/* Top Badges */}
                        <div className="absolute left-3 top-3 flex flex-col gap-1.5">
                          {isFeatured && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500 text-white px-2.5 py-0.5 text-[11px] font-bold shadow-md">
                              <Sparkles className="h-3 w-3 fill-white" /> Featured
                            </span>
                          )}
                          {open ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 text-white px-2.5 py-0.5 text-[10px] font-bold shadow-md">
                              <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" /> Open Now
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-zinc-900/80 text-zinc-300 px-2.5 py-0.5 text-[10px] font-medium backdrop-blur-md">
                              Closed
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Vendor Details */}
                      <CardContent className="p-4 space-y-3">
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <h3 className="font-heading font-bold text-base text-foreground truncate group-hover:text-primary transition-colors">
                              {vendor.name}
                            </h3>
                            <span className="flex items-center gap-1 font-bold text-xs text-foreground shrink-0 bg-muted/60 px-2 py-0.5 rounded-md">
                              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" />
                              {vendor.rating && vendor.rating > 0 ? Number(vendor.rating).toFixed(1) : 'New'}
                            </span>
                          </div>

                          <p className="text-xs text-muted-foreground line-clamp-2 mt-1 leading-relaxed">
                            {vendor.description || 'Verified student eatery serving fresh campus meals.'}
                          </p>
                        </div>

                        {/* Metadata Footer */}
                        <div className="pt-2 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                          <div className="flex items-center gap-1 truncate max-w-[170px]">
                            <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" />
                            <span className="truncate">{vendor.address || 'Main Campus'}</span>
                          </div>

                          {vendor.opening_time && vendor.closing_time && (
                            <div className="flex items-center gap-1 text-[11px] shrink-0">
                              <Clock className="h-3 w-3" />
                              <span>{formatTime(vendor.opening_time)} – {formatTime(vendor.closing_time)}</span>
                            </div>
                          )}
                        </div>

                        {/* View Menu CTA */}
                        <Button 
                          size="sm" 
                          className="w-full h-9 rounded-xl font-bold text-xs gap-1.5 mt-1 shadow-sm"
                        >
                          <span>Explore Menu</span>
                          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                        </Button>
                      </CardContent>
                    </Card>
                  </Link>

                  {/* Favorite Bookmark Toggle */}
                  {user && (
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        toggleFavourite(vendor.id);
                      }}
                      aria-label="Save to favorites"
                      className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-background/85 backdrop-blur-md shadow-md transition-all hover:scale-110 hover:bg-background"
                    >
                      <Heart className={`h-4 w-4 ${fav ? 'fill-red-500 text-red-500' : 'text-muted-foreground hover:text-foreground'}`} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
