import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import AppNavbar from '@/components/layout/AppNavbar';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Search, Star, Clock, X, Heart } from 'lucide-react';
import { isVendorOpen, formatTime } from '@/lib/vendorUtils';
import { useFavourites } from '@/hooks/useFavourites';
import { VendorCardSkeleton } from '@/components/Skeletons';
import EmptyState from '@/components/EmptyState';
import type { Database } from '@/integrations/supabase/types';

type Vendor = Database['public']['Tables']['vendors']['Row'];
type MenuItem = Database['public']['Tables']['menu_items']['Row'];
type MenuItemWithVendor = MenuItem & { vendor: Pick<Vendor, 'id' | 'name' | 'logo_url' | 'opening_time' | 'closing_time' | 'is_active'> };

const StudentDashboard = () => {
  const { user } = useAuth();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItemWithVendor[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showFavourites, setShowFavourites] = useState(false);
  const { isFavourite, toggleFavourite, favouriteVendorIds } = useFavourites();

  useEffect(() => {
    const fetchData = async () => {
      const [vendorRes, menuRes] = await Promise.all([
        supabase.from('vendors').select('*').eq('is_approved', true).order('name'),
        supabase.from('menu_items').select('*, vendor:vendors!menu_items_vendor_id_fkey(id, name, logo_url, opening_time, closing_time, is_active)').eq('is_available', true),
      ]);
      setVendors(vendorRes.data || []);
      setMenuItems((menuRes.data as unknown as MenuItemWithVendor[]) || []);
      setLoading(false);
    };
    fetchData();
  }, []);

  const categories = useMemo(() => {
    const cats = new Set(menuItems.map(item => item.category));
    return Array.from(cats).sort();
  }, [menuItems]);

  const query = search.toLowerCase().trim();
  const isSearching = query.length > 0 || selectedCategory !== null;

  const filteredMenuItems = useMemo(() => {
    if (!isSearching) return [];
    return menuItems.filter(item => {
      const matchesSearch = !query || item.name.toLowerCase().includes(query) || item.description?.toLowerCase().includes(query) || item.vendor?.name?.toLowerCase().includes(query);
      const matchesCategory = !selectedCategory || item.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [menuItems, query, selectedCategory, isSearching]);

  const itemsByVendor = useMemo(() => {
    const grouped: Record<string, { vendor: MenuItemWithVendor['vendor']; items: MenuItemWithVendor[] }> = {};
    filteredMenuItems.forEach(item => {
      if (!item.vendor) return;
      if (!grouped[item.vendor.id]) grouped[item.vendor.id] = { vendor: item.vendor, items: [] };
      grouped[item.vendor.id].items.push(item);
    });
    return Object.values(grouped);
  }, [filteredMenuItems]);

  const filteredVendors = useMemo(() => {
    let list = vendors.filter(v => v.name.toLowerCase().includes(query));
    if (showFavourites) list = list.filter(v => favouriteVendorIds.has(v.id));
    return list.sort((a, b) => {
      const aOpen = isVendorOpen(a.opening_time, a.closing_time, a.is_active);
      const bOpen = isVendorOpen(b.opening_time, b.closing_time, b.is_active);
      if (aOpen === bOpen) return 0;
      return aOpen ? -1 : 1;
    });
  }, [vendors, query, showFavourites, favouriteVendorIds]);

  const clearFilters = () => { setSearch(''); setSelectedCategory(null); };

  const VendorCard = ({ vendor }: { vendor: Vendor }) => {
    const open = isVendorOpen(vendor.opening_time, vendor.closing_time, vendor.is_active);
    const fav = isFavourite(vendor.id);
    return (
      <div className="relative group">
        <Link to={`/vendor/${vendor.id}`}>
          <Card className={`overflow-hidden transition-all hover:ring-1 hover:ring-border ${!open ? 'opacity-50' : ''}`}>
            <div className="relative h-36 bg-muted flex items-center justify-center">
              {vendor.logo_url ? (
                <img src={vendor.logo_url} alt={vendor.name} className="h-full w-full object-cover" />
              ) : (
                <span className="text-4xl text-muted-foreground/40">🍽️</span>
              )}
              {!open && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/70">
                  <span className="rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground">Closed</span>
                </div>
              )}
            </div>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-heading font-semibold truncate">{vendor.name}</h3>
                  <p className="text-sm text-muted-foreground line-clamp-1">{vendor.description || 'Campus food vendor'}</p>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Star className="h-3 w-3 fill-foreground text-foreground" />
                  {vendor.rating && vendor.rating > 0 ? Number(vendor.rating).toFixed(1) : 'New'}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatTime(vendor.opening_time)} – {formatTime(vendor.closing_time)}
                </span>
                {open && <span className="ml-auto text-xs font-medium text-foreground">Open</span>}
              </div>
            </CardContent>
          </Card>
        </Link>
        {user && (
          <button
            onClick={(e) => { e.preventDefault(); toggleFavourite(vendor.id); }}
            className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-background/80 backdrop-blur-sm transition-colors hover:bg-background"
          >
            <Heart className={`h-4 w-4 ${fav ? 'fill-foreground text-foreground' : 'text-muted-foreground'}`} />
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <AppNavbar />
      <div className="container py-8">
        <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground">Browse</p>
        <h1 className="mt-1 font-heading text-2xl font-bold tracking-tight">Campus vendors</h1>

        {/* Search */}
        <div className="relative mt-6 mb-4">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search food, drinks, vendors..." className="pl-10 pr-10" value={search} onChange={e => setSearch(e.target.value)} />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Filter chips */}
        <div className="mb-8 flex flex-wrap gap-2">
          {user && (
            <Button size="sm" variant={showFavourites ? 'default' : 'outline'} className="rounded-full gap-1 h-8 text-xs" onClick={() => setShowFavourites(!showFavourites)}>
              <Heart className={`h-3 w-3 ${showFavourites ? 'fill-primary-foreground' : ''}`} /> Favourites
            </Button>
          )}
          {categories.length > 0 && (
            <>
              <Button size="sm" variant={selectedCategory === null ? 'default' : 'outline'} className="rounded-full h-8 text-xs" onClick={() => setSelectedCategory(null)}>All</Button>
              {categories.map(cat => (
                <Button key={cat} size="sm" variant={selectedCategory === cat ? 'default' : 'outline'} className="rounded-full h-8 text-xs" onClick={() => setSelectedCategory(prev => prev === cat ? null : cat)}>
                  {cat}
                </Button>
              ))}
            </>
          )}
        </div>

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map(i => <VendorCardSkeleton key={i} />)}
          </div>
        ) : isSearching ? (
          filteredMenuItems.length === 0 ? (
            <EmptyState emoji="🔍" title="No results found" description="Try a different search term or category" action={<Button variant="link" onClick={clearFilters}>Clear filters</Button>} />
          ) : (
            <div className="space-y-10">
              <p className="text-sm text-muted-foreground">{filteredMenuItems.length} item{filteredMenuItems.length !== 1 ? 's' : ''} found</p>
              {itemsByVendor.map(({ vendor, items }) => {
                const open = isVendorOpen(vendor.opening_time, vendor.closing_time, vendor.is_active);
                return (
                  <div key={vendor.id}>
                    <Link to={`/vendor/${vendor.id}`} className="mb-3 flex items-center gap-2 hover:underline">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-lg">
                        {vendor.logo_url ? <img src={vendor.logo_url} alt={vendor.name} className="h-full w-full rounded-lg object-cover" /> : '🍽️'}
                      </div>
                      <span className="font-heading font-semibold">{vendor.name}</span>
                      {!open && <span className="text-xs text-muted-foreground">Closed</span>}
                    </Link>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {items.map(item => (
                        <Link key={item.id} to={`/vendor/${vendor.id}`}>
                          <Card className={`overflow-hidden transition-all hover:ring-1 hover:ring-border ${!open ? 'opacity-50' : ''}`}>
                            <CardContent className="flex items-center gap-3 p-3">
                              {item.image_url ? (
                                <img src={item.image_url} alt={item.name} className="h-14 w-14 rounded-lg object-cover" />
                              ) : (
                                <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-muted text-muted-foreground/40 text-xl">🍛</div>
                              )}
                              <div className="flex-1 min-w-0">
                                <h4 className="font-medium truncate text-sm">{item.name}</h4>
                                <p className="text-xs text-muted-foreground truncate">{item.category}</p>
                                <p className="font-heading font-bold text-sm mt-0.5">₦{Number(item.price).toLocaleString()}</p>
                              </div>
                            </CardContent>
                          </Card>
                        </Link>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : filteredVendors.length === 0 ? (
          <EmptyState
            emoji={showFavourites ? '💔' : '🍽️'}
            title={showFavourites ? 'No favourite vendors yet' : 'No vendors available yet'}
            description={showFavourites ? 'Tap the heart icon on any vendor to save them here' : 'Check back soon'}
            action={showFavourites ? <Button variant="link" onClick={() => setShowFavourites(false)}>Browse all vendors</Button> : undefined}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredVendors.map(vendor => <VendorCard key={vendor.id} vendor={vendor} />)}
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentDashboard;
