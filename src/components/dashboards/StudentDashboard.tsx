import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import AppNavbar from '@/components/layout/AppNavbar';
import LocationSelectorModal from '@/components/location/LocationSelectorModal';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Search, Star, Clock, X, Heart, Sparkles, Bike, ArrowRight, Flame, ChevronRight } from 'lucide-react';
import { isVendorOpen, formatTime } from '@/lib/vendorUtils';
import { useFavourites } from '@/hooks/useFavourites';
import { VendorCardSkeleton } from '@/components/Skeletons';
import EmptyState from '@/components/EmptyState';
import type { Database } from '@/integrations/supabase/types';

type Vendor = Database['public']['Tables']['vendors']['Row'];
type MenuItem = Database['public']['Tables']['menu_items']['Row'];
type MenuItemWithVendor = MenuItem & { vendor: Pick<Vendor, 'id' | 'name' | 'logo_url' | 'opening_time' | 'closing_time' | 'is_active'> };

const TRENDING_TAGS = [
  { label: '🔥 Jollof Rice', query: 'jollof' },
  { label: '🍗 Crispy Chicken', query: 'chicken' },
  { label: '🍔 Burgers & Grills', query: 'burger' },
  { label: '🥤 Smoothies & Drinks', query: 'drink' },
  { label: '🌯 Shawarma', query: 'shawarma' },
  { label: '🥐 Pastries', query: 'pastry' },
  { label: '🍲 Local Soups', query: 'soup' },
];

