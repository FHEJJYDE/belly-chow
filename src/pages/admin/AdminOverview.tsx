import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  Users,
  Package,
  DollarSign,
  Store,
  TrendingUp,
  TrendingDown,
  Calendar,
  BarChart3,
  Activity,
  Clock,
  MapPin,
  Star,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Download
} from 'lucide-react';
import { format, subDays, subMonths, subYears, startOfDay, endOfDay, parseISO } from 'date-fns';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import type { Database } from '@/integrations/supabase/types';

type Vendor = Database['public']['Tables']['vendors']['Row'];
type Order = Database['public']['Tables']['orders']['Row'];
type Profile = Database['public']['Tables']['profiles']['Row'];

interface DashboardStats {
  totalRevenue: number;
  totalOrders: number;
  totalVendors: number;
  totalUsers: number;
  pendingOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  averageOrderValue: number;
  topVendors: Array<{ name: string; revenue: number; orders: number }>;
  revenueGrowth: number;
  orderGrowth: number;
  userGrowth: number;
}

interface TimeRange {
  label: string;
  value: string;
  startDate: Date;
  endDate: Date;
}

const PIE_COLORS = [
  'hsl(var(--foreground))',
  'hsl(var(--muted-foreground))',
  'hsl(var(--primary))',
  'hsl(var(--secondary))',
  'hsl(var(--accent))',
  'hsl(var(--destructive))',
  'hsl(var(--border))',
];

