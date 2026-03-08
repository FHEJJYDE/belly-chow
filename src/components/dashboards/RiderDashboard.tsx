import { useEffect, useState, useMemo, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import AppNavbar from '@/components/layout/AppNavbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import {
  MapPin, Navigation, Phone, User, Store, FileText, CreditCard, Package,
  ArrowLeft, Clock, CheckCircle2, Truck, Wallet, History, Settings,
  Home, Bike, TrendingUp, Calendar, DollarSign, Hash, Locate, XCircle,
  Camera, Upload, X, Banknote
} from 'lucide-react';
import { useGeolocation } from '@/hooks/useGeolocation';
import DeliveryChat from '@/components/chat/DeliveryChat';
import DeliveryMap from '@/components/maps/DeliveryMap';
import LivePulse from '@/components/LivePulse';

interface EnrichedOrder {
  id: string;
  status: string;
  total: number;
  delivery_fee: number;
  delivery_location: string;
  delivery_lat: number | null;
  delivery_lng: number | null;
  rider_lat: number | null;
  rider_lng: number | null;
  payment_method: string;
  payment_status: string;
  notes: string | null;
  created_at: string;
  vendor_id: string;
  student_id: string;
  rider_id: string | null;
  vendor_name: string;
  vendor_address: string;
  vendor_user_id: string;
  customer_name: string;
  customer_phone: string;
  items: { name: string; quantity: number; price: number }[];
}

interface RiderSettings {
  vehicle_type: string;
  plate_number: string;
  bank_name: string;
  account_number: string;
  account_name: string;
}

interface WithdrawalRequest {
  id: string;
  amount: number;
  status: string;
  created_at: string;
}

