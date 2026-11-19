import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import AppNavbar from '@/components/layout/AppNavbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import {
  ArrowLeft,
  Plus,
  Minus,
  Star,
  Clock,
  AlertCircle,
  Heart,
  ShoppingBag,
  ArrowRight,
} from 'lucide-react';
import { isVendorOpen, formatTime } from '@/lib/vendorUtils';
import { useFavourites } from '@/hooks/useFavourites';
import { MenuItemSkeleton } from '@/components/Skeletons';
import EmptyState from '@/components/EmptyState';
import type { Database } from '@/integrations/supabase/types';

type Vendor = Database['public']['Tables']['vendors']['Row'];
type MenuItem = Database['public']['Tables']['menu_items']['Row'];

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  profiles?: { full_name: string } | null;
}

const VendorDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { items: cartItems, vendorId: cartVendorId, addItem, updateQuantity, clearCart, total, itemCount } = useCart();
  const { toast } = useToast();

  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingSwitchItem, setPendingSwitchItem] = useState<MenuItem | null>(null);
  const { isFavourite, toggleFavourite } = useFavourites();

  useEffect(() => {
    const fetch = async () => {
      if (!id) return;
      const [v, m, r] = await Promise.all([
        supabase.from('vendors').select('*').eq('id', id).single(),
        supabase
          .from('menu_items')
          .select('*')
          .eq('vendor_id', id)
          .eq('is_available', true)
          .order('category'),
        supabase
          .from('reviews')
          .select('id, rating, comment, created_at, user_id')
          .eq('vendor_id', id)
          .order('created_at', { ascending: false })
          .limit(20),
      ]);
      setVendor(v.data);
      setItems(m.data || []);

      const reviewData = r.data || [];
      if (reviewData.length > 0) {
        const userIds = [...new Set(reviewData.map((rev: any) => rev.user_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', userIds);
        const profileMap = new Map((profiles || []).map((p) => [p.user_id, p]));
        setReviews(
          reviewData.map((rev: any) => ({ ...rev, profiles: profileMap.get(rev.user_id) || null }))
        );
      }
      setLoading(false);
    };
    fetch();
  }, [id]);

  const handleAddItem = (item: MenuItem) => {
    // Check if cart has items from a different vendor
    if (cartVendorId && cartVendorId !== item.vendor_id && cartItems.length > 0) {
      setPendingSwitchItem(item);
      return;
    }
    addItem(item);
    toast({ title: `${item.name} added to cart 🛒` });
  };

  const confirmSwitchVendor = () => {
    if (!pendingSwitchItem) return;
    clearCart();
    addItem(pendingSwitchItem);
    toast({
      title: 'Started new order 🛒',
      description: `Added ${pendingSwitchItem.name} from ${vendor?.name || 'vendor'}`,
    });
    setPendingSwitchItem(null);
  };

  const getItemCartQty = (menuItemId: string): number => {
    const found = cartItems.find((ci) => ci.menuItem.id === menuItemId);
    return found ? found.quantity : 0;
  };

  const categories = items.reduce<Record<string, MenuItem[]>>((acc, item) => {
    (acc[item.category] = acc[item.category] || []).push(item);
    return acc;
  }, {});

  if (loading)
    return (
      <div className="min-h-screen bg-background">
        <AppNavbar />
        <div className="container py-8 space-y-4">
          <div className="h-6 w-32 animate-pulse rounded bg-muted" />
          <div className="h-28 animate-pulse rounded-xl bg-muted" />
          <div className="grid gap-3 sm:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <MenuItemSkeleton key={i} />
            ))}
          </div>
        </div>
      </div>
    );

  if (!vendor)
    return (
      <div className="min-h-screen bg-background">
        <AppNavbar />
        <EmptyState
          emoji="🔍"
          title="Vendor not found"
          description="This vendor may have been removed"
          action={
            <Link to="/dashboard">
              <Button>Back to vendors</Button>
            </Link>
          }
        />
      </div>
    );

  const open = isVendorOpen(vendor.opening_time, vendor.closing_time, vendor.is_active);
  const avgRating = vendor.rating && vendor.rating > 0 ? Number(vendor.rating).toFixed(1) : null;
  const fav = isFavourite(vendor.id);

  return (
    <div className="min-h-screen bg-background pb-36 md:pb-24">
      <AppNavbar />
      <div className="container py-8">
        <Link
          to="/dashboard"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>

        {/* Vendor Header */}
        <div className="mb-10">
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted text-2xl shrink-0 border shadow-sm overflow-hidden">
              {vendor.logo_url ? (
                <img
                  src={vendor.logo_url}
                  alt={vendor.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                '🍽️'
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="font-heading text-2xl font-bold tracking-tight truncate">
                  {vendor.name}
                </h1>
                {user && (
                  <button
                    onClick={() => toggleFavourite(vendor.id)}
                    className="rounded-full p-1.5 transition-colors hover:bg-muted shrink-0"
                  >
                    <Heart
                      className={`h-5 w-5 ${
                        fav ? 'fill-red-500 text-red-500' : 'text-muted-foreground'
                      }`}
                    />
                  </button>
                )}
              </div>
              <p className="text-muted-foreground text-sm">
                {vendor.description || 'Verified campus food vendor'}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1 font-semibold text-foreground">
                  <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" />
                  {avgRating || 'New'}
                  {vendor.total_reviews && vendor.total_reviews > 0 && (
                    <span className="text-muted-foreground font-normal">
                      ({vendor.total_reviews})
                    </span>
                  )}
                </span>
                {vendor.opening_time && vendor.closing_time && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatTime(vendor.opening_time)} – {formatTime(vendor.closing_time)}
                  </span>
                )}
                <span
                  className={`font-semibold text-xs px-2.5 py-0.5 rounded-full ${
                    open
                      ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/30'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {open ? 'Open & Accepting Orders' : 'Closed'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {!open && (
          <div className="mb-8 flex items-center gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
            <AlertCircle className="h-5 w-5 shrink-0 text-amber-500" />
            <div>
              <p className="font-semibold text-sm">This vendor is currently closed</p>
              <p className="text-xs text-muted-foreground">
                This store is currently not accepting orders. Check back when the vendor opens their
                store!
              </p>
            </div>
          </div>
        )}

        {/* Menu */}
        {items.length === 0 ? (
          <EmptyState
            emoji="📋"
            title="No menu items"
            description="This vendor hasn't added any items yet"
          />
        ) : (
          Object.entries(categories).map(([category, catItems]) => (
            <div key={category} className="mb-10">
              <h2 className="mb-4 text-sm font-bold uppercase tracking-widest text-muted-foreground">
                {category}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {catItems.map((item) => {
                  const qtyInCart = getItemCartQty(item.id);
                  return (
                    <Card
                      key={item.id}
                      className={`overflow-hidden glass-card transition-all group ${
                        qtyInCart > 0 ? 'ring-1 ring-primary/50 border-primary/40 bg-primary/5' : ''
                      }`}
                    >
                      <CardContent className="flex items-center justify-between p-4 gap-3.5">
                        {item.image_url ? (
                          <div className="h-20 w-20 shrink-0 rounded-xl overflow-hidden border border-primary/20 bg-muted/30 shadow-sm relative group-hover:scale-105 transition-transform duration-300">
                            <img
                              src={item.image_url}
                              alt={item.name}
                              className="h-full w-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="h-20 w-20 shrink-0 rounded-xl border border-primary/10 bg-gradient-to-br from-primary/10 to-amber-500/5 flex items-center justify-center text-2xl">
                            🍲
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-heading font-bold text-sm tracking-tight group-hover:text-primary transition-colors">
                            {item.name}
                          </h3>
                          {item.description && (
                            <p className="text-xs text-muted-foreground line-clamp-2 mt-1 leading-relaxed">
                              {item.description}
                            </p>
                          )}
                          <p className="mt-2 font-heading font-extrabold text-base text-primary">
                            ₦{Number(item.price).toLocaleString()}
                          </p>
                        </div>

                        {/* Inline +/- Stepper when already in cart */}
                        {qtyInCart > 0 ? (
                          <div className="flex items-center gap-1.5 shrink-0 bg-background rounded-full border border-primary/30 p-1 shadow-sm">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 rounded-full hover:bg-primary/10 text-primary"
                              onClick={() => updateQuantity(item.id, qtyInCart - 1)}
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </Button>
                            <span className="w-6 text-center text-xs font-extrabold text-foreground">
                              {qtyInCart}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 rounded-full hover:bg-primary/10 text-primary"
                              onClick={() => updateQuantity(item.id, qtyInCart + 1)}
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            className="shrink-0 rounded-full px-3.5 font-bold shadow-md gap-1"
                            onClick={() => handleAddItem(item)}
                            disabled={!open}
                          >
                            <Plus className="h-4 w-4" /> Add
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))
        )}

        {/* Reviews */}
        <div className="mt-4 mb-8">
          <h2 className="mb-4 text-sm font-medium uppercase tracking-widest text-muted-foreground">
            Reviews {avgRating && `· ${avgRating} avg`}
          </h2>

          {reviews.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No reviews yet</p>
          ) : (
            <div className="space-y-3">
              {reviews.map((review) => (
                <Card key={review.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-sm">
                          {review.profiles?.full_name || 'Anonymous'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(review.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            className={`h-3 w-3 ${
                              s <= review.rating
                                ? 'fill-amber-400 text-amber-500'
                                : 'text-muted-foreground/20'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                    {review.comment && (
                      <p className="mt-2 text-sm text-muted-foreground">{review.comment}</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Floating Sticky Checkout Bar (Chowdeck / Glovo style) */}
      {itemCount > 0 && (
        <div className="fixed bottom-16 md:bottom-6 left-0 right-0 z-40 px-4 pointer-events-none">
          <div className="max-w-lg mx-auto pointer-events-auto">
            <button
              type="button"
              onClick={() => navigate('/cart')}
              className="w-full flex items-center justify-between rounded-2xl bg-gradient-to-r from-primary via-orange-500 to-amber-500 text-white px-5 py-3.5 shadow-2xl shadow-orange-500/30 border border-white/20 transition-transform active:scale-[0.99] hover:brightness-105"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm font-extrabold text-sm">
                  {itemCount}
                </div>
                <div className="text-left">
                  <p className="text-xs font-medium text-white/90">
                    {cartVendorId === vendor.id ? 'Your Tray' : 'Active Tray'}
                  </p>
                  <p className="font-heading font-extrabold text-base leading-tight">
                    ₦{total.toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="inline-flex items-center gap-1.5 font-heading font-bold text-sm bg-white text-orange-600 px-4 py-2 rounded-xl shadow">
                <ShoppingBag className="h-4 w-4" />
                <span>Checkout</span>
                <ArrowRight className="h-4 w-4" />
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Vendor Switch Confirmation Dialog */}
      <AlertDialog
        open={!!pendingSwitchItem}
        onOpenChange={(open) => {
          if (!open) setPendingSwitchItem(null);
        }}
      >
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Start a new basket from {vendor.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Your cart currently contains items from another vendor. Starting a new order here will
              replace the existing items in your cart.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Keep Current Cart</AlertDialogCancel>
            <AlertDialogAction onClick={confirmSwitchVendor} className="rounded-xl">
              Start New Basket
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default VendorDetail;
