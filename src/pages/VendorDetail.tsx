import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import AppNavbar from '@/components/layout/AppNavbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Plus, Star, Clock, AlertCircle, Heart } from 'lucide-react';
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
  const { user } = useAuth();
  const { addItem } = useCart();
  const { toast } = useToast();
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const { isFavourite, toggleFavourite } = useFavourites();

  useEffect(() => {
    const fetch = async () => {
      if (!id) return;
      const [v, m, r] = await Promise.all([
        supabase.from('vendors').select('*').eq('id', id).single(),
        supabase.from('menu_items').select('*').eq('vendor_id', id).eq('is_available', true).order('category'),
        supabase.from('reviews').select('id, rating, comment, created_at, user_id').eq('vendor_id', id).order('created_at', { ascending: false }).limit(20),
      ]);
      setVendor(v.data);
      setItems(m.data || []);

      const reviewData = r.data || [];
      if (reviewData.length > 0) {
        const userIds = [...new Set(reviewData.map((rev: any) => rev.user_id))];
        const { data: profiles } = await supabase.from('profiles').select('user_id, full_name').in('user_id', userIds);
        const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));
        setReviews(reviewData.map((rev: any) => ({ ...rev, profiles: profileMap.get(rev.user_id) || null })));
      }
      setLoading(false);
    };
    fetch();
  }, [id]);

  const handleAddItem = (item: MenuItem) => {
    addItem(item);
    toast({ title: `${item.name} added to cart` });
  };

  const categories = items.reduce<Record<string, MenuItem[]>>((acc, item) => {
    (acc[item.category] = acc[item.category] || []).push(item);
    return acc;
  }, {});

  if (loading) return (
    <div className="min-h-screen bg-background">
      <AppNavbar />
      <div className="container py-8 space-y-4">
        <div className="h-6 w-32 animate-pulse rounded bg-muted" />
        <div className="h-28 animate-pulse rounded-xl bg-muted" />
        <div className="grid gap-3 sm:grid-cols-2">
          {[1, 2, 3, 4].map(i => <MenuItemSkeleton key={i} />)}
        </div>
      </div>
    </div>
  );

  if (!vendor) return (
    <div className="min-h-screen bg-background">
      <AppNavbar />
      <EmptyState emoji="🔍" title="Vendor not found" description="This vendor may have been removed" action={<Link to="/dashboard"><Button>Back to vendors</Button></Link>} />
    </div>
  );

  const open = isVendorOpen(vendor.opening_time, vendor.closing_time, vendor.is_active);
  const avgRating = vendor.rating && vendor.rating > 0 ? Number(vendor.rating).toFixed(1) : null;
  const fav = isFavourite(vendor.id);

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <AppNavbar />
      <div className="container py-8">
        <Link to="/dashboard" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>

        {/* Vendor Header */}
        <div className="mb-10">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-muted text-2xl shrink-0">
              {vendor.logo_url ? <img src={vendor.logo_url} alt={vendor.name} className="h-full w-full rounded-xl object-cover" /> : '🍽️'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="font-heading text-2xl font-bold tracking-tight truncate">{vendor.name}</h1>
                {user && (
                  <button onClick={() => toggleFavourite(vendor.id)} className="rounded-full p-1.5 transition-colors hover:bg-muted shrink-0">
                    <Heart className={`h-5 w-5 ${fav ? 'fill-foreground text-foreground' : 'text-muted-foreground'}`} />
                  </button>
                )}
              </div>
              <p className="text-muted-foreground text-sm">{vendor.description || 'Campus food vendor'}</p>
              <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Star className="h-3 w-3 fill-foreground text-foreground" />
                  {avgRating || 'New'}
                  {vendor.total_reviews && vendor.total_reviews > 0 && (
                    <span>({vendor.total_reviews})</span>
                  )}
                </span>
                <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatTime(vendor.opening_time)} – {formatTime(vendor.closing_time)}</span>
                <span className={`font-medium ${open ? 'text-foreground' : 'text-muted-foreground'}`}>{open ? 'Open' : 'Closed'}</span>
              </div>
            </div>
          </div>
        </div>

        {!open && (
          <div className="mb-8 flex items-center gap-3 rounded-xl border p-4">
            <AlertCircle className="h-5 w-5 shrink-0 text-muted-foreground" />
            <div>
              <p className="font-medium text-sm">This vendor is currently closed</p>
              <p className="text-xs text-muted-foreground">
                Hours: {formatTime(vendor.opening_time)} – {formatTime(vendor.closing_time)}
              </p>
            </div>
          </div>
        )}

        {/* Menu */}
        {items.length === 0 ? (
          <EmptyState emoji="📋" title="No menu items" description="This vendor hasn't added any items yet" />
        ) : (
          Object.entries(categories).map(([category, catItems]) => (
            <div key={category} className="mb-10">
              <h2 className="mb-4 text-sm font-medium uppercase tracking-widest text-muted-foreground">{category}</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {catItems.map(item => (
                  <Card key={item.id} className="overflow-hidden">
                    <CardContent className="flex items-center justify-between p-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-sm">{item.name}</h3>
                        {item.description && <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{item.description}</p>}
                        <p className="mt-1.5 font-heading font-bold text-sm">₦{Number(item.price).toLocaleString()}</p>
                      </div>
                      <Button size="sm" variant="outline" className="ml-4 shrink-0" onClick={() => handleAddItem(item)} disabled={!open}>
                        <Plus className="mr-1 h-3.5 w-3.5" /> Add
                      </Button>
                    </CardContent>
                  </Card>
                ))}
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
              {reviews.map(review => (
                <Card key={review.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-sm">{review.profiles?.full_name || 'Anonymous'}</p>
                        <p className="text-xs text-muted-foreground">{new Date(review.created_at).toLocaleDateString()}</p>
                      </div>
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map(s => (
                          <Star key={s} className={`h-3 w-3 ${s <= review.rating ? 'fill-foreground text-foreground' : 'text-muted-foreground/20'}`} />
                        ))}
                      </div>
                    </div>
                    {review.comment && <p className="mt-2 text-sm text-muted-foreground">{review.comment}</p>}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VendorDetail;
