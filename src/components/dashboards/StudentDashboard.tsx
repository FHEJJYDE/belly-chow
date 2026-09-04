import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import AppNavbar from '@/components/layout/AppNavbar';
import LocationSelectorModal from '@/components/location/LocationSelectorModal';
import WalletModal from '@/components/wallet/WalletModal';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  Search,
  Star,
  Clock,
  X,
  Heart,
  Sparkles,
  ArrowRight,
  Flame,
  ChevronRight,
  Wallet,
  Tag,
  Package,
  Plus,
  SlidersHorizontal,
  CheckCircle,
  Copy,
} from 'lucide-react';
import { isVendorOpen, formatTime } from '@/lib/vendorUtils';
import { useFavourites } from '@/hooks/useFavourites';
import { VendorCardSkeleton } from '@/components/Skeletons';
import EmptyState from '@/components/EmptyState';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';

type Vendor = Database['public']['Tables']['vendors']['Row'];
type MenuItem = Database['public']['Tables']['menu_items']['Row'];
type MenuItemWithVendor = MenuItem & { vendor: Pick<Vendor, 'id' | 'name' | 'logo_url' | 'opening_time' | 'closing_time' | 'is_active'> };

interface TrendingItem {
  name: string;
  count: number;
}

interface RecentOrderedItem {
  menu_item_id: string;
  name: string;
  price: number;
  image_url: string | null;
  category: string;
  vendor_id: string;
  vendor_name: string;
  menu_item_obj: MenuItem;
}

interface PromoCode {
  id: string;
  code: string;
  discount_amount: number;
  min_order: number;
}

