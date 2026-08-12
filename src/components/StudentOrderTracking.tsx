import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
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
import {
  ArrowLeft, Phone, MessageCircle, MapPin, Navigation, Clock, CheckCircle2,
  Package, Truck, User, Store, XCircle, Locate, LocateOff, Bike, Star
} from 'lucide-react';
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

const STATUS_TIMELINE = [
  { key: 'pending', label: 'Order Placed', icon: Package, emoji: '📝' },
  { key: 'accepted', label: 'Accepted', icon: CheckCircle2, emoji: '✅' },
  { key: 'preparing', label: 'Preparing', icon: Store, emoji: '🍳' },
  { key: 'ready', label: 'Ready', icon: Package, emoji: '📦' },
  { key: 'picked_up', label: 'Picked Up', icon: Bike, emoji: '🏍️' },
  { key: 'delivering', label: 'On the Way', icon: Truck, emoji: '🚀' },
  { key: 'delivered', label: 'Delivered', icon: CheckCircle2, emoji: '🎉' },
];

const StudentOrderTracking = ({ order, onBack, onCancelled }: StudentOrderTrackingProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [liveOrder, setLiveOrder] = useState(order);
  const [riderProfile, setRiderProfile] = useState<{ full_name: string; phone: string; avatar_url: string | null } | null>(null);
  const [riderSettings, setRiderSettings] = useState<{ vehicle_type: string; plate_number: string } | null>(null);
  const [vendorInfo, setVendorInfo] = useState<{ name: string; address: string; user_id: string } | null>(null);
  const [liveRiderPos, setLiveRiderPos] = useState<{ lat: number; lng: number } | null>(
    order.rider_lat && order.rider_lng ? { lat: order.rider_lat, lng: order.rider_lng } : null
  );
  // Auto-share location when rider is involved (accepted → delivering).
  // The student doesn't need to manually tap "Share" — the rider needs their pin.
  const autoShareStatuses = ['accepted', 'preparing', 'ready', 'picked_up', 'delivering'];
  const shouldAutoShare = autoShareStatuses.includes(liveOrder.status);
  const [sharingLocation, setSharingLocation] = useState(shouldAutoShare);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  // Always watch GPS when we should be sharing (watch=true enables continuous watchPosition)
  const { position: studentPos, getPosition } = useGeolocation(sharingLocation);

  // Keep sharingLocation in sync when order status changes
  useEffect(() => {
    if (shouldAutoShare && !sharingLocation) setSharingLocation(true);
  }, [shouldAutoShare, sharingLocation]);

  // Fetch rider profile & vendor info
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
      const { data } = await supabase.from('vendors').select('name, address, user_id').eq('id', order.vendor_id).single();
      if (data) setVendorInfo(data);
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
        // Update rider position from the realtime payload
        if (updated.rider_lat && updated.rider_lng) {
          setLiveRiderPos({ lat: updated.rider_lat, lng: updated.rider_lng });
        }
      }
    ).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [order.id]);

  // Push student GPS to Supabase whenever position updates.
  // useGeolocation already throttles to ~4s so this won't spam the DB.
  useEffect(() => {
    if (!sharingLocation || !studentPos || !user) return;
    supabase.from('orders').update({
      delivery_lat: studentPos.lat,
      delivery_lng: studentPos.lng,
    } as any).eq('id', order.id).then(() => {});
  }, [studentPos, sharingLocation, order.id, user]);

  const currentStatusIndex = STATUS_TIMELINE.findIndex(s => s.key === liveOrder.status);
  const isTerminal = ['delivered', 'cancelled', 'rejected'].includes(liveOrder.status);
  const canCancel = ['pending', 'accepted', 'preparing'].includes(liveOrder.status);
  const hasRider = !!liveOrder.rider_id;
  const isBeingDelivered = ['picked_up', 'delivering'].includes(liveOrder.status);
  // Show the map from 'accepted' onwards so both parties see each other as early as possible
  const showMap = ['accepted', 'preparing', 'ready', 'picked_up', 'delivering'].includes(liveOrder.status);
  // Determine current student GPS for the map pin
  const studentMapLat = studentPos?.lat ?? liveOrder.delivery_lat ?? null;
  const studentMapLng = studentPos?.lng ?? liveOrder.delivery_lng ?? null;

  // Estimated time calculation (simple: based on status)
  const getETA = () => {
    switch (liveOrder.status) {
      case 'pending': return '20-35 min';
      case 'accepted': return '15-30 min';
      case 'preparing': return '10-25 min';
      case 'ready': return '5-15 min';
      case 'picked_up': return '5-10 min';
      case 'delivering': return '2-5 min';
      default: return null;
    }
  };

  const handleCancel = async () => {
    if (!user || !cancelReason) return;
    setCancelling(true);
    const { error } = await supabase.from('orders').update({ status: 'cancelled' as any }).eq('id', order.id);
    setCancelling(false);
    if (error) {
      toast({ title: 'Error cancelling order', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Order cancelled ❌' });
    onCancelled?.();
  };

  // Build chat participants
  const chatParticipants = [
    ...(liveOrder.rider_id && riderProfile ? [{ id: liveOrder.rider_id, name: riderProfile.full_name, role: 'rider' }] : []),
    ...(vendorInfo ? [{ id: vendorInfo.user_id, name: vendorInfo.name, role: 'vendor' }] : []),
  ].filter(p => p.id !== user?.id);

  const eta = getETA();

  if (isTerminal) {
    onBack();
    return null;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-card border-b px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">Order #{order.id.slice(0, 8)}</p>
          <div className="flex items-center gap-2">
            <LivePulse label="Tracking" />
            {eta && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" /> ETA: {eta}
              </span>
            )}
          </div>
        </div>
        <Badge variant="default" className="shrink-0 capitalize">
          {liveOrder.status.replace('_', ' ')}
        </Badge>
      </div>

      {/* Status banner */}
      <div className="bg-primary/5 border-b px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="text-2xl">
            {STATUS_TIMELINE[currentStatusIndex]?.emoji || '📦'}
          </span>
          <div>
            <p className="font-semibold text-sm">
              {liveOrder.status === 'pending' && 'Finding your order a home...'}
              {liveOrder.status === 'accepted' && 'Vendor accepted your order!'}
              {liveOrder.status === 'preparing' && 'Your food is being prepared'}
              {liveOrder.status === 'ready' && 'Ready! Waiting for a rider...'}
              {liveOrder.status === 'picked_up' && 'Rider picked up your order'}
              {liveOrder.status === 'delivering' && 'Your rider is on the way!'}
            </p>
            {eta && <p className="text-xs text-muted-foreground">Estimated: {eta}</p>}
          </div>
        </div>
      </div>

      {/* Map — visible from 'accepted' onwards so both parties can see each other */}
      {showMap && (
        <div className="relative">
          <Suspense fallback={<div className="animate-pulse bg-muted" style={{ height: '320px' }} />}>
            <DeliveryMap
              riderLat={liveRiderPos?.lat}
              riderLng={liveRiderPos?.lng}
              customerLat={studentMapLat}
              customerLng={studentMapLng}
              vendorLat={studentMapLat ? studentMapLat + 0.003 : null}
              vendorLng={studentMapLng ? studentMapLng - 0.004 : null}
              riderLabel="Rider 🏍️"
              customerLabel="You 📍"
              vendorLabel={vendorInfo?.name ?? 'Vendor 🏪'}
              height="320px"
              className="rounded-none"
            />
          </Suspense>
          {/* Overlay when no rider GPS yet */}
          {!liveRiderPos && isBeingDelivered && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/60 backdrop-blur-sm gap-2">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <p className="text-sm font-medium">Waiting for rider location…</p>
            </div>
          )}
          {/* Badge: sharing indicator */}
          {sharingLocation && studentPos && (
            <div className="absolute top-3 right-3 z-[1000] flex items-center gap-1.5 rounded-full bg-blue-500/90 px-3 py-1 text-xs font-medium text-white shadow">
              <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
              Sharing your location
            </div>
          )}
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Rider Card - when assigned */}
        {hasRider && riderProfile && (
          <Card className="border-primary/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-xl">
                  {riderProfile.avatar_url ? (
                    <img src={riderProfile.avatar_url} alt="" className="h-full w-full rounded-full object-cover" />
                  ) : '🏍️'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold">{riderProfile.full_name}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {riderSettings && (
                      <>
                        <span className="capitalize">{riderSettings.vehicle_type}</span>
                        {riderSettings.plate_number && (
                          <>
                            <span>·</span>
                            <span>{riderSettings.plate_number}</span>
                          </>
                        )}
                      </>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  {riderProfile.phone && (
                    <a href={`tel:${riderProfile.phone}`}>
                      <Button size="icon" variant="outline" className="h-10 w-10 rounded-full">
                        <Phone className="h-4 w-4" />
                      </Button>
                    </a>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Waiting for rider */}
        {liveOrder.status === 'ready' && !hasRider && (
          <Card className="border-dashed">
            <CardContent className="p-6 text-center">
              <div className="mb-3 flex justify-center">
                <div className="relative">
                  <Bike className="h-8 w-8 text-primary animate-pulse" />
                </div>
              </div>
              <p className="font-semibold text-sm">Finding a rider near you...</p>
              <p className="text-xs text-muted-foreground mt-1">Your order is ready. We're matching you with a nearby rider.</p>
            </CardContent>
          </Card>
        )}

        {/* Status Timeline */}
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">Order Progress</p>
            <div className="space-y-0">
              {STATUS_TIMELINE.map((step, i) => {
                const isActive = i <= currentStatusIndex;
                const isCurrent = i === currentStatusIndex;
                const Icon = step.icon;
                return (
                  <div key={step.key} className="flex items-start gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all ${
                        isCurrent
                          ? 'border-primary bg-primary text-primary-foreground scale-110'
                          : isActive
                            ? 'border-primary/50 bg-primary/10 text-primary'
                            : 'border-muted bg-muted text-muted-foreground'
                      }`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      {i < STATUS_TIMELINE.length - 1 && (
                        <div className={`w-0.5 h-6 ${isActive ? 'bg-primary/30' : 'bg-muted'}`} />
                      )}
                    </div>
                    <div className="pb-6">
                      <p className={`text-sm font-medium ${isCurrent ? 'text-primary' : isActive ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {step.label}
                      </p>
                      {isCurrent && (
                        <p className="text-xs text-muted-foreground mt-0.5">Current step</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Location Sharing — auto-on when order is active */}
        {shouldAutoShare && (
          <Card className={sharingLocation ? 'border-blue-500/30 bg-blue-500/5' : 'border-dashed'}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {sharingLocation ? (
                    <Locate className="h-5 w-5 text-blue-500 animate-pulse" />
                  ) : (
                    <LocateOff className="h-5 w-5 text-muted-foreground" />
                  )}
                  <div>
                    <p className="text-sm font-medium">
                      {sharingLocation ? 'Your location is being shared' : 'Location sharing is off'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {sharingLocation
                        ? studentPos
                          ? 'Rider can see exactly where you are'
                          : 'Getting GPS fix…'
                        : 'Turn on so your rider can find you'}
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant={sharingLocation ? 'secondary' : 'default'}
                  onClick={() => {
                    if (!sharingLocation) getPosition();
                    setSharingLocation(!sharingLocation);
                  }}
                >
                  {sharingLocation ? 'Stop' : 'Share'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Chat */}
        {(hasRider || vendorInfo) && (
          <DeliveryChat
            orderId={order.id}
            otherName={hasRider ? riderProfile?.full_name || 'Rider' : vendorInfo?.name || 'Vendor'}
            participants={chatParticipants}
          />
        )}

        {/* Order Summary */}
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">Order Summary</p>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>₦{Number(liveOrder.total).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Delivery Fee</span>
                <span>₦{Number(liveOrder.delivery_fee).toLocaleString()}</span>
              </div>
              <Separator className="my-1" />
              <div className="flex justify-between font-semibold">
                <span>Total</span>
                <span className="text-primary">₦{(Number(liveOrder.total) + Number(liveOrder.delivery_fee)).toLocaleString()}</span>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" />
              <span>{liveOrder.delivery_location || 'GPS Location'}</span>
            </div>
          </CardContent>
        </Card>

        {/* Cancel Order */}
        {canCancel && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="w-full gap-2 text-destructive border-destructive/30 hover:bg-destructive/5">
                <XCircle className="h-4 w-4" /> Cancel Order
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Cancel this order?</AlertDialogTitle>
                <AlertDialogDescription>
                  Select a reason for cancellation. This cannot be undone.
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
