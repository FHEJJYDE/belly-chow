import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import AppNavbar from '@/components/layout/AppNavbar';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, Star, Clock } from 'lucide-react';
import { isVendorOpen, formatTime } from '@/lib/vendorUtils';
import type { Database } from '@/integrations/supabase/types';

type Vendor = Database['public']['Tables']['vendors']['Row'];

const StudentDashboard = () => {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchVendors = async () => {
      const { data } = await supabase
        .from('vendors')
        .select('*')
        .eq('is_approved', true)
        .order('name');
      setVendors(data || []);
      setLoading(false);
    };
    fetchVendors();
  }, []);

  const filtered = vendors
    .filter(v => v.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const aOpen = isVendorOpen(a.opening_time, a.closing_time, a.is_active);
      const bOpen = isVendorOpen(b.opening_time, b.closing_time, b.is_active);
      if (aOpen === bOpen) return 0;
      return aOpen ? -1 : 1;
    });

  return (
    <div className="min-h-screen bg-background">
      <AppNavbar />
      <div className="container py-6">
        <h1 className="mb-1 font-heading text-2xl font-bold">What are you craving? 🍕</h1>
        <p className="mb-6 text-muted-foreground">Browse campus vendors and order now</p>

        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search vendors..."
            className="pl-10"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-48 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-lg text-muted-foreground">
              {search ? 'No vendors found' : 'No vendors available yet. Check back soon!'}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map(vendor => {
              const open = isVendorOpen(vendor.opening_time, vendor.closing_time, vendor.is_active);
              return (
                <Link key={vendor.id} to={`/vendor/${vendor.id}`}>
                  <Card className={`overflow-hidden transition-shadow hover:shadow-lg ${!open ? 'opacity-60' : ''}`}>
                    <div className="relative h-32 bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                      {vendor.logo_url ? (
                        <img src={vendor.logo_url} alt={vendor.name} className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-4xl">🍽️</span>
                      )}
                      {!open && (
                        <div className="absolute inset-0 flex items-center justify-center bg-background/60">
                          <span className="rounded-full bg-destructive/10 px-3 py-1 text-sm font-medium text-destructive">
                            Closed
                          </span>
                        </div>
                      )}
                    </div>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-heading font-semibold">{vendor.name}</h3>
                          <p className="text-sm text-muted-foreground line-clamp-1">{vendor.description || 'Delicious campus food'}</p>
                        </div>
                        <Badge variant={open ? 'default' : 'secondary'} className="shrink-0">
                          {open ? '🟢 Open' : 'Closed'}
                        </Badge>
                      </div>
                      <div className="mt-3 flex items-center gap-3 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Star className="h-3.5 w-3.5 fill-primary text-primary" />
                          {vendor.rating && vendor.rating > 0 ? Number(vendor.rating).toFixed(1) : 'New'}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {formatTime(vendor.opening_time)} - {formatTime(vendor.closing_time)}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentDashboard;