const StudentDashboard = () => {
  const { user } = useAuth();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItemWithVendor[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showFavourites, setShowFavourites] = useState(false);
  const [userName, setUserName] = useState<string>('');
  const [activeOrder, setActiveOrder] = useState<any>(null);
  const { isFavourite, toggleFavourite, favouriteVendorIds } = useFavourites();

  // 1. Fetch user profile name
  useEffect(() => {
    if (!user) return;
    supabase
      .from('profiles')
      .select('full_name')
      .eq('user_id', user.id)
      .single()
      .then(({ data }) => {
        if (data?.full_name) {
          const first = data.full_name.trim().split(' ')[0];
          setUserName(first);
        }
      });
  }, [user]);

  // 2. Fetch active ongoing order for live banner
  useEffect(() => {
    if (!user) return;
    const fetchActiveOrder = async () => {
      try {
        const { data } = await supabase
          .from('orders')
          .select('id, status, total, delivery_location, vendor:vendors(name, logo_url)')
          .eq('student_id', user.id)
          .in('status', ['pending', 'accepted', 'preparing', 'ready', 'picked_up', 'delivering', 'arrived'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        setActiveOrder(data || null);
      } catch (err) {
        console.error('Error fetching active order:', err);
      }
    };

    fetchActiveOrder();

    const channel = supabase
      .channel('student-active-order-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `student_id=eq.${user.id}` },
        () => fetchActiveOrder()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // 3. Fetch vendors and menu items
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
    const tierWeights: Record<string, number> = { gold: 3, silver: 2, bronze: 1 };
    return list.sort((a, b) => {
      const aWeight = (a as any).featured_tier ? tierWeights[(a as any).featured_tier] || 1 : ((a as any).is_featured ? 1 : 0);
      const bWeight = (b as any).featured_tier ? tierWeights[(b as any).featured_tier] || 1 : ((b as any).is_featured ? 1 : 0);
      if (aWeight !== bWeight) return bWeight - aWeight;
      const aOpen = isVendorOpen(a.opening_time, a.closing_time, a.is_active);
      const bOpen = isVendorOpen(b.opening_time, b.closing_time, b.is_active);
      if (aOpen === bOpen) return 0;
      return aOpen ? -1 : 1;
    });
  }, [vendors, query, showFavourites, favouriteVendorIds]);

  const clearFilters = () => { setSearch(''); setSelectedCategory(null); };

  // Dynamic time greeting
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return { text: 'Good morning', icon: '☀️', mood: 'Ready for breakfast & hot coffee?' };
    if (hour >= 12 && hour < 17) return { text: 'Good afternoon', icon: '🍔', mood: 'Hungry? Grab lunch from campus favorites.' };
    if (hour >= 17 && hour < 22) return { text: 'Good evening', icon: '🍲', mood: 'Treat yourself to a delicious dinner.' };
    return { text: 'Late-night cravings?', icon: '🌙', mood: 'Midnight snacks & hot meals delivered to your spot.' };
  }, []);

  const getOrderStatusBadge = (status: string) => {
    switch (status) {
      case 'pending': return { text: 'Order Placed', color: 'bg-amber-500 text-white' };
      case 'accepted': return { text: 'Confirmed', color: 'bg-blue-500 text-white' };
      case 'preparing': return { text: 'Preparing Chow 🍳', color: 'bg-orange-500 text-white animate-pulse' };
      case 'ready': return { text: 'Ready for Pickup 📦', color: 'bg-emerald-500 text-white' };
      case 'picked_up':
      case 'delivering': return { text: 'Rider In Transit 🛵', color: 'bg-primary text-white animate-bounce' };
      case 'arrived': return { text: 'Rider Arrived! 📍', color: 'bg-green-600 text-white animate-pulse' };
      default: return { text: status, color: 'bg-muted text-foreground' };
    }
  };

  const VendorCard = ({ vendor }: { vendor: Vendor }) => {
    const open = isVendorOpen(vendor.opening_time, vendor.closing_time, vendor.is_active);
    const fav = isFavourite(vendor.id);
    return (
      <div className="relative group">
        <Link to={`/vendor/${vendor.id}`}>
          <Card className={`overflow-hidden premium-card transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${!open ? 'opacity-55 hover:translate-y-0 hover:border-border' : ''}`}>
            <div className="relative h-40 bg-muted flex items-center justify-center overflow-hidden">
              {(vendor as any).featured_tier && (
                <span className={`absolute top-2.5 left-2.5 z-10 rounded-full px-2.5 py-0.5 text-[10px] font-bold text-white shadow-md backdrop-blur-sm ${(vendor as any).featured_tier === 'gold' ? 'bg-amber-500' : (vendor as any).featured_tier === 'silver' ? 'bg-slate-500' : 'bg-amber-700'
                  }`}>
                  {(vendor as any).featured_tier === 'gold' ? '🥇 Gold Featured' : (vendor as any).featured_tier === 'silver' ? '🥈 Silver Featured' : '🥉 Featured'}
                </span>
              )}
              {vendor.logo_url ? (
                <img src={vendor.logo_url} alt={vendor.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
              ) : (
                <span className="text-4xl text-muted-foreground/40">🍽️</span>
              )}
              {!open && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/75 backdrop-blur-[2px]">
                  <span className="rounded-full border bg-background/90 px-3.5 py-1 text-xs font-semibold text-muted-foreground shadow-sm">
                    Closed Now
                  </span>
                </div>
              )}
            </div>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <h3 className="font-heading font-bold text-base truncate group-hover:text-primary transition-colors">
                    {vendor.name}
                  </h3>
                  <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                    {vendor.description || 'Verified food vendor & restaurant'}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground pt-2 border-t">
                <span className="flex items-center gap-1 font-semibold text-foreground">
                  <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" />
                  {vendor.rating && vendor.rating > 0 ? Number(vendor.rating).toFixed(1) : 'New'}
                </span>
                {vendor.opening_time && vendor.closing_time && (
                  <span className="flex items-center gap-1 text-[11px]">
                    <Clock className="h-3 w-3 text-muted-foreground/80" />
                    {formatTime(vendor.opening_time)} – {formatTime(vendor.closing_time)}
                  </span>
                )}
                {open ? (
                  <span className="ml-auto text-[11px] font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    Open
                  </span>
                ) : (
                  <span className="ml-auto text-[11px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                    Closed
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        </Link>
        {user && (
          <button
            onClick={(e) => { e.preventDefault(); toggleFavourite(vendor.id); }}
            className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-background/80 backdrop-blur-md shadow-md transition-all hover:scale-110 hover:bg-background"
          >
            <Heart className={`h-4 w-4 ${fav ? 'fill-red-500 text-red-500' : 'text-muted-foreground hover:text-foreground'}`} />
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <AppNavbar />
      <div className="container py-6 space-y-6 max-w-7xl">

        {/* 1. Active Live Order Tracker Banner (If student has an ongoing order) */}
        {activeOrder && (
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-orange-600 via-amber-600 to-primary p-4 text-white shadow-lg border border-orange-400/30 animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/20 backdrop-blur-md border border-white/30 text-xl shadow">
                  🛵
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-heading font-bold text-sm sm:text-base">
                      Live Delivery in Progress
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${getOrderStatusBadge(activeOrder.status).color}`}>
                      {getOrderStatusBadge(activeOrder.status).text}
                    </span>
                  </div>
                  <p className="text-xs text-white/90 mt-0.5">
                    Order from <span className="font-semibold">{activeOrder.vendor?.name || 'Vendor'}</span> • Delivering to <span className="font-semibold">{activeOrder.delivery_location || 'Campus'}</span>
                  </p>
                </div>
              </div>

              <Link to="/orders" className="shrink-0">
                <Button size="sm" className="w-full sm:w-auto bg-white text-orange-600 hover:bg-white/90 font-bold gap-1.5 shadow-md rounded-xl text-xs">
                  <span>Track Live Order</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>
          </div>
        )}

        {/* 2. Modern Enhanced Hero Banner */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-orange-500 to-amber-500 p-6 md:p-10 text-white shadow-2xl">
          {/* Subtle background ambient glows & ornaments */}
          <div className="absolute -right-16 -bottom-16 h-80 w-80 rounded-full bg-white/10 blur-3xl pointer-events-none" />
          <div className="absolute left-1/3 -top-16 h-56 w-56 rounded-full bg-amber-300/20 blur-2xl pointer-events-none" />
          <div className="absolute -left-10 bottom-0 h-40 w-40 rounded-full bg-orange-700/20 blur-2xl pointer-events-none" />

          <div className="relative z-10 max-w-2xl space-y-4">
            {/* Top Bar inside Hero: Campus Location Picker + Badge */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 backdrop-blur-md border border-white/25 text-xs font-semibold text-white">
                <Sparkles className="h-3.5 w-3.5 text-amber-200 fill-amber-200" />
                <span>Fastest Campus Delivery</span>
              </div>

              {/* Delivery Location Selector Pill */}
              <LocationSelectorModal />
            </div>

            {/* Personalized Greeting & Title */}
            <div>
              <p className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-amber-100/90 mb-1 flex items-center gap-1.5">
                <span>{greeting.icon}</span>
                <span>{greeting.text}{userName ? `, ${userName}` : ''}!</span>
              </p>
              <h1 className="font-heading text-2xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-[1.15]">
                Delicious Chow & Local Meals <span className="text-amber-200">Delivered Fast.</span>
              </h1>
              <p className="mt-2 text-xs sm:text-sm md:text-base text-white/90 max-w-xl leading-relaxed font-medium">
                {greeting.mood}
              </p>
            </div>

            {/* Integrated Search Bar with Quick Clear */}
            <div className="pt-2">
              <div className="relative max-w-xl flex items-center">
                <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search food, dishes, drinks, or restaurants..."
                  className="pl-11 pr-10 h-13 bg-white text-slate-900 placeholder:text-slate-400 rounded-2xl shadow-xl border-0 focus-visible:ring-2 focus-visible:ring-amber-300 font-medium text-sm sm:text-base transition-all"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
                {search && (
                  <button onClick={() => setSearch('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Quick Clickable Trending Tags */}
              <div className="mt-3 flex items-center gap-1.5 overflow-x-auto hide-scrollbar pb-1">
                <span className="text-[11px] font-semibold text-white/80 shrink-0 mr-1 flex items-center gap-1">
                  <Flame className="h-3 w-3 text-amber-300 fill-amber-300" /> Trending:
                </span>
                {TRENDING_TAGS.map(tag => (
                  <button
                    key={tag.label}
                    onClick={() => setSearch(tag.query)}
                    className="inline-flex items-center px-2.5 py-1 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur-md text-white border border-white/20 text-[11px] font-medium transition-colors shrink-0 shadow-sm"
                  >
                    {tag.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="hidden lg:flex absolute right-10 top-1/2 -translate-y-1/2 items-center justify-center text-8xl select-none pointer-events-none drop-shadow-2xl opacity-95 transition-transform hover:scale-105 duration-500">
            🍱
          </div>
        </div>

        {/* 3. Section Header & Category Filters */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Explore</p>
              <h2 className="font-heading text-xl font-bold tracking-tight">Available Vendors & Restaurants</h2>
            </div>
          </div>

          {/* Filter chips */}
          <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar pb-2 snap-x snap-mandatory">
            {user && (
              <Button
                size="sm"
                variant={showFavourites ? 'default' : 'outline'}
                className="rounded-full gap-1.5 h-8 text-xs shrink-0 snap-start shadow-sm"
                onClick={() => setShowFavourites(!showFavourites)}
              >
                <Heart className={`h-3.5 w-3.5 ${showFavourites ? 'fill-primary-foreground text-primary-foreground' : 'text-red-500'}`} />
                <span>Favourites ({favouriteVendorIds.size})</span>
              </Button>
            )}
            {categories.length > 0 && (
              <>
                <Button
                  size="sm"
                  variant={selectedCategory === null ? 'default' : 'outline'}
                  className="rounded-full h-8 text-xs shrink-0 snap-start shadow-sm"
                  onClick={() => setSelectedCategory(null)}
                >
                  All Menus
                </Button>
                {categories.map(cat => (
                  <Button
                    key={cat}
                    size="sm"
                    variant={selectedCategory === cat ? 'default' : 'outline'}
                    className="rounded-full h-8 text-xs shrink-0 snap-start shadow-sm"
                    onClick={() => setSelectedCategory(prev => prev === cat ? null : cat)}
                  >
                    {cat}
                  </Button>
                ))}
              </>
            )}
          </div>
        </div>

        {/* 4. Results Grid */}
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map(i => <VendorCardSkeleton key={i} />)}
          </div>
        ) : isSearching ? (
          filteredMenuItems.length === 0 ? (
            <EmptyState
              emoji="🔍"
              title="No results found"
              description="Try a different search keyword or food category"
              action={<Button variant="link" onClick={clearFilters}>Clear filters</Button>}
            />
          ) : (
            <div className="space-y-10">
              <p className="text-sm font-medium text-muted-foreground">
                Found <span className="font-bold text-foreground">{filteredMenuItems.length}</span> matching dish{filteredMenuItems.length !== 1 ? 'es' : ''}
              </p>
              {itemsByVendor.map(({ vendor, items }) => {
                const open = isVendorOpen(vendor.opening_time, vendor.closing_time, vendor.is_active);
                return (
                  <div key={vendor.id} className="space-y-3">
                    <Link to={`/vendor/${vendor.id}`} className="group inline-flex items-center gap-2.5 hover:underline">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted text-lg shadow-sm">
                        {vendor.logo_url ? <img src={vendor.logo_url} alt={vendor.name} className="h-full w-full rounded-xl object-cover" /> : '🍽️'}
                      </div>
                      <span className="font-heading font-bold text-base text-foreground group-hover:text-primary transition-colors">
                        {vendor.name}
                      </span>
                      {!open && <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">Closed</span>}
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                    </Link>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {items.map(item => (
                        <Link key={item.id} to={`/vendor/${vendor.id}`}>
                          <Card className={`overflow-hidden transition-all duration-200 hover:shadow-md hover:border-primary/50 ${!open ? 'opacity-60' : ''}`}>
                            <CardContent className="flex items-center gap-3 p-3.5">
                              {item.image_url ? (
                                <img src={item.image_url} alt={item.name} className="h-16 w-16 rounded-xl object-cover shrink-0" />
                              ) : (
                                <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-muted text-muted-foreground/40 text-2xl shrink-0">
                                  🍛
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <h4 className="font-semibold truncate text-sm text-foreground">{item.name}</h4>
                                <p className="text-xs text-muted-foreground truncate">{item.category}</p>
                                <p className="font-heading font-extrabold text-sm text-primary mt-1">
                                  ₦{Number(item.price).toLocaleString()}
                                </p>
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
            description={showFavourites ? 'Tap the heart icon on any vendor to save them here' : 'Check back soon for newly registered campus vendors'}
            action={showFavourites ? <Button variant="link" onClick={() => setShowFavourites(false)}>Browse all vendors</Button> : undefined}
          />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filteredVendors.map(vendor => <VendorCard key={vendor.id} vendor={vendor} />)}
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentDashboard;
