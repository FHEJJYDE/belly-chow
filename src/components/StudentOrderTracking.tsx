import { useState, useEffect, lazy, Suspense } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useGeolocation } from '@/hooks/useGeolocation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import DeliveryChat from '@/components/chat/DeliveryChat';
import LivePulse from '@/components/LivePulse';
import { useToast } from '@/hooks/use-toast';

const DeliveryMap = lazy(() => import('@/components/maps/DeliveryMap'));

interface OrderData {
  id: string;
  status: string;
  total: number;
  delivery_fee: number;
  delivery_location: string;
  delivery_lat: number | null;
  delivery_lng: number | null;
  rider_lat: number | null;
  rider_lng: number | null;
  rider_id: string | null;
  vendor_id: string;
  student_id: string;
  payment_method: string;
  notes: string | null;
  created_at: string;
}

interface StudentOrderTrackingProps {
  order: OrderData;
  onBack: () => void;
  onCancelled?: () => void;
}

// 4-Stage High-Contrast Horizontal Delivery Stepper (Chowdeck / Uber Eats style)
const STAGES = [
  {
    id: 'confirmed',
    label: 'Confirmed',
    icon: 'fa-solid fa-receipt',
    statuses: ['pending', 'accepted'],
  },
  {
    id: 'kitchen',
    label: 'In Kitchen',
    icon: 'fa-solid fa-fire-burner',
    statuses: ['preparing', 'ready'],
  },
  {
    id: 'transit',
    label: 'In Transit',
    icon: 'fa-solid fa-motorcycle',
    statuses: ['picked_up', 'delivering'],
  },
  {
    id: 'arrived',
    label: 'Arrived',
    icon: 'fa-solid fa-location-dot',
    statuses: ['arrived', 'delivered'],
  },
];

const getStageIndex = (status: string): number => {
  const idx = STAGES.findIndex((s) => s.statuses.includes(status));
  return idx === -1 ? 0 : idx;
};

const getStatusHeadline = (status: string): { title: string; subtitle: string; icon: string } => {
  switch (status) {
    case 'pending':
      return {
        title: 'Awaiting Vendor Confirmation',
        subtitle: 'Your order has been transmitted to the kitchen.',
        icon: 'fa-solid fa-bell-concierge',
      };
    case 'accepted':
      return {
        title: 'Order Confirmed by Kitchen',
        subtitle: 'The vendor has accepted your order and started preparation.',
        icon: 'fa-solid fa-circle-check',
      };
    case 'preparing':
      return {
        title: 'Preparing Your Meal',
        subtitle: 'Your meal is being freshly prepared and packaged.',
        icon: 'fa-solid fa-fire-burner',
      };
    case 'ready':
      return {
        title: 'Meal Ready — Assigning Rider',
        subtitle: 'Your package is sealed and waiting for rider pickup.',
        icon: 'fa-solid fa-box-open',
      };
    case 'picked_up':
      return {
        title: 'Rider Picked Up Your Order',
        subtitle: 'Your dispatch rider has collected your meal from the vendor.',
        icon: 'fa-solid fa-motorcycle',
      };
    case 'delivering':
      return {
        title: 'Rider Heading to Your Drop-Off',
        subtitle: 'Follow your rider live on the radar map below.',
        icon: 'fa-solid fa-route',
      };
    case 'arrived':
      return {
        title: 'Your Rider Has Arrived!',
        subtitle: 'Meet your rider at the drop-off point and confirm receipt below.',
        icon: 'fa-solid fa-location-crosshairs',
      };
    default:
      return {
        title: 'Order in Progress',
        subtitle: 'Tracking live telemetry.',
        icon: 'fa-solid fa-clock',
      };
  }
};