const StudentDashboard = () => {
  const { user } = useAuth();
  const { addItem } = useCart();
  const { toast } = useToast();

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItemWithVendor[]>([]);
  const [trendingMeals, setTrendingMeals] = useState<TrendingItem[]>([]);
  const [recentDishes, setRecentDishes] = useState<RecentOrderedItem[]>([]);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);

  // Search & Filters state
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [filterOpenOnly, setFilterOpenOnly] = useState(false);
  const [filterTopRated, setFilterTopRated] = useState(false);
  const [showFavourites, setShowFavourites] = useState(false);
  const [sortBy, setSortBy] = useState<'default' | 'rating' | 'name'>('default');

  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState<string>('');
  const [activeOrder, setActiveOrder] = useState<any>(null);
  const { isFavourite, toggleFavourite, favouriteVendorIds } = useFavourites();

  // 1. Fetch user profile & first name
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

  // 2. Fetch live wallet balance
  useEffect(() => {
    if (!user) return;
    const fetchWallet = async () => {
      const { data } = await supabase
        .from('wallets')
        .select('balance')
        .eq('user_id', user.id)
        .maybeSingle();
      if (data) setWalletBalance(Number(data.balance) || 0);
    };
    fetchWallet();

    const channel = supabase
      .channel('student-wallet-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'wallets', filter: `user_id=eq.${user.id}` },
        (payload: any) => {
          if (payload.new?.balance !== undefined) {
            setWalletBalance(Number(payload.new.balance));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // 3. Fetch active promo codes
  useEffect(() => {
    supabase
      .from('promo_codes')
      .select('id, code, discount_amount, min_order')
      .eq('is_active', true)
      .limit(6)
      .then(({ data }) => {
        if (data) setPromoCodes(data as any);
      });
  }, []);

  // 4. Fetch active ongoing order for live tracker
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

  // 5. Fetch vendors and menu items
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

  // 6. Fetch authentic most ordered meals
  useEffect(() => {
    const fetchMostOrderedMeals = async () => {
      try {
        const { data: orderItemsData, error } = await supabase
          .from('order_items')
          .select('menu_item_id, quantity, menu_items(id, name, is_available)')
          .limit(250);

        if (!error && orderItemsData && orderItemsData.length > 0) {
          const counts: Record<string, { name: string; count: number }> = {};

          orderItemsData.forEach((item: any) => {
            const mealName = item.menu_items?.name;
            if (!mealName) return;
            const qty = Number(item.quantity) || 1;
            if (!counts[mealName]) {
              counts[mealName] = { name: mealName, count: 0 };
            }
            counts[mealName].count += qty;
          });

          const sorted = Object.values(counts)
            .sort((a, b) => b.count - a.count)
            .slice(0, 8);

          if (sorted.length > 0) {
            setTrendingMeals(sorted);
            return;
          }
        }

        if (menuItems.length > 0) {
          const uniqueNames = Array.from(new Set(menuItems.map(m => m.name))).slice(0, 7);
          setTrendingMeals(uniqueNames.map(name => ({ name, count: 0 })));
        } else {
          setTrendingMeals([
            { name: 'Jollof Rice', count: 0 },
            { name: 'Crispy Fried Chicken', count: 0 },
            { name: 'Beef Burger & Fries', count: 0 },
            { name: 'Chicken Shawarma', count: 0 },
            { name: 'Drinks & Smoothies', count: 0 },
          ]);
        }
      } catch (err) {
        console.error('Error fetching trending meals:', err);
      }
    };

    fetchMostOrderedMeals();
  }, [menuItems]);

  // 7. Fetch "Order Again" past dishes for the logged in student
  useEffect(() => {
    if (!user) return;
    const fetchRecentOrders = async () => {
      try {
        const { data: userOrders } = await supabase
          .from('orders')
          .select('id, created_at, vendor:vendors(id, name)')
          .eq('student_id', user.id)
          .in('status', ['delivered', 'arrived', 'picked_up', 'delivering', 'ready', 'preparing'])
          .order('created_at', { ascending: false })
          .limit(10);

        if (userOrders && userOrders.length > 0) {
          const orderIds = userOrders.map(o => o.id);
          const { data: itemsData } = await supabase
            .from('order_items')
            .select('menu_item_id, price, menu_items(*, vendor:vendors(name))')
            .in('order_id', orderIds)
            .limit(30);

          if (itemsData && itemsData.length > 0) {
            const seen = new Set<string>();
            const uniqueList: RecentOrderedItem[] = [];

            itemsData.forEach((item: any) => {
              if (!item.menu_items || seen.has(item.menu_items.id)) return;
              seen.add(item.menu_items.id);
              uniqueList.push({
                menu_item_id: item.menu_items.id,
                name: item.menu_items.name,
                price: Number(item.menu_items.price || item.price),
                image_url: item.menu_items.image_url,
                category: item.menu_items.category || 'General',
                vendor_id: item.menu_items.vendor_id,
                vendor_name: (item.menu_items as any).vendor?.name || 'Campus Vendor',
                menu_item_obj: item.menu_items,
              });
            });

            setRecentDishes(uniqueList.slice(0, 8));
          }
        }
      } catch (err) {
        console.error('Error fetching recent dishes for reorder:', err);
      }
    };

    fetchRecentOrders();
  }, [user]);

  // Categories with counts
  const categoryStats = useMemo(() => {
    const map = new Map<string, number>();
    menuItems.forEach(item => {
      const cat = item.category || 'General';
      map.set(cat, (map.get(cat) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
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

  // Featured Vendors (Gold & Silver tiers)
  const featuredVendors = useMemo(() => {
    return vendors.filter(v => (v as any).featured_tier || (v as any).is_featured);
  }, [vendors]);

  // Filtered & Sorted Vendors
  const filteredVendors = useMemo(() => {
    let list = vendors.filter(v => v.name.toLowerCase().includes(query));

    if (showFavourites) {
      list = list.filter(v => favouriteVendorIds.has(v.id));
    }

    if (filterOpenOnly) {
      list = list.filter(v => isVendorOpen(v.opening_time, v.closing_time, v.is_active));
    }

    if (filterTopRated) {
      list = list.filter(v => Number(v.rating || 0) >= 4.5);
    }

    const tierWeights: Record<string, number> = { gold: 3, silver: 2, bronze: 1 };

    return list.sort((a, b) => {
      if (sortBy === 'rating') {
        return Number(b.rating || 0) - Number(a.rating || 0);
      }
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name);
      }

      // Default: Featured tier weight -> Open status
      const aWeight = (a as any).featured_tier ? tierWeights[(a as any).featured_tier] || 1 : ((a as any).is_featured ? 1 : 0);
      const bWeight = (b as any).featured_tier ? tierWeights[(b as any).featured_tier] || 1 : ((b as any).is_featured ? 1 : 0);
      if (aWeight !== bWeight) return bWeight - aWeight;

      const aOpen = isVendorOpen(a.opening_time, a.closing_time, a.is_active);
      const bOpen = isVendorOpen(b.opening_time, b.closing_time, b.is_active);
      if (aOpen === bOpen) return 0;
      return aOpen ? -1 : 1;
    });
  }, [vendors, query, showFavourites, filterOpenOnly, filterTopRated, sortBy, favouriteVendorIds]);

  const clearFilters = () => {
    setSearch('');
    setSelectedCategory(null);
    setFilterOpenOnly(false);
    setFilterTopRated(false);
    setShowFavourites(false);
  };

  const handle1ClickReorder = (dish: RecentOrderedItem) => {
    addItem(dish.menu_item_obj);
    toast({
      title: 'Added to Cart! 🛒',
      description: `${dish.name} added to your tray`,
    });
  };

  const getCategoryVisual = (cat: string) => {
    const lower = cat.toLowerCase();
    if (lower.includes('rice') || lower.includes('pasta') || lower.includes('spag')) return { icon: '🍚', color: 'from-amber-500/15 to-orange-500/15 text-orange-600 border-orange-500/20' };
    if (lower.includes('chicken') || lower.includes('meat') || lower.includes('grill') || lower.includes('suya')) return { icon: '🍗', color: 'from-red-500/15 to-orange-500/15 text-red-600 border-red-500/20' };
    if (lower.includes('burger') || lower.includes('sandwich') || lower.includes('fast')) return { icon: '🍔', color: 'from-yellow-500/15 to-amber-500/15 text-amber-600 border-amber-500/20' };
    if (lower.includes('drink') || lower.includes('smoothie') || lower.includes('juice') || lower.includes('boba')) return { icon: '🥤', color: 'from-blue-500/15 to-cyan-500/15 text-blue-600 border-blue-500/20' };
    if (lower.includes('soup') || lower.includes('swallow') || lower.includes('local') || lower.includes('amala')) return { icon: '🍲', color: 'from-emerald-500/15 to-teal-500/15 text-emerald-600 border-emerald-500/20' };
    if (lower.includes('pastry') || lower.includes('snack') || lower.includes('bake') || lower.includes('cake')) return { icon: '🥐', color: 'from-pink-500/15 to-rose-500/15 text-pink-600 border-pink-500/20' };
    if (lower.includes('shawarma') || lower.includes('wrap')) return { icon: '🌯', color: 'from-orange-500/15 to-amber-500/15 text-orange-600 border-orange-500/20' };
    if (lower.includes('salad') || lower.includes('veg') || lower.includes('fruit')) return { icon: '🥗', color: 'from-green-500/15 to-emerald-500/15 text-green-600 border-green-500/20' };
    return { icon: '🍽️', color: 'from-primary/15 to-amber-500/15 text-primary border-primary/20' };
  };

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return { text: 'Good morning', icon: '☀️', mood: 'Ready for breakfast & hot coffee?' };
    if (hour >= 12 && hour < 17) return { text: 'Good afternoon', icon: '🍔', mood: 'Hungry? Grab lunch from campus favorites.' };
    if (hour >= 17 && hour < 22) return { text: 'Good evening', icon: '🍲', mood: 'Treat yourself to a delicious dinner.' };
    return { text: 'Late-night cravings?', icon: '🌙', mood: 'Midnight snacks & hot meals delivered to your hostel.' };
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
          <Card className={`overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${!open ? 'opacity-55 hover:translate-y-0 hover:border-border' : ''}`}>
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
                    {vendor.description || 'Verified campus food vendor & restaurant'}
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
    <div className="min-h-screen bg-background pb-24 md:pb-8">
      {/* 1. APP HEADER / NAVBAR */}
      <AppNavbar />

      <div className="container py-6 space-y-7 max-w-7xl">

        {/* 2. ACTIVE LIVE ORDER TRACKER (If ongoing delivery) */}
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

        {/* 3. DYNAMIC HERO SECTION */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-orange-500 to-amber-500 p-6 md:p-10 text-white shadow-2xl">
          <div className="absolute -right-16 -bottom-16 h-80 w-80 rounded-full bg-white/10 blur-3xl pointer-events-none" />
          <div className="absolute left-1/3 -top-16 h-56 w-56 rounded-full bg-amber-300/20 blur-2xl pointer-events-none" />
          <div className="absolute -left-10 bottom-0 h-40 w-40 rounded-full bg-orange-700/20 blur-2xl pointer-events-none" />

          <div className="relative z-10 max-w-2xl space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 backdrop-blur-md border border-white/25 text-xs font-semibold text-white">
                <Sparkles className="h-3.5 w-3.5 text-amber-200 fill-amber-200" />
                <span>Fastest Campus Delivery</span>
              </div>

              {/* Delivery Location Selector Pill */}
              <LocationSelectorModal />
            </div>

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

              {/* Authentic Most Ordered Food Tags */}
              {trendingMeals.length > 0 && (
                <div className="mt-3 flex items-center gap-1.5 overflow-x-auto hide-scrollbar pb-1">
                  <span className="text-[11px] font-semibold text-white/90 shrink-0 mr-1 flex items-center gap-1">
                    <Flame className="h-3.5 w-3.5 text-amber-300 fill-amber-300 animate-pulse" /> Most Ordered:
                  </span>
                  {trendingMeals.map(meal => (
                    <button
                      key={meal.name}
                      onClick={() => setSearch(meal.name)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur-md text-white border border-white/20 text-[11px] font-medium transition-colors shrink-0 shadow-sm"
                    >
                      <span>🔥 {meal.name}</span>
                      {meal.count > 0 && (
                        <span className="text-[9px] bg-amber-400/30 text-amber-100 px-1.5 py-0.2 rounded-full font-bold">
                          {meal.count} orders
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="hidden lg:flex absolute right-10 top-1/2 -translate-y-1/2 items-center justify-center text-8xl select-none pointer-events-none drop-shadow-2xl opacity-95 transition-transform hover:scale-105 duration-500">
            🍱
          </div>
        </div>

        {/* 4. QUICK ACTION & WALLET BAR */}
        {user && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Wallet Snippet */}
            <div className="rounded-2xl border bg-card p-3.5 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow">
              <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground uppercase font-semibold">Wallet Balance</p>
                <p className="font-heading font-extrabold text-base sm:text-lg truncate text-foreground">
                  ₦{walletBalance !== null ? Number(walletBalance).toLocaleString() : '0.00'}
                </p>
              </div>
              <WalletModal />
            </div>

            {/* Past Orders Link */}
            <Link to="/orders" className="rounded-2xl border bg-card p-3.5 flex items-center justify-between shadow-sm hover:shadow-md transition-all group">
              <div>
                <p className="text-[11px] text-muted-foreground uppercase font-semibold">Order History</p>
                <p className="font-heading font-bold text-sm sm:text-base group-hover:text-primary transition-colors">
                  My Orders
                </p>
              </div>
              <div className="h-9 w-9 rounded-xl bg-orange-500/10 flex items-center justify-center text-primary group-hover:scale-105 transition-transform">
                <Package className="h-4.5 w-4.5" />
              </div>
            </Link>

            {/* Promo Codes Dialog */}
            <Dialog>
              <DialogTrigger asChild>
                <button className="rounded-2xl border bg-card p-3.5 flex items-center justify-between text-left shadow-sm hover:shadow-md transition-all group">
                  <div>
                    <p className="text-[11px] text-muted-foreground uppercase font-semibold">Discounts</p>
                    <p className="font-heading font-bold text-sm sm:text-base group-hover:text-primary transition-colors">
                      Claim Promos
                    </p>
                  </div>
                  <div className="h-9 w-9 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600 group-hover:scale-105 transition-transform">
                    <Tag className="h-4.5 w-4.5" />
                  </div>
                </button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[440px] rounded-2xl">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Tag className="h-5 w-5 text-primary" /> Active Campus Promos
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-3 py-2">
                  {promoCodes.length === 0 ? (
                    <p className="text-center text-sm text-muted-foreground py-6">
                      No active discount codes available right now. Check back during lunch rush!
                    </p>
                  ) : (
                    promoCodes.map(p => (
                      <div key={p.id} className="flex items-center justify-between p-3 rounded-xl border bg-muted/30">
                        <div>
                          <p className="font-heading font-bold text-base text-primary tracking-wider">{p.code}</p>
                          <p className="text-xs text-muted-foreground">
                            ₦{Number(p.discount_amount).toLocaleString()} OFF {p.min_order > 0 ? `orders above ₦${Number(p.min_order).toLocaleString()}` : 'your order'}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1 rounded-lg text-xs"
                          onClick={() => {
                            navigator.clipboard.writeText(p.code);
                            toast({ title: 'Promo copied! 📋', description: `Code ${p.code} copied to clipboard` });
                          }}
                        >
                          <Copy className="h-3 w-3" /> Copy
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </DialogContent>
            </Dialog>

            {/* Quick Favorites shortcut */}
            <button
              onClick={() => setShowFavourites(!showFavourites)}
              className={`rounded-2xl border p-3.5 flex items-center justify-between text-left shadow-sm hover:shadow-md transition-all group ${
                showFavourites ? 'bg-primary/10 border-primary text-primary' : 'bg-card'
              }`}
            >
              <div>
                <p className="text-[11px] text-muted-foreground uppercase font-semibold">Saved Spots</p>
                <p className="font-heading font-bold text-sm sm:text-base">
                  {showFavourites ? 'Viewing Favourites' : 'My Favourites'}
                </p>
              </div>
              <div className="h-9 w-9 rounded-xl bg-red-500/10 flex items-center justify-center text-red-500 group-hover:scale-105 transition-transform">
                <Heart className={`h-4.5 w-4.5 ${showFavourites ? 'fill-red-500' : ''}`} />
              </div>
            </button>
          </div>
        )}

        {/* 5. VISUAL CATEGORIES (Scrollable Icon Cards with badges) */}
        {!isSearching && categoryStats.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Browse by Menu</p>
                <h2 className="font-heading text-lg sm:text-xl font-bold tracking-tight">Food Categories</h2>
              </div>
              {selectedCategory && (
                <button
                  onClick={() => setSelectedCategory(null)}
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  Show All
                </button>
              )}
            </div>

            <div className="flex items-center gap-3 overflow-x-auto hide-scrollbar pb-2 snap-x">
              {categoryStats.map(({ name, count }) => {
                const isSelected = selectedCategory === name;
                const visual = getCategoryVisual(name);
                return (
                  <button
                    key={name}
                    onClick={() => setSelectedCategory(prev => prev === name ? null : name)}
                    className={`flex flex-col items-center justify-center p-3.5 rounded-2xl border transition-all duration-200 shrink-0 w-28 text-center snap-start select-none ${
                      isSelected
                        ? 'bg-primary text-primary-foreground border-primary shadow-lg shadow-orange-500/20 scale-105 ring-2 ring-primary/30'
                        : 'bg-card hover:bg-muted/60 text-foreground shadow-sm hover:border-primary/40'
                    }`}
                  >
                    <span className="text-3xl mb-1.5 filter drop-shadow-sm">{visual.icon}</span>
                    <span className="font-semibold text-xs truncate max-w-full leading-tight">
                      {name}
                    </span>
                    <span className={`text-[10px] mt-1 px-2 py-0.5 rounded-full font-bold ${
                      isSelected ? 'bg-primary-foreground/20 text-white' : 'bg-muted text-muted-foreground'
                    }`}>
                      {count} items
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 6. "ORDER AGAIN" / RECENT DISHES (Horizontal Carousel) */}
        {!isSearching && user && recentDishes.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Fast Reorder</p>
                <h2 className="font-heading text-lg sm:text-xl font-bold tracking-tight">Order Again ⚡</h2>
              </div>
            </div>

            <div className="flex items-center gap-3.5 overflow-x-auto hide-scrollbar pb-2 snap-x">
              {recentDishes.map(dish => (
                <div
                  key={dish.menu_item_id}
                  className="rounded-2xl border bg-card p-3 shadow-sm hover:shadow-md transition-all shrink-0 w-64 snap-start flex flex-col justify-between"
                >
                  <div className="flex items-start gap-3">
                    {dish.image_url ? (
                      <img src={dish.image_url} alt={dish.name} className="h-16 w-16 rounded-xl object-cover shrink-0" />
                    ) : (
                      <div className="h-16 w-16 rounded-xl bg-muted flex items-center justify-center text-2xl shrink-0">
                        🍲
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-heading font-bold text-sm truncate text-foreground">{dish.name}</h4>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{dish.vendor_name}</p>
                      <p className="font-extrabold text-sm text-primary mt-1">₦{dish.price.toLocaleString()}</p>
                    </div>
                  </div>

                  <Button
                    onClick={() => handle1ClickReorder(dish)}
                    size="sm"
                    className="w-full mt-3 rounded-xl h-8 text-xs font-bold gap-1 shadow-sm"
                  >
                    <Plus className="h-3.5 w-3.5" /> Reorder 1-Click
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 7. FEATURED & SPONSORED VENDORS (Gold / Silver Highlights) */}
        {!isSearching && featuredVendors.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-amber-500 font-bold flex items-center gap-1">
                  <Sparkles className="h-3.5 w-3.5" /> Campus Favorites
                </p>
                <h2 className="font-heading text-lg sm:text-xl font-bold tracking-tight">Featured Restaurants</h2>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {featuredVendors.slice(0, 3).map(vendor => (
                <VendorCard key={vendor.id} vendor={vendor} />
              ))}
            </div>
          </div>
        )}

        {/* 8. ALL VENDORS & EXPLORE (Filters: Open Now, Top Rated, Price, Sort) */}
        <div className="space-y-4 pt-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">All Spots</p>
              <h2 className="font-heading text-xl font-bold tracking-tight">Available Vendors & Kitchens</h2>
            </div>

            {/* Smart Filters & Sort */}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant={filterOpenOnly ? 'default' : 'outline'}
                className="rounded-full text-xs h-8 gap-1.5 shadow-sm"
                onClick={() => setFilterOpenOnly(!filterOpenOnly)}
              >
                <span className={`h-2 w-2 rounded-full ${filterOpenOnly ? 'bg-white' : 'bg-emerald-500'}`} />
                <span>Open Now</span>
              </Button>

              <Button
                size="sm"
                variant={filterTopRated ? 'default' : 'outline'}
                className="rounded-full text-xs h-8 gap-1 shadow-sm"
                onClick={() => setFilterTopRated(!filterTopRated)}
              >
                <Star className={`h-3 w-3 ${filterTopRated ? 'fill-white' : 'fill-amber-400 text-amber-500'}`} />
                <span>Top Rated (4.5+)</span>
              </Button>

              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as any)}
                className="h-8 rounded-full border border-input bg-card px-3 text-xs font-medium shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
              >
                <option value="default">Default Sort</option>
                <option value="rating">Highest Rated</option>
                <option value="name">Name (A–Z)</option>
              </select>
            </div>
          </div>

          {/* Results View */}
          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map(i => <VendorCardSkeleton key={i} />)}
            </div>
          ) : isSearching ? (
            filteredMenuItems.length === 0 ? (
              <EmptyState
                emoji="🔍"
                title="No results found"
                description="Try a different search keyword or clear category filters"
                action={<Button variant="link" onClick={clearFilters}>Clear all filters</Button>}
              />
            ) : (
              <div className="space-y-10">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-muted-foreground">
                    Found <span className="font-bold text-foreground">{filteredMenuItems.length}</span> matching dish{filteredMenuItems.length !== 1 ? 'es' : ''}
                  </p>
                  <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs h-7 text-primary">
                    Clear Search
                  </Button>
                </div>
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
              title={showFavourites ? 'No favourite vendors yet' : 'No vendors matching your filters'}
              description={showFavourites ? 'Tap the heart icon on any vendor to save them here' : 'Try toggling off "Open Now" or clearing filter options'}
              action={<Button variant="link" onClick={clearFilters}>Reset filters</Button>}
            />
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {filteredVendors.map(vendor => <VendorCard key={vendor.id} vendor={vendor} />)}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default StudentDashboard;
