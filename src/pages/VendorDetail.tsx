import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useCart } from '@/contexts/CartContext';
import AppNavbar from '@/components/layout/AppNavbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Plus, Star, Clock, AlertCircle, MessageSquare } from 'lucide-react';
import { isVendorOpen, formatTime } from '@/lib/vendorUtils';
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
  const { addItem } = useCart();
  const { toast } = useToast();
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

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

      // Fetch profile names for reviews
      const reviewData = r.data || [];
      if (reviewData.length > 0) {
        const userIds = [...new Set(reviewData.map((rev: any) => rev.user_id))];
        const { data: profiles } = await supabase.from('profiles').select('user_id, full_name').in('user_id', userIds);
        const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));
        setReviews(reviewData.map((rev: any) => ({
          ...rev,
          profiles: profileMap.get(rev.user_id) || null,
        })));
      }

      setLoading(false);
    };
    fetch();
  }, [id]);

  const handleAddItem = (item: MenuItem) => {
    addItem(item);
    toast({ title: `${item.name} added to cart 🛒` });
  };

  const categories = items.reduce<Record<string, MenuItem[]>>((acc, item) => {
    (acc[item.category] = acc[item.category] || []).push(item);
    return acc;
  }, {});

  if (loading) return <div className="flex min-h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  if (!vendor) return <div className="flex min-h-screen items-center justify-center"><p>Vendor not found</p></div>;

  const open = isVendorOpen(vendor.opening_time, vendor.closing_time, vendor.is_active);
  const avgRating = vendor.rating && vendor.rating > 0 ? Number(vendor.rating).toFixed(1) : null;

  return (
    <div className="min-h-screen bg-background">
      <AppNavbar />
      <div className="container py-6">
        <Link to="/dashboard" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to vendors
        </Link>

        {/* Vendor Header */}
        <div className="mb-8 rounded-2xl border bg-card p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-primary/10 text-3xl">
              {vendor.logo_url ? <img src={vendor.logo_url} alt={vendor.name} className="h-full w-full rounded-xl object-cover" /> : '🍽️'}
            </div>
            <div className="flex-1">
              <h1 className="font-heading text-2xl font-bold">{vendor.name}</h1>
              <p className="text-muted-foreground">{vendor.description || 'Delicious campus food'}</p>
              <div className="mt-2 flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Star className="h-4 w-4 fill-primary text-primary" />
                  {avgRating || 'New'}
                  {vendor.total_reviews && vendor.total_reviews > 0 && (
                    <span className="text-xs">({vendor.total_reviews} review{vendor.total_reviews !== 1 ? 's' : ''})</span>
                  )}
                </span>
                <span className="flex items-center gap-1"><Clock className="h-4 w-4" />{formatTime(vendor.opening_time)} - {formatTime(vendor.closing_time)}</span>
                <Badge variant={open ? 'default' : 'secondary'}>{open ? '🟢 Open' : 'Closed'}</Badge>
              </div>
            </div>
          </div>
        </div>

        {/* Closed banner */}
        {!open && (
          <div className="mb-6 flex items-center gap-3 rounded-xl border border-destructive/20 bg-destructive/5 p-4">
            <AlertCircle className="h-5 w-5 shrink-0 text-destructive" />
            <div>
              <p className="font-medium text-destructive">This vendor is currently closed</p>
              <p className="text-sm text-muted-foreground">
                Operating hours: {formatTime(vendor.opening_time)} - {formatTime(vendor.closing_time)}. You can browse the menu but ordering is unavailable.
              </p>
            </div>
          </div>
        )}

        {/* Menu */}
        {items.length === 0 ? (
          <p className="py-10 text-center text-muted-foreground">No menu items available</p>
        ) : (
          Object.entries(categories).map(([category, catItems]) => (
            <div key={category} className="mb-8">
              <h2 className="mb-3 font-heading text-lg font-semibold">{category}</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {catItems.map(item => (
                  <Card key={item.id} className="overflow-hidden">
                    <CardContent className="flex items-center justify-between p-4">
                      <div className="flex-1">
                        <h3 className="font-medium">{item.name}</h3>
                        {item.description && <p className="text-sm text-muted-foreground line-clamp-2">{item.description}</p>}
                        <p className="mt-1 font-heading font-bold text-primary">₦{Number(item.price).toLocaleString()}</p>
                      </div>
                      <Button size="sm" className="ml-4 shrink-0" onClick={() => handleAddItem(item)} disabled={!open}>
                        <Plus className="mr-1 h-4 w-4" /> Add
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))
        )}

        {/* Reviews Section */}
        <div className="mt-4 mb-8">
          <div className="mb-4 flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            <h2 className="font-heading text-lg font-semibold">
              Reviews
              {avgRating && <span className="ml-2 text-base font-normal text-muted-foreground">— {avgRating} ⭐</span>}
            </h2>
          </div>

          {reviews.length === 0 ? (
            <p className="py-6 text-center text-muted-foreground">No reviews yet. Be the first to review!</p>
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
                          <Star key={s} className={`h-3.5 w-3.5 ${s <= review.rating ? 'fill-primary text-primary' : 'text-muted-foreground/30'}`} />
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
    </div>
  );
};

export default VendorDetail;