const StudentOrderTracking = ({ order, onBack, onCancelled }: StudentOrderTrackingProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [liveOrder, setLiveOrder] = useState(order);
  const [riderProfile, setRiderProfile] = useState<{ full_name: string; phone: string; avatar_url: string | null } | null>(null);
  const [riderSettings, setRiderSettings] = useState<{ vehicle_type: string; plate_number: string } | null>(null);
  const [vendorInfo, setVendorInfo] = useState<{ name: string; address: string; user_id: string; lat: number | null; lng: number | null } | null>(null);
  const [liveRiderPos, setLiveRiderPos] = useState<{ lat: number; lng: number } | null>(
    order.rider_lat && order.rider_lng ? { lat: order.rider_lat, lng: order.rider_lng } : null
  );

  // Only auto-enable continuous student GPS overwrite if the order was placed in Live GPS mode or had no coordinates
  const autoShareStatuses = ['accepted', 'preparing', 'ready', 'picked_up', 'delivering', 'arrived'];
  const shouldAutoShare =
    autoShareStatuses.includes(liveOrder.status) &&
    (!order.delivery_lat || !order.delivery_lng || order.delivery_location?.startsWith('Live GPS'));
  const [sharingLocation, setSharingLocation] = useState(shouldAutoShare);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [confirmingDelivery, setConfirmingDelivery] = useState(false);

  const { position: studentPos, getPosition } = useGeolocation(sharingLocation);

  useEffect(() => {
    if (shouldAutoShare && !sharingLocation) setSharingLocation(true);
  }, [shouldAutoShare, sharingLocation]);

  // Fetch rider profile & vendor info (including real vendor lat/lng)
  useEffect(() => {
    const fetchRider = async (riderId: string) => {
      const [{ data: profile }, { data: settings }] = await Promise.all([
        supabase.from('profiles').select('full_name, phone, avatar_url').eq('user_id', riderId).single(),
        (supabase.from('rider_settings') as any).select('vehicle_type, plate_number').eq('user_id', riderId).maybeSingle(),
      ]);
      if (profile) setRiderProfile(profile);
      if (settings) setRiderSettings(settings);
    };

    const fetchVendor = async () => {
      const { data } = await (supabase.from('vendors') as any)
        .select('name, address, user_id, lat, lng')
        .eq('id', order.vendor_id)
        .single();
      if (data) {
        setVendorInfo({
          name: data.name,
          address: data.address,
          user_id: data.user_id,
          lat: data.lat != null ? Number(data.lat) : null,
          lng: data.lng != null ? Number(data.lng) : null,
        });
      }
    };

    fetchVendor();
    if (liveOrder.rider_id) fetchRider(liveOrder.rider_id);
  }, [liveOrder.rider_id, order.vendor_id]);

  // Realtime order updates — receive live rider GPS + order status changes
  useEffect(() => {
    const channel = supabase.channel(`student-track-${order.id}`).on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${order.id}` },
      (payload) => {
        const updated = payload.new as any;
        setLiveOrder(updated);
        if (updated.rider_lat && updated.rider_lng) {
          setLiveRiderPos({ lat: updated.rider_lat, lng: updated.rider_lng });
        }
      }
    ).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [order.id]);

  // Push student GPS to Supabase only when sharingLocation is active
  useEffect(() => {
    if (!sharingLocation || !studentPos || !user) return;
    supabase.from('orders').update({
      delivery_lat: studentPos.lat,
      delivery_lng: studentPos.lng,
    } as any).eq('id', order.id).then(() => {});
  }, [studentPos, sharingLocation, order.id, user]);

  const currentStageIdx = getStageIndex(liveOrder.status);
  const headline = getStatusHeadline(liveOrder.status);
  const isTerminal = ['delivered', 'cancelled', 'rejected'].includes(liveOrder.status);
  const canCancel = liveOrder.status === 'pending';
  const isBeingDelivered = ['picked_up', 'delivering', 'arrived'].includes(liveOrder.status);
  const hasRider = !!liveOrder.rider_id;

  const studentMapLat = sharingLocation ? (studentPos?.lat ?? liveOrder.delivery_lat ?? null) : (liveOrder.delivery_lat ?? studentPos?.lat ?? null);
  const studentMapLng = sharingLocation ? (studentPos?.lng ?? liveOrder.delivery_lng ?? null) : (liveOrder.delivery_lng ?? studentPos?.lng ?? null);

  // Build chat participants
  const chatParticipants = [
    ...(liveOrder.rider_id && riderProfile ? [{ id: liveOrder.rider_id, name: riderProfile.full_name, role: 'rider' }] : []),
    ...(vendorInfo ? [{ id: vendorInfo.user_id, name: vendorInfo.name, role: 'vendor' }] : []),
  ].filter(p => p.id !== user?.id);

  const getETA = () => {
    switch (liveOrder.status) {
      case 'pending': return '15–20 mins';
      case 'accepted': return '12–18 mins';
      case 'preparing': return '10–15 mins';
      case 'ready': return '8–12 mins';
      case 'picked_up': return '5–10 mins';
      case 'delivering': return '2–5 mins';
      case 'arrived': return 'Arrived Now';
      default: return null;
    }
  };

  const handleCancel = async () => {
    if (!user || !cancelReason) return;
    if (liveOrder.status !== 'pending') {
      toast({
        title: 'Cancellation Restricted',
        description: 'Orders can only be cancelled before the kitchen accepts them.',
        variant: 'destructive',
      });
      return;
    }
    setCancelling(true);
    const { error } = await supabase.from('orders').update({
      status: 'cancelled',
      cancellation_reason: cancelReason,
    } as any).eq('id', liveOrder.id);
    setCancelling(false);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Order cancelled' });
      onCancelled?.();
    }
  };

  const handleConfirmDelivery = async () => {
    if (!user) return;
    setConfirmingDelivery(true);
    const { error } = await supabase
      .from('orders')
      .update({ status: 'delivered', payment_status: 'confirmed' } as any)
      .eq('id', liveOrder.id);
    if (!error) {
      await (supabase.rpc as any)('release_order_escrow', { p_order_id: liveOrder.id });
    }
    setConfirmingDelivery(false);
    if (error) {
      toast({ title: 'Error confirming delivery', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Delivery confirmed', description: 'Funds released to vendor & rider wallets. Enjoy your meal!' });
      setLiveOrder(prev => ({ ...prev, status: 'delivered' }));
    }
  };

  const eta = getETA();

  if (isTerminal) {
    onBack();
    return null;
  }

  return (
    <div className="flex flex-col min-h-screen bg-background pb-20 md:pb-8">
      {/* Top Sticky Navigation Bar */}
      <div className="sticky top-0 z-30 bg-card/95 backdrop-blur-md border-b border-border/60 px-4 py-3">
        <div className="container max-w-3xl flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-2 text-xs font-semibold -ml-2">
            <i className="fa-solid fa-arrow-left text-xs" />
            <span>Orders</span>
          </Button>
          <div className="flex items-center gap-2.5">
            <LivePulse label="Live Telemetry" />
            <Badge variant="outline" className="font-mono text-xs font-semibold">
              #{liveOrder.id.slice(0, 8)}
            </Badge>
          </div>
        </div>
      </div>

      <div className="container max-w-3xl py-4 space-y-4">
        {/* 1. COMPACT 4-STAGE HORIZONTAL PROGRESS HEADER + ETA */}
        <Card className="border-border/70 shadow-sm overflow-hidden">
          <CardContent className="p-5 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3.5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary border border-primary/20">
                  <i className={`${headline.icon} text-base`} />
                </div>
                <div>
                  <h2 className="font-heading text-lg font-bold tracking-tight text-foreground">
                    {headline.title}
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {headline.subtitle}
                  </p>
                </div>
              </div>

              {eta && (
                <div className="flex items-center gap-2 rounded-xl bg-primary/10 border border-primary/20 px-3.5 py-2 self-start sm:self-center shrink-0">
                  <i className="fa-solid fa-clock text-primary text-xs" />
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground leading-none">Est. Arrival</p>
                    <p className="font-heading text-sm font-bold text-primary mt-0.5 leading-none">{eta}</p>
                  </div>
                </div>
              )}
            </div>

            {/* 4-Stage Stepper */}
            <div className="grid grid-cols-4 gap-2 pt-1">
              {STAGES.map((stage, i) => {
                const isCompleted = i < currentStageIdx;
                const isCurrent = i === currentStageIdx;
                return (
                  <div key={stage.id} className="space-y-2">
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          isCompleted
                            ? 'w-full bg-primary'
                            : isCurrent
                            ? 'w-2/3 bg-primary animate-pulse'
                            : 'w-0'
                        }`}
                      />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <i
                        className={`${stage.icon} text-[11px] ${
                          isCompleted || isCurrent ? 'text-primary' : 'text-muted-foreground/50'
                        }`}
                      />
                      <span
                        className={`text-[11px] font-semibold truncate ${
                          isCurrent
                            ? 'text-primary'
                            : isCompleted
                            ? 'text-foreground'
                            : 'text-muted-foreground'
                        }`}
                      >
                        {stage.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* 2. ARRIVAL ACTION BANNER (When rider marks arrived) */}
        {liveOrder.status === 'arrived' && (
          <Card className="border-emerald-500/40 bg-emerald-500/10 shadow-sm">
            <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-sm">
                  <i className="fa-solid fa-check-double text-base" />
                </div>
                <div>
                  <h4 className="font-heading font-bold text-base text-foreground">Your Rider is Outside</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Collect your package and confirm below to release escrow payment to the vendor and rider.
                  </p>
                </div>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-2 shrink-0" disabled={confirmingDelivery}>
                    <i className="fa-solid fa-circle-check text-xs" />
                    <span>{confirmingDelivery ? 'Confirming...' : 'Confirm Package Received'}</span>
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirm Order Received?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Confirming receipt releases the held escrow funds to the vendor and delivery rider.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Not Yet</AlertDialogCancel>
                    <AlertDialogAction onClick={handleConfirmDelivery} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                      Yes, Package Received
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
        )}

        {/* 3. LIVE TELEMETRY MAP */}
        <div className="relative">
          <Suspense fallback={<div className="animate-pulse bg-muted rounded-2xl" style={{ height: '310px' }} />}>
            <DeliveryMap
              riderLat={liveRiderPos?.lat}
              riderLng={liveRiderPos?.lng}
              customerLat={studentMapLat}
              customerLng={studentMapLng}
              vendorLat={vendorInfo?.lat}
              vendorLng={vendorInfo?.lng}
              riderLabel={riderProfile?.full_name || 'Dispatch Rider'}
              customerLabel={liveOrder.delivery_location?.split(' • ')[0] || 'Your Drop-off'}
              vendorLabel={vendorInfo?.name || 'Vendor Kitchen'}
              height="310px"
            />
          </Suspense>

          {!liveRiderPos && isBeingDelivered && (
            <div className="pointer-events-none absolute bottom-14 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-2 rounded-full bg-slate-900/90 text-white backdrop-blur-md px-3.5 py-1.5 text-xs font-semibold shadow-lg border border-white/15">
              <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-orange-400 border-t-transparent" />
              <span>Waiting for rider's live GPS signal...</span>
            </div>
          )}

          {sharingLocation && studentPos && (
            <div className="pointer-events-none absolute bottom-3 right-12 z-[1000] flex items-center gap-1.5 rounded-xl bg-blue-600/95 px-2.5 py-1 text-[10px] font-semibold text-white shadow-md">
              <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
              <span>Sharing Live GPS</span>
            </div>
          )}
        </div>

        {/* 4. RIDER & VENDOR DISPATCH BAR */}
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Assigned Rider Card */}
          <Card className="border-border/70 shadow-sm">
            <CardContent className="p-4 flex items-center justify-between gap-3">
              {hasRider && riderProfile ? (
                <>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20 overflow-hidden">
                      {riderProfile.avatar_url ? (
                        <img src={riderProfile.avatar_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <i className="fa-solid fa-motorcycle text-base" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Assigned Rider</p>
                      <p className="font-heading font-bold text-sm truncate">{riderProfile.full_name}</p>
                      {riderSettings && (
                        <p className="text-xs text-muted-foreground capitalize truncate">
                          {riderSettings.vehicle_type} {riderSettings.plate_number ? `· ${riderSettings.plate_number}` : ''}
                        </p>
                      )}
                    </div>
                  </div>
                  {riderProfile.phone && (
                    <a href={`tel:${riderProfile.phone}`} className="shrink-0">
                      <Button size="sm" variant="outline" className="gap-1.5 rounded-xl text-xs font-semibold">
                        <i className="fa-solid fa-phone text-primary text-[11px]" />
                        <span>Call</span>
                      </Button>
                    </a>
                  )}
                </>
              ) : (
                <div className="flex items-center gap-3 py-1">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                    <i className="fa-solid fa-motorcycle text-sm animate-pulse" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Dispatch Rider</p>
                    <p className="text-xs font-semibold text-foreground">
                      {liveOrder.status === 'ready' ? 'Matching closest campus rider...' : 'Assigned when meal is ready'}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Vendor & Drop-off Summary Card */}
          <Card className="border-border/70 shadow-sm">
            <CardContent className="p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground">
                  <i className="fa-solid fa-store text-sm text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    {vendorInfo?.name || 'Campus Vendor'}
                  </p>
                  <p className="text-xs font-semibold text-foreground truncate">
                    Drop-off: {liveOrder.delivery_location || 'Live GPS Pin'}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Total: <strong className="text-primary">₦{(Number(liveOrder.total) + Number(liveOrder.delivery_fee)).toLocaleString()}</strong> (₦{Number(liveOrder.delivery_fee).toLocaleString()} delivery)
                  </p>
                </div>
              </div>

              {/* Optional Live GPS Toggle */}
              <Button
                size="sm"
                variant={sharingLocation ? 'secondary' : 'outline'}
                className="shrink-0 text-xs gap-1.5 rounded-xl"
                onClick={async () => {
                  const nextState = !sharingLocation;
                  setSharingLocation(nextState);
                  if (nextState) {
                    getPosition();
                    if (studentPos && user) {
                      await supabase
                        .from('orders')
                        .update({
                          delivery_lat: studentPos.lat,
                          delivery_lng: studentPos.lng,
                        } as any)
                        .eq('id', order.id);
                    }
                    toast({
                      title: 'Live GPS sharing enabled',
                      description: 'Your rider can now see your exact live position on the map.',
                    });
                  } else {
                    toast({
                      title: 'Live GPS sharing paused',
                      description: 'Your pinned drop-off spot remains visible to the rider.',
                    });
                  }
                }}
                title="Toggle live GPS sharing with rider"
              >
                <i className={`fa-solid fa-location-crosshairs text-[11px] ${sharingLocation ? 'text-blue-600 animate-pulse' : 'text-muted-foreground'}`} />
                <span>{sharingLocation ? 'GPS On' : 'Share GPS'}</span>
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* 5. 3-WAY ORDER CHAT */}
        {(hasRider || vendorInfo) && (
          <DeliveryChat
            orderId={order.id}
            otherName={hasRider ? riderProfile?.full_name || 'Rider' : vendorInfo?.name || 'Vendor'}
            participants={chatParticipants}
          />
        )}

        {/* 6. CANCEL ORDER (Only while pending) */}
        {canCancel && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="w-full gap-2 text-destructive border-destructive/30 hover:bg-destructive/5 rounded-xl">
                <i className="fa-solid fa-ban text-xs" />
                <span>Cancel Pending Order</span>
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Cancel this order?</AlertDialogTitle>
                <AlertDialogDescription>
                  Select a reason for cancellation. Once accepted by the kitchen, orders cannot be cancelled.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <Select value={cancelReason} onValueChange={setCancelReason}>
                <SelectTrigger><SelectValue placeholder="Select a reason" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Changed my mind">Changed my mind</SelectItem>
                  <SelectItem value="Taking too long">Taking too long</SelectItem>
                  <SelectItem value="Ordered by mistake">Ordered by mistake</SelectItem>
                  <SelectItem value="Found a better option">Found a better option</SelectItem>
                </SelectContent>
              </Select>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep Order</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleCancel}
                  disabled={!cancelReason || cancelling}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {cancelling ? 'Cancelling...' : 'Yes, Cancel'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </div>
  );
};

export default StudentOrderTracking;