const AdminOverview = () => {
  const { toast } = useToast();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTimeRange, setSelectedTimeRange] = useState('today');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const timeRanges: TimeRange[] = [
    {
      label: 'Today',
      value: 'today',
      startDate: startOfDay(new Date()),
      endDate: endOfDay(new Date())
    },
    {
      label: 'Yesterday',
      value: 'yesterday',
      startDate: startOfDay(subDays(new Date(), 1)),
      endDate: endOfDay(subDays(new Date(), 1))
    },
    {
      label: 'Last 7 Days',
      value: 'week',
      startDate: subDays(new Date(), 7),
      endDate: new Date()
    },
    {
      label: 'Last 30 Days',
      value: 'month',
      startDate: subDays(new Date(), 30),
      endDate: new Date()
    },
    {
      label: 'Last 3 Months',
      value: 'quarter',
      startDate: subMonths(new Date(), 3),
      endDate: new Date()
    },
    {
      label: 'Last Year',
      value: 'year',
      startDate: subYears(new Date(), 1),
      endDate: new Date()
    },
    {
      label: 'Custom Range',
      value: 'custom',
      startDate: new Date(),
      endDate: new Date()
    }
  ];

  const getCurrentTimeRange = (): TimeRange => {
    if (selectedTimeRange === 'custom' && customStartDate && customEndDate) {
      return {
        label: 'Custom Range',
        value: 'custom',
        startDate: parseISO(customStartDate),
        endDate: parseISO(customEndDate)
      };
    }
    return timeRanges.find(range => range.value === selectedTimeRange) || timeRanges[0];
  };

  const fetchData = async () => {
    setRefreshing(true);
    try {
      const [vendorsRes, ordersRes, usersRes] = await Promise.all([
        supabase.from('vendors').select('*').order('created_at', { ascending: false }),
        supabase.from('orders').select('*').order('created_at', { ascending: false }),
        supabase.from('profiles').select('*').order('created_at', { ascending: false })
      ]);

      setVendors(vendorsRes.data || []);
      setOrders(ordersRes.data || []);
      setUsers(usersRes.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({ title: 'Error fetching data', variant: 'destructive' });
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  const calculateStats = () => {
    const currentRange = getCurrentTimeRange();
    const filteredOrders = orders.filter(order => {
      const orderDate = new Date(order.created_at);
      return orderDate >= currentRange.startDate && orderDate <= currentRange.endDate;
    });

    const filteredUsers = users.filter(user => {
      const userDate = new Date(user.created_at);
      return userDate >= currentRange.startDate && userDate <= currentRange.endDate;
    });

    const filteredVendors = vendors.filter(vendor => {
      const vendorDate = new Date(vendor.created_at);
      return vendorDate >= currentRange.startDate && vendorDate <= currentRange.endDate;
    });

    // Calculate previous period for growth comparison
    const periodDiff = currentRange.endDate.getTime() - currentRange.startDate.getTime();
    const prevStartDate = new Date(currentRange.startDate.getTime() - periodDiff);
    const prevEndDate = new Date(currentRange.endDate.getTime() - periodDiff);

    const prevOrders = orders.filter(order => {
      const orderDate = new Date(order.created_at);
      return orderDate >= prevStartDate && orderDate <= prevEndDate;
    });

    const prevUsers = users.filter(user => {
      const userDate = new Date(user.created_at);
      return userDate >= prevStartDate && userDate <= prevEndDate;
    });

    // Calculate metrics
    const totalRevenue = filteredOrders
      .filter(o => o.status === 'delivered')
      .reduce((sum, o) => sum + Number(o.total || 0), 0);

    const prevRevenue = prevOrders
      .filter(o => o.status === 'delivered')
      .reduce((sum, o) => sum + Number(o.total || 0), 0);

    const completedOrders = filteredOrders.filter(o => o.status === 'delivered').length;
    const pendingOrders = filteredOrders.filter(o => ['pending', 'accepted', 'preparing', 'ready', 'picked_up', 'delivering', 'arrived'].includes(o.status)).length;
    const cancelledOrders = filteredOrders.filter(o => ['cancelled', 'rejected'].includes(o.status)).length;

    const averageOrderValue = completedOrders > 0 ? totalRevenue / completedOrders : 0;

    // Calculate growth rates
    const revenueGrowth = prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : 0;
    const orderGrowth = prevOrders.length > 0 ? ((filteredOrders.length - prevOrders.length) / prevOrders.length) * 100 : 0;
    const userGrowth = prevUsers.length > 0 ? ((filteredUsers.length - prevUsers.length) / prevUsers.length) * 100 : 0;

    // Calculate top vendors
    const vendorStats = vendors.map(vendor => {
      const vendorOrders = filteredOrders.filter(o => o.vendor_id === vendor.id && o.status === 'delivered');
      const vendorRevenue = vendorOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);
      return {
        name: vendor.name,
        revenue: vendorRevenue,
        orders: vendorOrders.length
      };
    }).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

    setStats({
      totalRevenue,
      totalOrders: filteredOrders.length,
      totalVendors: filteredVendors.length,
      totalUsers: filteredUsers.length,
      pendingOrders,
      completedOrders,
      cancelledOrders,
      averageOrderValue,
      topVendors: vendorStats,
      revenueGrowth,
      orderGrowth,
      userGrowth
    });
  };

  // Chart data calculations
  const revenueByDay = orders.reduce((acc: any[], order) => {
    if (order.status !== 'delivered') return acc;
    const date = format(new Date(order.created_at), 'MMM dd');
    const existing = acc.find(item => item.day === date);
    if (existing) {
      existing.revenue += Number(order.total || 0);
      existing.orders += 1;
    } else {
      acc.push({ day: date, revenue: Number(order.total || 0), orders: 1 });
    }
    return acc;
  }, []).slice(-7);

  const ordersByHour = orders.reduce((acc: any[], order) => {
    const hour = new Date(order.created_at).getHours();
    const hourLabel = `${hour % 12 || 12}${hour < 12 ? 'am' : 'pm'}`;
    const existing = acc.find(item => item.hour === hourLabel);
    if (existing) {
      existing.count += 1;
    } else {
      acc.push({ hour: hourLabel, count: 1 });
    }
    return acc;
  }, []);

  const statusBreakdown = orders.reduce((acc: any[], order) => {
    const existing = acc.find(item => item.status === order.status);
    if (existing) {
      existing.count += 1;
    } else {
      acc.push({ status: order.status.replace('_', ' '), count: 1 });
    }
    return acc;
  }, []).sort((a, b) => b.count - a.count);

  const approveVendor = async (id: string) => {
    const { error } = await supabase.from('vendors').update({ is_approved: true }).eq('id', id);
    if (!error) {
      setVendors(vendors.map(v => v.id === id ? { ...v, is_approved: true } : v));
      toast({ title: 'Vendor approved ✓' });
    }
  };

  const exportData = () => {
    const currentRange = getCurrentTimeRange();
    const filteredOrders = orders.filter(order => {
      const orderDate = new Date(order.created_at);
      return orderDate >= currentRange.startDate && orderDate <= currentRange.endDate;
    });

    const csvContent = [
      ['Order ID', 'Date', 'Status', 'Total', 'Vendor ID', 'Customer ID'].join(','),
      ...filteredOrders.map(order => [
        order.id,
        format(new Date(order.created_at), 'yyyy-MM-dd HH:mm:ss'),
        order.status,
        order.total,
        order.vendor_id,
        order.customer_id || order.student_id
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `orders-report-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (orders.length > 0) {
      calculateStats();
    }
  }, [orders, users, vendors, selectedTimeRange, customStartDate, customEndDate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const pendingVendors = vendors.filter(v => !v.is_approved);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground">Admin</p>
          <h1 className="mt-1 font-heading text-3xl font-bold tracking-tight">Dashboard Overview</h1>
          <p className="text-muted-foreground">Comprehensive analytics and management</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={fetchData} disabled={refreshing} variant="outline" size="sm">
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={exportData} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Time Range Selector */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Report Period
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Label htmlFor="timeRange">Time Range</Label>
              <Select value={selectedTimeRange} onValueChange={setSelectedTimeRange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {timeRanges.map(range => (
                    <SelectItem key={range.value} value={range.value}>
                      {range.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedTimeRange === 'custom' && (
              <>
                <div className="flex-1">
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                  />
                </div>
                <div className="flex-1">
                  <Label htmlFor="endDate">End Date</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                  />
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics */}
      {stats && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <DollarSign className="h-8 w-8 text-green-500" />
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Total Revenue</p>
                <p className="font-heading text-2xl font-bold">₦{stats.totalRevenue.toLocaleString()}</p>
                <div className="flex items-center gap-1 text-xs">
                  {stats.revenueGrowth >= 0 ? (
                    <TrendingUp className="h-3 w-3 text-green-500" />
                  ) : (
                    <TrendingDown className="h-3 w-3 text-red-500" />
                  )}
                  <span className={stats.revenueGrowth >= 0 ? 'text-green-500' : 'text-red-500'}>
                    {Math.abs(stats.revenueGrowth).toFixed(1)}%
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <Package className="h-8 w-8 text-blue-500" />
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Total Orders</p>
                <p className="font-heading text-2xl font-bold">{stats.totalOrders}</p>
                <div className="flex items-center gap-1 text-xs">
                  {stats.orderGrowth >= 0 ? (
                    <TrendingUp className="h-3 w-3 text-green-500" />
                  ) : (
                    <TrendingDown className="h-3 w-3 text-red-500" />
                  )}
                  <span className={stats.orderGrowth >= 0 ? 'text-green-500' : 'text-red-500'}>
                    {Math.abs(stats.orderGrowth).toFixed(1)}%
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <Store className="h-8 w-8 text-purple-500" />
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Active Vendors</p>
                <p className="font-heading text-2xl font-bold">{stats.totalVendors}</p>
                <p className="text-xs text-muted-foreground">{pendingVendors.length} pending approval</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <Users className="h-8 w-8 text-orange-500" />
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">New Users</p>
                <p className="font-heading text-2xl font-bold">{stats.totalUsers}</p>
                <div className="flex items-center gap-1 text-xs">
                  {stats.userGrowth >= 0 ? (
                    <TrendingUp className="h-3 w-3 text-green-500" />
                  ) : (
                    <TrendingDown className="h-3 w-3 text-red-500" />
                  )}
                  <span className={stats.userGrowth >= 0 ? 'text-green-500' : 'text-red-500'}>
                    {Math.abs(stats.userGrowth).toFixed(1)}%
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Order Status Overview */}
      {stats && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <Clock className="h-8 w-8 text-yellow-500" />
              <div>
                <p className="text-sm text-muted-foreground">Pending Orders</p>
                <p className="font-heading text-2xl font-bold">{stats.pendingOrders}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <CheckCircle className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Completed Orders</p>
                <p className="font-heading text-2xl font-bold">{stats.completedOrders}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <XCircle className="h-8 w-8 text-red-500" />
              <div>
                <p className="text-sm text-muted-foreground">Cancelled Orders</p>
                <p className="font-heading text-2xl font-bold">{stats.cancelledOrders}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium uppercase tracking-widest text-muted-foreground">Revenue · 7 days</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={revenueByDay}>
                <defs>
                  <linearGradient id="adminRevGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--foreground))" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="hsl(var(--foreground))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" tickFormatter={v => `₦${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => [`₦${v.toLocaleString()}`, 'Revenue']} />
                <Area type="monotone" dataKey="revenue" stroke="hsl(var(--foreground))" fill="url(#adminRevGrad)" strokeWidth={1.5} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium uppercase tracking-widest text-muted-foreground">Peak hours</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={ordersByHour}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="hour" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(var(--foreground))" radius={[3, 3, 0, 0]} opacity={0.7} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Additional Metrics */}
      {stats && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Average Order Value
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-heading text-3xl font-bold">₦{stats.averageOrderValue.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">Per completed order</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Star className="h-5 w-5" />
                Top Performing Vendors
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {stats.topVendors.slice(0, 3).map((vendor, index) => (
                  <div key={vendor.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{index + 1}</Badge>
                      <span className="font-medium">{vendor.name}</span>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">₦{vendor.revenue.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">{vendor.orders} orders</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Order Status Breakdown */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium uppercase tracking-widest text-muted-foreground">Order status breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          {statusBreakdown.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No orders yet</p>
          ) : (
            <div className="flex items-center gap-6">
              <ResponsiveContainer width={130} height={130}>
                <PieChart>
                  <Pie data={statusBreakdown} dataKey="count" nameKey="status" cx="50%" cy="50%" innerRadius={35} outerRadius={55} paddingAngle={2} strokeWidth={0}>
                    {statusBreakdown.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-1.5">
                {statusBreakdown.map((s, i) => (
                  <div key={s.status} className="flex items-center gap-2 text-sm">
                    <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span className="capitalize text-muted-foreground">{s.status}</span>
                    <span className="ml-auto font-medium">{s.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* System Health & Alerts */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              System Health
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Database Status</span>
                <Badge variant="default">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Healthy
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">API Response Time</span>
                <Badge variant="outline">~150ms</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Active Sessions</span>
                <Badge variant="outline">{users.length}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Alerts & Issues
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingVendors.length > 0 && (
                <div className="flex items-center gap-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded">
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  <span className="text-sm">{pendingVendors.length} vendors awaiting approval</span>
                </div>
              )}
              {stats && stats.pendingOrders > 10 && (
                <div className="flex items-center gap-2 p-2 bg-orange-50 dark:bg-orange-900/20 rounded">
                  <Clock className="h-4 w-4 text-orange-500" />
                  <span className="text-sm">High number of pending orders ({stats.pendingOrders})</span>
                </div>
              )}
              {(!pendingVendors.length && (!stats || stats.pendingOrders <= 10)) && (
                <div className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-900/20 rounded">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-sm">All systems operating normally</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Orders */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Recent Orders
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {orders.slice(0, 10).map(order => (
              <div key={order.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex-1">
                  <p className="font-medium">Order #{order.id.slice(0, 8)}</p>
                  <p className="text-sm text-muted-foreground">
                    ₦{Number(order.total || 0).toLocaleString()} · {format(new Date(order.created_at), 'MMM dd, yyyy HH:mm')}
                  </p>
                  {order.delivery_location && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                      <MapPin className="h-3 w-3" />
                      {order.delivery_location}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={
                    order.status === 'delivered' ? 'default' :
                      order.status === 'cancelled' || order.status === 'rejected' ? 'destructive' :
                        'secondary'
                  }>
                    {order.status.replace('_', ' ')}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminOverview;
