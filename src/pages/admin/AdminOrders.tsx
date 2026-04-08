import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type Order = Database['public']['Tables']['orders']['Row'];

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-500/10 text-yellow-700',
  accepted: 'bg-blue-500/10 text-blue-700',
  preparing: 'bg-purple-500/10 text-purple-700',
  ready: 'bg-cyan-500/10 text-cyan-700',
  picked_up: 'bg-indigo-500/10 text-indigo-700',
  delivering: 'bg-orange-500/10 text-orange-700',
  delivered: 'bg-green-500/10 text-green-700',
  cancelled: 'bg-red-500/10 text-red-700',
  rejected: 'bg-red-500/10 text-red-700',
};

const AdminOrders = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(500);
      setOrders(data || []);
      setLoading(false);
    };
    fetch();
  }, []);

  const filtered = orders.filter(o => {
    const matchSearch = o.id.includes(search) || o.delivery_location.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || o.status === statusFilter;
    return matchSearch && matchStatus;
  });

  if (loading) return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;

  return (
    <div>
      <h1 className="mb-6 font-heading text-2xl font-bold">All Orders</h1>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search by order ID or location..." className="pl-10" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="accepted">Accepted</SelectItem>
            <SelectItem value="preparing">Preparing</SelectItem>
            <SelectItem value="ready">Ready</SelectItem>
            <SelectItem value="picked_up">Picked Up</SelectItem>
            <SelectItem value="delivering">Delivering</SelectItem>
            <SelectItem value="delivered">Delivered</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <p className="mb-4 text-sm text-muted-foreground">{filtered.length} orders found</p>

      <div className="space-y-2">
        {filtered.map(order => (
          <Card key={order.id}>
            <CardContent className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex-1">
                <p className="font-medium">#{order.id.slice(0, 8)}</p>
                <p className="text-sm text-muted-foreground">
                  ₦{Number(order.total).toLocaleString()} · {order.delivery_location}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(order.created_at).toLocaleString()}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${statusColors[order.status] || ''}`}>
                  {order.status}
                </span>
                {order.rider_id && <Badge variant="outline">Rider assigned</Badge>}
              </div>
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && <p className="py-10 text-center text-muted-foreground">No orders found</p>}
      </div>
    </div>
  );
};

export default AdminOrders;