const RiderDashboard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isOnline, setIsOnline] = useState(true);
  const [availableOrders, setAvailableOrders] = useState<EnrichedOrder[]>([]);
  const [myOrders, setMyOrders] = useState<EnrichedOrder[]>([]);
  const [deliveryHistory, setDeliveryHistory] = useState<EnrichedOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeDeliveryId, setActiveDeliveryId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('home');
  const { position, error: geoError } = useGeolocation(true);

  // Delivery proof state
  const [deliveryProof, setDeliveryProof] = useState<File | null>(null);
  const [deliveryProofPreview, setDeliveryProofPreview] = useState<string | null>(null);
  const [uploadingProof, setUploadingProof] = useState(false);
  const proofInputRef = useRef<HTMLInputElement>(null);

  // Withdrawal state
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [submittingWithdrawal, setSubmittingWithdrawal] = useState(false);

  // Rider settings state
  const [riderSettings, setRiderSettings] = useState<RiderSettings>({
    vehicle_type: 'motorcycle', plate_number: '', bank_name: '', account_number: '', account_name: ''
  });
  const [savingSettings, setSavingSettings] = useState(false);

  // Update rider location in active orders
  useEffect(() => {
    if (!position || !user || myOrders.length === 0) return;
    myOrders.forEach(async (order) => {
      await supabase.from('orders').update({
        rider_lat: position.lat,
        rider_lng: position.lng,
      } as any).eq('id', order.id);
    });
  }, [position, myOrders, user]);

  const enrichOrders = async (orders: any[]): Promise<EnrichedOrder[]> => {
    if (orders.length === 0) return [];
    const vendorIds = [...new Set(orders.map(o => o.vendor_id))];
    const { data: vendors } = await supabase.from('vendors').select('id, name, address, user_id').in('id', vendorIds);
    const vendorMap = new Map(vendors?.map(v => [v.id, v]) || []);
    const studentIds = [...new Set(orders.map(o => o.student_id))];
    const { data: profiles } = await supabase.from('profiles').select('user_id, full_name, phone').in('user_id', studentIds);
    const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
    const orderIds = orders.map(o => o.id);
    const { data: orderItems } = await supabase.from('order_items').select('order_id, quantity, price, menu_item_id').in('order_id', orderIds);
    const menuItemIds = [...new Set(orderItems?.map(oi => oi.menu_item_id) || [])];
    let menuMap = new Map<string, string>();
    if (menuItemIds.length > 0) {
      const { data: menuItems } = await supabase.from('menu_items').select('id, name').in('id', menuItemIds);
      menuMap = new Map(menuItems?.map(m => [m.id, m.name]) || []);
    }
    const itemsByOrder = new Map<string, { name: string; quantity: number; price: number }[]>();
    orderItems?.forEach(oi => {
      const list = itemsByOrder.get(oi.order_id) || [];
      list.push({ name: menuMap.get(oi.menu_item_id) || 'Unknown', quantity: oi.quantity, price: oi.price });
      itemsByOrder.set(oi.order_id, list);
    });
    return orders.map(o => {
      const vendor = vendorMap.get(o.vendor_id);
      const profile = profileMap.get(o.student_id);
      return {
        ...o,
        vendor_name: vendor?.name || 'Unknown Vendor',
        vendor_address: vendor?.address || '',
        vendor_user_id: vendor?.user_id || '',
        customer_name: profile?.full_name || 'Unknown',
        customer_phone: profile?.phone || '',
        items: itemsByOrder.get(o.id) || [],
      };
    });
  };

  // Fetch settings
  useEffect(() => {
    if (!user) return;
    const fetchSettings = async () => {
      const { data } = await (supabase.from('rider_settings') as any).select('*').eq('user_id', user.id).maybeSingle();
      if (data) {
        setRiderSettings({
          vehicle_type: data.vehicle_type || 'motorcycle',
          plate_number: data.plate_number || '',
          bank_name: data.bank_name || '',
          account_number: data.account_number || '',
          account_name: data.account_name || '',
        });
      }
    };
    fetchSettings();
  }, [user]);

  // Fetch withdrawals
  useEffect(() => {
    if (!user) return;
    const fetchWithdrawals = async () => {
      const { data } = await (supabase.from('withdrawal_requests') as any).select('id, amount, status, created_at').eq('user_id', user.id).order('created_at', { ascending: false });
      setWithdrawals(data || []);
    };
    fetchWithdrawals();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const fetchOrders = async () => {
      const [avail, mine, history] = await Promise.all([
        supabase.from('orders').select('*').eq('status', 'ready').is('rider_id', null).order('created_at', { ascending: false }),
        supabase.from('orders').select('*').eq('rider_id', user.id).in('status', ['picked_up', 'delivering']).order('created_at', { ascending: false }),
        supabase.from('orders').select('*').eq('rider_id', user.id).eq('status', 'delivered').order('created_at', { ascending: false }).limit(50),
      ]);
      const [enrichedAvail, enrichedMine, enrichedHistory] = await Promise.all([
        enrichOrders(avail.data || []),
        enrichOrders(mine.data || []),
        enrichOrders(history.data || []),
      ]);
      setAvailableOrders(enrichedAvail);
      setMyOrders(enrichedMine);
      setDeliveryHistory(enrichedHistory);
      setLoading(false);
      if (enrichedMine.length > 0 && !activeDeliveryId) {
        setActiveDeliveryId(enrichedMine[0].id);
      }
    };
    fetchOrders();
    const channel = supabase.channel('rider-orders').on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchOrders()).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const acceptOrder = async (orderId: string) => {
    if (!user) return;
    const updateData: any = { rider_id: user.id, status: 'picked_up' };
    if (position) { updateData.rider_lat = position.lat; updateData.rider_lng = position.lng; }
    const { error } = await supabase.from('orders').update(updateData).eq('id', orderId);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Order accepted! 🏍️' });
    setActiveDeliveryId(orderId);
  };

  const updateStatus = async (orderId: string, status: string) => {
    const { error } = await supabase.from('orders').update({ status: status as any }).eq('id', orderId);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: `Order marked as ${status.replace('_', ' ')}` });
    if (status === 'delivered') { setActiveDeliveryId(null); setDeliveryProof(null); setDeliveryProofPreview(null); }
  };

  const cancelDelivery = async (orderId: string) => {
    const { error } = await supabase.from('orders').update({ rider_id: null, rider_lat: null, rider_lng: null, status: 'ready' as any } as any).eq('id', orderId);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Delivery cancelled. Order returned to pool.' });
    setActiveDeliveryId(null);
  };

  const openInGoogleMaps = (lat: number, lng: number) => {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
  };

  // Delivery proof handlers
  const handleProofSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast({ title: 'File too large', description: 'Max 5MB', variant: 'destructive' }); return; }
    setDeliveryProof(file);
    setDeliveryProofPreview(URL.createObjectURL(file));
  };

  const uploadDeliveryProof = async (orderId: string): Promise<string | null> => {
    if (!deliveryProof || !user) return null;
    setUploadingProof(true);
    const ext = deliveryProof.name.split('.').pop();
    const path = `${user.id}/${orderId}.${ext}`;
    const { error } = await supabase.storage.from('delivery-proofs').upload(path, deliveryProof, { upsert: true });
    setUploadingProof(false);
    if (error) { console.error(error); return null; }
    const { data: urlData } = supabase.storage.from('delivery-proofs').getPublicUrl(path);
    return urlData.publicUrl || path;
  };

  const handleDeliverWithProof = async (orderId: string) => {
    let proofUrl: string | null = null;
    if (deliveryProof) {
      proofUrl = await uploadDeliveryProof(orderId);
    }
    const updateData: any = { status: 'delivered' };
    if (proofUrl) updateData.delivery_proof_url = proofUrl;
    const { error } = await supabase.from('orders').update(updateData).eq('id', orderId);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Order delivered! 🎉' });
    setActiveDeliveryId(null);
    setDeliveryProof(null);
    setDeliveryProofPreview(null);
  };

  // Withdrawal
  const submitWithdrawal = async () => {
    if (!user || !withdrawAmount || Number(withdrawAmount) <= 0) return;
    if (!riderSettings.bank_name || !riderSettings.account_number) {
      toast({ title: 'Please set your bank details in Settings first', variant: 'destructive' });
      return;
    }
    setSubmittingWithdrawal(true);
    const { error } = await (supabase.from('withdrawal_requests') as any).insert({
      user_id: user.id,
      amount: Number(withdrawAmount),
      bank_name: riderSettings.bank_name,
      account_number: riderSettings.account_number,
      account_name: riderSettings.account_name,
    });
    setSubmittingWithdrawal(false);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Withdrawal request submitted! 💰' });
    setWithdrawAmount('');
    // Refresh
    const { data } = await (supabase.from('withdrawal_requests') as any).select('id, amount, status, created_at').eq('user_id', user.id).order('created_at', { ascending: false });
    setWithdrawals(data || []);
  };

  const saveSettings = async () => {
    if (!user) return;
    setSavingSettings(true);
    const { data: existing } = await (supabase.from('rider_settings') as any).select('id').eq('user_id', user.id).maybeSingle();
    if (existing) {
      await (supabase.from('rider_settings') as any).update(riderSettings).eq('user_id', user.id);
    } else {
      await (supabase.from('rider_settings') as any).insert({ ...riderSettings, user_id: user.id });
    }
    setSavingSettings(false);
    toast({ title: 'Settings saved ✓' });
  };

  // Earnings calculations
  const earnings = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart); weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const calc = (from: Date) => deliveryHistory.filter(o => new Date(o.created_at) >= from).reduce((sum, o) => sum + Number(o.delivery_fee), 0);
    const countFrom = (from: Date) => deliveryHistory.filter(o => new Date(o.created_at) >= from).length;
    return {
      today: calc(todayStart), todayCount: countFrom(todayStart),
      week: calc(weekStart), weekCount: countFrom(weekStart),
      month: calc(monthStart), monthCount: countFrom(monthStart),
      total: deliveryHistory.reduce((sum, o) => sum + Number(o.delivery_fee), 0),
      totalCount: deliveryHistory.length,
    };
  }, [deliveryHistory]);

  if (loading) return <div className="flex min-h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;

  const activeOrder = myOrders.find(o => o.id === activeDeliveryId);

  // ──────────────────────────────────────────────
  // ACTIVE DELIVERY VIEW
  // ──────────────────────────────────────────────
  if (activeOrder) {
    const statusSteps = [
      { key: 'picked_up', label: 'Picked Up', icon: Package },
      { key: 'delivering', label: 'On the Way', icon: Truck },
      { key: 'delivered', label: 'Delivered', icon: CheckCircle2 },
    ];
    const currentStepIndex = statusSteps.findIndex(s => s.key === activeOrder.status);
    const studentSharingLocation = !!activeOrder.delivery_lat && !!activeOrder.delivery_lng;
    const chatParticipants = [
      { id: activeOrder.student_id, name: activeOrder.customer_name, role: 'student' },
      ...(activeOrder.vendor_user_id ? [{ id: activeOrder.vendor_user_id, name: activeOrder.vendor_name, role: 'vendor' }] : []),
    ].filter(p => p.id !== user?.id);

    return (
      <div className="min-h-screen bg-background flex flex-col">
        <div className="sticky top-0 z-30 bg-card border-b px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setActiveDeliveryId(null)}><ArrowLeft className="h-5 w-5" /></Button>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate">Order #{activeOrder.id.slice(0, 8)}</p>
            <div className="flex items-center gap-2">
              <LivePulse label="Active" />
              <span className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> {new Date(activeOrder.created_at).toLocaleTimeString()}</span>
            </div>
          </div>
          <Badge variant={activeOrder.status === 'delivering' ? 'default' : 'secondary'} className="shrink-0">{activeOrder.status.replace('_', ' ')}</Badge>
        </div>

        <div className="relative">
          <DeliveryMap riderLat={position?.lat} riderLng={position?.lng} customerLat={activeOrder.delivery_lat} customerLng={activeOrder.delivery_lng} className="h-[250px] rounded-none" />
          {studentSharingLocation && (
            <div className="absolute top-3 left-3 bg-blue-500/90 text-white text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-lg">
              <Locate className="h-3 w-3 animate-pulse" /> Student sharing live location
            </div>
          )}
          {activeOrder.delivery_lat && activeOrder.delivery_lng && (
            <Button size="sm" className="absolute bottom-3 right-3 gap-1.5 shadow-lg" onClick={() => openInGoogleMaps(activeOrder.delivery_lat!, activeOrder.delivery_lng!)}>
              <Navigation className="h-4 w-4" /> Navigate
            </Button>
          )}
        </div>

        <div className="px-4 py-4 bg-card border-b">
          <div className="flex items-center justify-between">
            {statusSteps.map((step, i) => {
              const Icon = step.icon;
              const isActive = i <= currentStepIndex;
              const isCurrent = i === currentStepIndex;
              return (
                <div key={step.key} className="flex flex-col items-center gap-1 flex-1">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors ${isCurrent ? 'border-primary bg-primary text-primary-foreground' : isActive ? 'border-primary/50 bg-primary/10 text-primary' : 'border-muted bg-muted text-muted-foreground'}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className={`text-[11px] font-medium ${isCurrent ? 'text-primary' : isActive ? 'text-foreground' : 'text-muted-foreground'}`}>{step.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          <Card>
            <CardHeader className="pb-2 pt-4 px-4"><CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"><Store className="h-4 w-4 text-primary" /> Pickup From</CardTitle></CardHeader>
            <CardContent className="px-4 pb-4 space-y-1">
              <p className="font-semibold">{activeOrder.vendor_name}</p>
              {activeOrder.vendor_address && <p className="text-sm text-muted-foreground">{activeOrder.vendor_address}</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2 pt-4 px-4"><CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"><MapPin className="h-4 w-4 text-primary" /> Deliver To</CardTitle></CardHeader>
            <CardContent className="px-4 pb-4 space-y-2">
              <p className="font-semibold flex items-center gap-1.5"><User className="h-4 w-4 text-muted-foreground" /> {activeOrder.customer_name}</p>
              <p className="text-sm text-muted-foreground">{activeOrder.delivery_location || 'GPS Location'}</p>
              {activeOrder.customer_phone && (
                <a href={`tel:${activeOrder.customer_phone}`} className="inline-flex items-center gap-1.5 text-sm text-primary font-medium hover:underline"><Phone className="h-4 w-4" /> {activeOrder.customer_phone}</a>
              )}
            </CardContent>
          </Card>

          {activeOrder.items.length > 0 && (
            <Card>
              <CardHeader className="pb-2 pt-4 px-4"><CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"><Package className="h-4 w-4 text-primary" /> Order Items ({activeOrder.items.length})</CardTitle></CardHeader>
              <CardContent className="px-4 pb-4 space-y-2">
                {activeOrder.items.map((item, i) => (
                  <div key={i} className="flex justify-between text-sm"><span>{item.quantity}x {item.name}</span><span className="font-medium">₦{(item.price * item.quantity).toLocaleString()}</span></div>
                ))}
                <Separator />
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Order Total</span><span>₦{Number(activeOrder.total).toLocaleString()}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Your Delivery Fee</span><span className="font-semibold text-primary">₦{Number(activeOrder.delivery_fee).toLocaleString()}</span></div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <CreditCard className="h-4 w-4 text-muted-foreground" />
                <span className="capitalize">{activeOrder.payment_method.replace('_', ' ')}</span>
                <Badge variant={activeOrder.payment_status === 'confirmed' ? 'default' : 'secondary'} className="ml-auto text-xs">{activeOrder.payment_status}</Badge>
              </div>
              {activeOrder.notes && (
                <div className="flex items-start gap-2 text-sm text-muted-foreground pt-1"><FileText className="mt-0.5 h-4 w-4 shrink-0" /><p>{activeOrder.notes}</p></div>
              )}
            </CardContent>
          </Card>

          <DeliveryChat orderId={activeOrder.id} otherName="Customer" participants={chatParticipants} />
        </div>

        {/* Sticky bottom action bar */}
        <div className="sticky bottom-0 z-30 bg-card border-t p-4 space-y-2">
          {/* Delivery proof upload for delivering status */}
          {activeOrder.status === 'delivering' && (
            <div className="space-y-2">
              <input ref={proofInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleProofSelect} />
              {deliveryProofPreview ? (
                <div className="relative rounded-lg border overflow-hidden">
                  <img src={deliveryProofPreview} alt="Delivery proof" className="w-full max-h-32 object-contain bg-muted" />
                  <button onClick={() => { setDeliveryProof(null); setDeliveryProofPreview(null); }} className="absolute top-2 right-2 rounded-full bg-destructive p-1 text-destructive-foreground shadow-sm">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <Button variant="outline" className="w-full gap-2" onClick={() => proofInputRef.current?.click()}>
                  <Camera className="h-4 w-4" /> Take Delivery Photo (optional)
                </Button>
              )}
            </div>
          )}

          <div className="flex gap-3">
            {activeOrder.status === 'picked_up' && (
              <Button className="flex-1 h-12 text-base gap-2" onClick={() => updateStatus(activeOrder.id, 'delivering')}>
                <Truck className="h-5 w-5" /> I'm On the Way
              </Button>
            )}
            {activeOrder.status === 'delivering' && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button className="flex-1 h-12 text-base gap-2" disabled={uploadingProof}>
                    <CheckCircle2 className="h-5 w-5" /> {uploadingProof ? 'Uploading...' : 'Mark Delivered ✓'}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirm Delivery</AlertDialogTitle>
                    <AlertDialogDescription>Are you sure this order has been delivered to the customer?</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleDeliverWithProof(activeOrder.id)}>Yes, Delivered ✓</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full text-destructive hover:text-destructive gap-1"><XCircle className="h-4 w-4" /> Cancel Delivery</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Cancel this delivery?</AlertDialogTitle>
                <AlertDialogDescription>The order will be returned to the available pool for another rider.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep Delivery</AlertDialogCancel>
                <AlertDialogAction onClick={() => cancelDelivery(activeOrder.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Yes, Cancel</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    );
  }

  // ──────────────────────────────────────────
  // TABBED DEFAULT VIEW
  // ──────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">
      <AppNavbar />
      <div className="container py-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="font-heading text-2xl font-bold">Rider Dashboard 🏍️</h1>
            <p className="text-sm text-muted-foreground">
              {isOnline ? '🟢 Online' : '🔴 Offline'}
              {position && <span className="ml-2">· GPS active</span>}
              {geoError && <span className="ml-2 text-destructive">· Location error</span>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-sm">Online</Label>
            <Switch checked={isOnline} onCheckedChange={setIsOnline} />
          </div>
        </div>

        <div className="mb-6 grid grid-cols-3 gap-3">
          <Card className="bg-primary/5 border-primary/20"><CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Today</p>
            <p className="text-lg font-bold text-primary">₦{earnings.today.toLocaleString()}</p>
            <p className="text-[10px] text-muted-foreground">{earnings.todayCount} deliveries</p>
          </CardContent></Card>
          <Card><CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">This Week</p>
            <p className="text-lg font-bold">₦{earnings.week.toLocaleString()}</p>
            <p className="text-[10px] text-muted-foreground">{earnings.weekCount} deliveries</p>
          </CardContent></Card>
          <Card><CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">This Month</p>
            <p className="text-lg font-bold">₦{earnings.month.toLocaleString()}</p>
            <p className="text-[10px] text-muted-foreground">{earnings.monthCount} deliveries</p>
          </CardContent></Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4 mb-4">
            <TabsTrigger value="home" className="gap-1 text-xs"><Home className="h-3.5 w-3.5" /> Home</TabsTrigger>
            <TabsTrigger value="history" className="gap-1 text-xs"><History className="h-3.5 w-3.5" /> History</TabsTrigger>
            <TabsTrigger value="earnings" className="gap-1 text-xs"><Wallet className="h-3.5 w-3.5" /> Earnings</TabsTrigger>
            <TabsTrigger value="settings" className="gap-1 text-xs"><Settings className="h-3.5 w-3.5" /> Settings</TabsTrigger>
          </TabsList>

          {/* ═══════ HOME TAB ═══════ */}
          <TabsContent value="home" className="space-y-4">
            {myOrders.length > 0 && (
              <div>
                <h2 className="mb-3 font-heading text-lg font-semibold flex items-center gap-2"><Truck className="h-5 w-5 text-primary" /> Active Deliveries ({myOrders.length})</h2>
                <div className="space-y-3">
                  {myOrders.map(order => (
                    <Card key={order.id} className="cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all" onClick={() => setActiveDeliveryId(order.id)}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="space-y-1">
                            <p className="font-semibold">Order #{order.id.slice(0, 8)}</p>
                            <p className="text-sm text-muted-foreground flex items-center gap-1"><Store className="h-3.5 w-3.5" /> {order.vendor_name}</p>
                            <p className="text-sm text-muted-foreground flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {order.delivery_location || 'GPS Location'}</p>
                          </div>
                          <div className="text-right space-y-1">
                            <Badge variant={order.status === 'delivering' ? 'default' : 'secondary'}>{order.status.replace('_', ' ')}</Badge>
                            <p className="text-sm font-medium text-primary">₦{Number(order.delivery_fee).toLocaleString()}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h2 className="mb-3 font-heading text-lg font-semibold flex items-center gap-2"><Package className="h-5 w-5 text-muted-foreground" /> Available Orders ({availableOrders.length})</h2>
              {!isOnline ? (
                <Card><CardContent className="py-10 text-center text-muted-foreground">Go online to see available orders</CardContent></Card>
              ) : availableOrders.length === 0 ? (
                <Card><CardContent className="py-10 text-center text-muted-foreground">No orders available right now. Hang tight! 🍕</CardContent></Card>
              ) : (
                <div className="space-y-3">
                  {availableOrders.map(order => (
                    <Card key={order.id} className="overflow-hidden">
                      <CardContent className="p-0">
                        <div className="bg-primary/10 px-4 py-2 flex items-center justify-between">
                          <span className="text-xs font-medium text-primary flex items-center gap-1"><DollarSign className="h-3 w-3" /> Earn</span>
                          <span className="font-bold text-primary">₦{Number(order.delivery_fee).toLocaleString()}</span>
                        </div>
                        <div className="p-4 space-y-3">
                          <div className="space-y-2 flex-1">
                            <div className="flex items-center gap-2">
                              <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="font-semibold text-sm">{order.id.slice(0, 8)}</span>
                              <span className="text-xs text-muted-foreground">· {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                            <div className="flex items-start gap-2">
                              <div className="mt-1 h-2 w-2 rounded-full bg-accent shrink-0" />
                              <div><p className="text-xs uppercase tracking-wider text-muted-foreground">Pickup</p><p className="text-sm font-medium">{order.vendor_name}</p></div>
                            </div>
                            <div className="flex items-start gap-2">
                              <div className="mt-1 h-2 w-2 rounded-full bg-primary shrink-0" />
                              <div><p className="text-xs uppercase tracking-wider text-muted-foreground">Drop-off</p><p className="text-sm font-medium">{order.customer_name}</p><p className="text-xs text-muted-foreground">{order.delivery_location || 'GPS Location'}</p></div>
                            </div>
                            {order.items.length > 0 && (
                              <div className="rounded-md bg-muted/50 px-3 py-2">
                                <p className="text-xs font-medium text-muted-foreground mb-1">📦 {order.items.length} item{order.items.length !== 1 ? 's' : ''}</p>
                                {order.items.map((item, i) => (<p key={i} className="text-xs">{item.quantity}x {item.name}</p>))}
                              </div>
                            )}
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1"><CreditCard className="h-3 w-3" /> {order.payment_method.replace('_', ' ')}</span>
                              <span>₦{Number(order.total).toLocaleString()} order</span>
                            </div>
                          </div>
                          <Button className="w-full gap-2" onClick={() => acceptOrder(order.id)}><Bike className="h-4 w-4" /> Accept Delivery</Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* ═══════ HISTORY TAB ═══════ */}
          <TabsContent value="history" className="space-y-3">
            <h2 className="font-heading text-lg font-semibold flex items-center gap-2"><History className="h-5 w-5 text-muted-foreground" /> Delivery History</h2>
            {deliveryHistory.length === 0 ? (
              <Card><CardContent className="py-10 text-center text-muted-foreground">No completed deliveries yet. Start riding! 🏍️</CardContent></Card>
            ) : (
              deliveryHistory.map(order => (
                <Card key={order.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2"><p className="font-semibold text-sm">#{order.id.slice(0, 8)}</p><Badge variant="outline" className="text-[10px]">delivered</Badge></div>
                        <p className="text-sm text-muted-foreground flex items-center gap-1"><Store className="h-3.5 w-3.5" /> {order.vendor_name}</p>
                        <p className="text-sm text-muted-foreground flex items-center gap-1"><User className="h-3.5 w-3.5" /> {order.customer_name}</p>
                        <p className="text-sm text-muted-foreground flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {order.delivery_location || 'N/A'}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" /> {new Date(order.created_at).toLocaleDateString()} · {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                      <div className="text-right"><p className="font-bold text-primary">₦{Number(order.delivery_fee).toLocaleString()}</p><p className="text-xs text-muted-foreground">earned</p></div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {/* ═══════ EARNINGS TAB ═══════ */}
          <TabsContent value="earnings" className="space-y-6">
            <h2 className="font-heading text-lg font-semibold flex items-center gap-2"><TrendingUp className="h-5 w-5 text-primary" /> Earnings Overview</h2>
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-6 text-center">
                <p className="text-sm text-muted-foreground">Total Earned</p>
                <p className="font-heading text-4xl font-bold text-primary">₦{earnings.total.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">{earnings.totalCount} deliveries completed</p>
              </CardContent>
            </Card>
            <div className="grid grid-cols-3 gap-3">
              {[{ label: 'Today', amount: earnings.today, count: earnings.todayCount }, { label: 'This Week', amount: earnings.week, count: earnings.weekCount }, { label: 'This Month', amount: earnings.month, count: earnings.monthCount }].map(p => (
                <Card key={p.label}><CardContent className="p-3 text-center">
                  <p className="text-xs text-muted-foreground">{p.label}</p>
                  <p className="text-lg font-bold">₦{p.amount.toLocaleString()}</p>
                  <p className="text-[10px] text-muted-foreground">{p.count} deliveries</p>
                </CardContent></Card>
              ))}
            </div>

            {/* Withdrawal Section */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Banknote className="h-4 w-4 text-primary" /> Request Withdrawal</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">Available balance: ₦{earnings.total.toLocaleString()}</p>
                <div className="flex gap-2">
                  <Input type="number" placeholder="Amount (₦)" value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)} />
                  <Button onClick={submitWithdrawal} disabled={submittingWithdrawal || !withdrawAmount || Number(withdrawAmount) <= 0}>
                    {submittingWithdrawal ? '...' : 'Request'}
                  </Button>
                </div>
                {withdrawals.length > 0 && (
                  <div className="space-y-2 mt-3">
                    <p className="text-xs font-medium text-muted-foreground">Recent Requests</p>
                    {withdrawals.slice(0, 5).map(w => (
                      <div key={w.id} className="flex items-center justify-between text-sm border-b pb-2">
                        <div>
                          <p className="font-medium">₦{Number(w.amount).toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground">{new Date(w.created_at).toLocaleDateString()}</p>
                        </div>
                        <Badge variant={w.status === 'approved' ? 'default' : w.status === 'rejected' ? 'destructive' : 'secondary'}>{w.status}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ═══════ SETTINGS TAB ═══════ */}
          <TabsContent value="settings" className="space-y-4">
            <h2 className="font-heading text-lg font-semibold flex items-center gap-2"><Settings className="h-5 w-5 text-muted-foreground" /> Settings</h2>
            <Card>
              <CardContent className="p-4 space-y-4">
                <h3 className="font-medium flex items-center gap-2"><Bike className="h-4 w-4 text-primary" /> Vehicle Information</h3>
                <Select value={riderSettings.vehicle_type} onValueChange={v => setRiderSettings(s => ({ ...s, vehicle_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="motorcycle">Motorcycle 🏍️</SelectItem>
                    <SelectItem value="bicycle">Bicycle 🚲</SelectItem>
                    <SelectItem value="car">Car 🚗</SelectItem>
                  </SelectContent>
                </Select>
                <Input placeholder="Plate Number" value={riderSettings.plate_number} onChange={e => setRiderSettings(s => ({ ...s, plate_number: e.target.value }))} />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 space-y-4">
                <h3 className="font-medium flex items-center gap-2"><Wallet className="h-4 w-4 text-primary" /> Payout Details</h3>
                <Input placeholder="Bank Name" value={riderSettings.bank_name} onChange={e => setRiderSettings(s => ({ ...s, bank_name: e.target.value }))} />
                <Input placeholder="Account Number" value={riderSettings.account_number} onChange={e => setRiderSettings(s => ({ ...s, account_number: e.target.value }))} />
                <Input placeholder="Account Name" value={riderSettings.account_name} onChange={e => setRiderSettings(s => ({ ...s, account_name: e.target.value }))} />
              </CardContent>
            </Card>
            <Button onClick={saveSettings} disabled={savingSettings} className="w-full">{savingSettings ? 'Saving...' : 'Save Settings'}</Button>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default RiderDashboard;
