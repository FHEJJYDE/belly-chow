import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import NotificationCenter from '@/components/NotificationCenter';
import logo from '@/assets/belly_chow_logo.png';
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
  Camera, Upload, X, Banknote, ShieldCheck
} from 'lucide-react';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useCampusLocations } from '@/hooks/useCampusLocations';
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
  vendor_lat: number | null;
  vendor_lng: number | null;
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
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isOnline, setIsOnline] = useState(true);
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [riderFee, setRiderFee] = useState(500);
  const [availableOrders, setAvailableOrders] = useState<EnrichedOrder[]>([]);
  const [myOrders, setMyOrders] = useState<EnrichedOrder[]>([]);
  const [deliveryHistory, setDeliveryHistory] = useState<EnrichedOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeDeliveryId, setActiveDeliveryId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('home');
  const { position, error: geoError, getPosition } = useGeolocation(true);
  const { locations: campusLocations } = useCampusLocations();

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

  // Broadcast real live rider GPS to the currently active delivery only.
  // useGeolocation already throttles position updates to every ~4 seconds.
  useEffect(() => {
    if (!position || !user || !activeDeliveryId) return;
    supabase.from('orders').update({
      rider_lat: position.lat,
      rider_lng: position.lng,
    } as any).eq('id', activeDeliveryId).then(() => {});
  }, [position, activeDeliveryId, user]);

  /** Haversine distance in km between two GPS points */
  const haversineKm = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const enrichOrders = async (orders: any[]): Promise<EnrichedOrder[]> => {
    if (orders.length === 0) return [];
    const vendorIds = [...new Set(orders.map((o) => o.vendor_id))];
    const studentIds = [...new Set(orders.map((o) => o.student_id))];
    const orderIds = orders.map((o) => o.id);

    // Fetch vendors, student profiles, and order items with nested menu_items in 1 parallel round-trip
    const [{ data: vendors }, { data: profiles }, { data: orderItems }] = await Promise.all([
      (supabase.from('vendors') as any)
        .select('id, name, address, user_id, lat, lng')
        .in('id', vendorIds),
      supabase.from('profiles').select('user_id, full_name, phone').in('user_id', studentIds),
      supabase
        .from('order_items')
        .select('order_id, quantity, price, menu_item_id, menu_items(name)')
        .in('order_id', orderIds),
    ]);

    const vendorMap = new Map(vendors?.map((v: any) => [v.id, v]) || []);
    const profileMap = new Map(profiles?.map((p: any) => [p.user_id, p]) || []);

    const itemsByOrder = new Map<string, { name: string; quantity: number; price: number }[]>();
    orderItems?.forEach((oi: any) => {
      const list = itemsByOrder.get(oi.order_id) || [];
      list.push({
        name: oi.menu_items?.name || 'Item',
        quantity: oi.quantity,
        price: oi.price,
      });
      itemsByOrder.set(oi.order_id, list);
    });

    return orders.map((o) => {
      const vendor = vendorMap.get(o.vendor_id) as any;
      const profile = profileMap.get(o.student_id) as any;
      return {
        ...o,
        vendor_name: vendor?.name || 'Unknown Vendor',
        vendor_address: vendor?.address || '',
        vendor_lat: vendor ? Number(vendor.lat) || null : null,
        vendor_lng: vendor ? Number(vendor.lng) || null : null,
        vendor_user_id: vendor?.user_id || '',
        customer_name: profile?.full_name || 'Unknown',
        customer_phone: profile?.phone || '',
        items: itemsByOrder.get(o.id) || [],
      };
    });
  };

  // Fetch settings (rider fee + rider personal settings)
  useEffect(() => {
    if (!user) return;
    const fetchSettings = async () => {
      // Fetch platform rider_fee
      const { data: platformData } = await supabase.from('platform_settings').select('*').limit(1).single();
      if (platformData) {
        setRiderFee(Number((platformData as any).rider_fee) || 500);
      }
      // Fetch rider personal settings
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

  // Fetch withdrawals & wallet balance
  useEffect(() => {
    if (!user) return;
    const fetchWithdrawalsAndWallet = async () => {
      const [{ data: reqs }, { data: wallet }] = await Promise.all([
        (supabase.from('withdrawal_requests') as any).select('id, amount, status, created_at').eq('user_id', user.id).order('created_at', { ascending: false }),
        (supabase.rpc as any)('get_or_create_wallet', { p_user_id: user.id }),
      ]);
      setWithdrawals(reqs || []);
      if (wallet && typeof wallet.balance !== 'undefined') {
        setWalletBalance(Number(wallet.balance) || 0);
      }
    };
    fetchWithdrawalsAndWallet();
  }, [user]);

  const fetchOrders = useCallback(async () => {
    if (!user) return;
    const [avail, mine, history] = await Promise.all([
      supabase.from('orders').select('*').eq('status', 'ready').is('rider_id', null).order('created_at', { ascending: false }).limit(30),
      supabase.from('orders').select('*').eq('rider_id', user.id).in('status', ['picked_up', 'delivering', 'arrived']).order('created_at', { ascending: false }).limit(10),
      supabase.from('orders').select('*').eq('rider_id', user.id).eq('status', 'delivered').order('created_at', { ascending: false }).limit(50),
    ]);
    const availList = avail.data || [];
    const mineList = mine.data || [];
    const historyList = history.data || [];

    const combinedMap = new Map<string, any>();
    [...availList, ...mineList, ...historyList].forEach((o) => combinedMap.set(o.id, o));
    const allEnriched = await enrichOrders(Array.from(combinedMap.values()));
    const enrichedById = new Map(allEnriched.map((o) => [o.id, o]));

    const enrichedAvail = availList.map((o) => enrichedById.get(o.id)!).filter(Boolean);
    const enrichedMine = mineList.map((o) => enrichedById.get(o.id)!).filter(Boolean);
    const enrichedHistory = historyList.map((o) => enrichedById.get(o.id)!).filter(Boolean);
    setAvailableOrders(enrichedAvail);
    setMyOrders(enrichedMine);
    setDeliveryHistory(enrichedHistory);
    setLoading(false);
    if (enrichedMine.length > 0 && !activeDeliveryId) {
      setActiveDeliveryId(enrichedMine[0].id);
    }
  }, [user, activeDeliveryId]);

  useEffect(() => {
    if (!user) return;
    fetchOrders();
    const channel = supabase.channel('rider-orders').on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
      if (payload.eventType === 'UPDATE') {
        const newRow = payload.new as any;
        const oldRow = payload.old as any;
        if (newRow && oldRow && newRow.status === oldRow.status && newRow.rider_id === oldRow.rider_id) {
          setMyOrders(prev => prev.map(o => o.id === newRow.id ? {
            ...o,
            delivery_lat: newRow.delivery_lat,
            delivery_lng: newRow.delivery_lng,
            rider_lat: newRow.rider_lat,
            rider_lng: newRow.rider_lng
          } : o));
          return;
        }
      }
      fetchOrders();
    }).subscribe();

    // Active polling fallback every 6 seconds so available orders & claims stay synced even if realtime reconnects
    const poll = setInterval(() => {
      fetchOrders();
    }, 6000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
    };
  }, [user, fetchOrders]);

  // Sort available orders by proximity to the rider (closest vendor first)
  const sortedAvailableOrders = useMemo(() => {
    if (!position || availableOrders.length === 0) return availableOrders;
    return [...availableOrders].sort((a, b) => {
      const distA = a.vendor_lat && a.vendor_lng
        ? haversineKm(position.lat, position.lng, a.vendor_lat, a.vendor_lng)
        : Infinity;
      const distB = b.vendor_lat && b.vendor_lng
        ? haversineKm(position.lat, position.lng, b.vendor_lat, b.vendor_lng)
        : Infinity;
      return distA - distB;
    });
  }, [availableOrders, position]);

  const acceptOrder = async (orderId: string) => {
    if (!user) return;
    const targetOrder = availableOrders.find(o => o.id === orderId);

    // 1. Try Atomic RPC first (First-Accept-Wins, prevents 2 riders from claiming the same order)
    let claimedRow: any = null;
    const { data: rpcClaimed, error: rpcErr } = await (supabase.rpc as any)('claim_ready_order', {
      p_order_id: orderId,
      p_rider_lat: position?.lat ?? null,
      p_rider_lng: position?.lng ?? null,
    });

    if (!rpcErr && rpcClaimed && rpcClaimed.id) {
      claimedRow = rpcClaimed;
    } else if (rpcErr?.message?.includes('ORDER_ALREADY_CLAIMED')) {
      setAvailableOrders(prev => prev.filter(o => o.id !== orderId));
      toast({
        title: 'Order already claimed',
        description: 'Another nearby rider accepted this delivery a split-second before you.',
        variant: 'destructive',
      });
      fetchOrders();
      return;
    } else {
      // Fallback conditional atomic update (.is('rider_id', null).eq('status', 'ready')) if RPC migration hasn't been run yet
      const updateData: any = { rider_id: user.id, status: 'picked_up' };
      if (position) {
        updateData.rider_lat = position.lat;
        updateData.rider_lng = position.lng;
      }
      const { data: updatedRows, error: updateErr } = await supabase
        .from('orders')
        .update(updateData)
        .eq('id', orderId)
        .is('rider_id', null)
        .eq('status', 'ready')
        .select();

      if (updateErr) {
        toast({ title: 'Could not claim order', description: updateErr.message, variant: 'destructive' });
        return;
      }
      if (!updatedRows || updatedRows.length === 0) {
        setAvailableOrders(prev => prev.filter(o => o.id !== orderId));
        toast({
          title: 'Order already claimed or restricted',
          description: 'This order was either claimed by another rider or requires running the latest SQL policy.',
          variant: 'destructive',
        });
        fetchOrders();
        return;
      }
      claimedRow = updatedRows[0];
    }

    // 2. Immediately move order into myOrders state and open the Active Delivery Map screen without waiting for Realtime!
    if (targetOrder) {
      const updatedOrder: EnrichedOrder = {
        ...targetOrder,
        status: 'picked_up',
        rider_id: user.id,
        rider_lat: position?.lat ?? targetOrder.rider_lat,
        rider_lng: position?.lng ?? targetOrder.rider_lng,
      };
      setAvailableOrders(prev => prev.filter(o => o.id !== orderId));
      setMyOrders(prev => [updatedOrder, ...prev.filter(o => o.id !== orderId)]);
    }
    setActiveDeliveryId(orderId);

    // 3. Send in-app notification to Student & Vendor
    const shortId = orderId.slice(0, 8);
    if (targetOrder?.student_id) {
      await supabase.from('notifications').insert({
        user_id: targetOrder.student_id,
        title: 'Order Picked Up by Rider',
        message: `Your rider has picked up order #${shortId} from ${targetOrder.vendor_name} and is preparing to head your way.`,
        type: 'order_update',
        order_id: orderId,
      });
    }
    if (targetOrder?.vendor_user_id) {
      await supabase.from('notifications').insert({
        user_id: targetOrder.vendor_user_id,
        title: 'Order Claimed by Rider',
        message: `A dispatch rider has claimed and picked up order #${shortId}.`,
        type: 'order_update',
        order_id: orderId,
      });
    }

    toast({ title: 'Delivery claimed! Opening live route map...' });
    fetchOrders();
  };

  const updateStatus = async (orderId: string, status: string) => {
    const targetOrder = myOrders.find(o => o.id === orderId);
    const { data: updated, error } = await supabase
      .from('orders')
      .update({ status: status as any })
      .eq('id', orderId)
      .select();

    if (error || !updated || updated.length === 0) {
      toast({
        title: 'Error updating status',
        description: error?.message || 'Could not update order status.',
        variant: 'destructive',
      });
      return;
    }

    // Optimistically update local myOrders immediately
    setMyOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o));

    // Send notification to Student
    if (targetOrder?.student_id && status === 'delivering') {
      await supabase.from('notifications').insert({
        user_id: targetOrder.student_id,
        title: 'Rider On The Way!',
        message: `Your rider is now in transit with your order #${orderId.slice(0, 8)} from ${targetOrder.vendor_name}. Track live on your map!`,
        type: 'order_update',
        order_id: orderId,
      });
    }

    toast({ title: `Order marked as ${status.replace('_', ' ')}` });
    if (status === 'delivered') {
      setActiveDeliveryId(null);
      setDeliveryProof(null);
      setDeliveryProofPreview(null);
    }
    fetchOrders();
  };

  const cancelDelivery = async (orderId: string) => {
    const { error } = await supabase
      .from('orders')
      .update({ rider_id: null, rider_lat: null, rider_lng: null, status: 'ready' as any } as any)
      .eq('id', orderId);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    setMyOrders(prev => prev.filter(o => o.id !== orderId));
    toast({ title: 'Delivery cancelled. Order returned to pool.' });
    setActiveDeliveryId(null);
    fetchOrders();
  };

  const openInGoogleMaps = (lat: number, lng: number) => {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
  };

  // Image compression helper for mobile phone camera uploads
  const compressImage = (file: File, maxWidth = 1600, quality = 0.8): Promise<File> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (blob) {
                const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", {
                  type: 'image/jpeg',
                  lastModified: Date.now(),
                });
                resolve(compressedFile);
              } else {
                resolve(file);
              }
            },
            'image/jpeg',
            quality
          );
        };
        img.onerror = () => resolve(file);
      };
      reader.onerror = () => resolve(file);
    });
  };

  // Delivery proof handlers
  const handleProofSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) { 
      toast({ title: 'File too large', description: 'Photo must be under 25MB.', variant: 'destructive' }); 
      return; 
    }
    const compressed = await compressImage(file);
    setDeliveryProof(compressed);
    setDeliveryProofPreview(URL.createObjectURL(compressed));
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

  const handleDeliverWithProof = async (orderId: string, finalDelivered = false) => {
    const targetOrder = myOrders.find(o => o.id === orderId);
    let proofUrl: string | null = null;
    if (deliveryProof) {
      proofUrl = await uploadDeliveryProof(orderId);
    }

    const nextStatus = finalDelivered ? 'delivered' : 'arrived';
    const updateData: any = {
      status: nextStatus,
      ...(finalDelivered ? { payment_status: 'confirmed' } : {}),
    };
    if (proofUrl) updateData.delivery_proof_url = proofUrl;

    let { error } = await supabase.from('orders').update(updateData).eq('id', orderId);

    // Fallback: if the database enum doesn't have 'arrived' yet, complete directly to 'delivered'
    if (error && !finalDelivered && error.message?.toLowerCase().includes('order_status')) {
      const fallbackRes = await supabase
        .from('orders')
        .update({
          status: 'delivered' as any,
          payment_status: 'confirmed' as any,
          ...(proofUrl ? { delivery_proof_url: proofUrl } : {}),
        })
        .eq('id', orderId);
      error = fallbackRes.error;
      if (!error) {
        finalDelivered = true;
      }
    }

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }

    if (finalDelivered) {
      await (supabase.rpc as any)('release_order_escrow', { p_order_id: orderId });
      setMyOrders(prev => prev.filter(o => o.id !== orderId));
      if (targetOrder) {
        setDeliveryHistory(prev => [{ ...targetOrder, status: 'delivered', payment_status: 'confirmed' }, ...prev.filter(o => o.id !== orderId)]);
      }
      setActiveDeliveryId(null);

      if (targetOrder?.student_id) {
        await supabase.from('notifications').insert({
          user_id: targetOrder.student_id,
          title: 'Order Delivered & Fulfilled!',
          message: `Your order #${orderId.slice(0, 8)} has been delivered by your rider. Enjoy your meal!`,
          type: 'success',
          order_id: orderId,
        });
      }
      if (targetOrder?.vendor_user_id) {
        await supabase.from('notifications').insert({
          user_id: targetOrder.vendor_user_id,
          title: 'Order Delivered & Fulfilled!',
          message: `Order #${orderId.slice(0, 8)} has been delivered to the customer and earnings have been credited to your wallet.`,
          type: 'success',
          order_id: orderId,
        });
      }

      toast({
        title: 'Order Fulfilled & Delivered!',
        description: `₦${riderFee.toLocaleString()} has been credited to your earnings.`,
      });
    } else {
      setMyOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'arrived' } : o));

      if (targetOrder?.student_id) {
        await supabase.from('notifications').insert({
          user_id: targetOrder.student_id,
          title: 'Your Rider Has Arrived!',
          message: `Your rider has arrived at your drop-off location for order #${orderId.slice(0, 8)}. Please meet them to collect your meal.`,
          type: 'success',
          order_id: orderId,
        });
      }

      toast({ title: 'Customer notified of your arrival! Tap "Complete Delivery" once handed over.' });
    }

    setDeliveryProof(null);
    setDeliveryProofPreview(null);
    fetchOrders();
  };

  // Withdrawal
  const submitWithdrawal = async () => {
    const grossAmount = Number(withdrawAmount);
    if (!user || !withdrawAmount || grossAmount <= 0) return;
    if (!riderSettings.bank_name || !riderSettings.account_number) {
      toast({ title: 'Please set your bank details in Settings first', variant: 'destructive' });
      return;
    }
    const serviceFee = Math.floor(grossAmount / 1000) * 50;
    const netAmount = Math.max(0, grossAmount - serviceFee);

    setSubmittingWithdrawal(true);
    const { error } = await (supabase.from('withdrawal_requests') as any).insert({
      user_id: user.id,
      amount: grossAmount,
      service_fee: serviceFee,
      net_amount: netAmount,
      bank_name: riderSettings.bank_name,
      account_number: riderSettings.account_number,
      account_name: riderSettings.account_name,
    });
    setSubmittingWithdrawal(false);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Withdrawal request submitted! 💰', description: `Service fee: ₦${serviceFee} · Net payout: ₦${netAmount.toLocaleString()}` });
    setWithdrawAmount('');
    // Refresh
    const { data } = await (supabase.from('withdrawal_requests') as any).select('id, amount, service_fee, net_amount, status, created_at').eq('user_id', user.id).order('created_at', { ascending: false });
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
    // Use the fixed rider_fee per delivery, not the full delivery_fee (which includes platform cut)
    const calc = (from: Date) => deliveryHistory.filter(o => new Date(o.created_at) >= from).length * riderFee;
    const countFrom = (from: Date) => deliveryHistory.filter(o => new Date(o.created_at) >= from).length;
    return {
      today: calc(todayStart), todayCount: countFrom(todayStart),
      week: calc(weekStart), weekCount: countFrom(weekStart),
      month: calc(monthStart), monthCount: countFrom(monthStart),
      total: deliveryHistory.length * riderFee,
      totalCount: deliveryHistory.length,
    };
  }, [deliveryHistory, riderFee]);

  if (loading) return <div className="flex min-h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;

  const activeOrder = myOrders.find(o => o.id === activeDeliveryId);

  // ──────────────────────────────────────────────
  // ACTIVE DELIVERY VIEW
  // ──────────────────────────────────────────────
  if (activeOrder) {
    const statusSteps = [
      { key: 'picked_up', label: 'Picked Up', icon: Package },
      { key: 'delivering', label: 'On the Way', icon: Truck },
      { key: 'arrived', label: 'Arrived', icon: CheckCircle2 },
      { key: 'delivered', label: 'Confirmed', icon: CheckCircle2 },
    ];
    const currentStepIndex = statusSteps.findIndex(s => s.key === activeOrder.status);
    const effectiveRiderLat = position?.lat ?? activeOrder.rider_lat ?? null;
    const effectiveRiderLng = position?.lng ?? activeOrder.rider_lng ?? null;

    // Resolve drop-off coordinates from order or matched campus building so rider ALWAYS gets live turn-by-turn directions
    const matchedCampusSpot = campusLocations.find(
      (loc) =>
        loc.lat != null &&
        loc.lng != null &&
        activeOrder.delivery_location?.toLowerCase().includes(loc.name.toLowerCase())
    );
    const effectiveCustomerLat =
      activeOrder.delivery_lat ?? (matchedCampusSpot?.lat ? Number(matchedCampusSpot.lat) : null);
    const effectiveCustomerLng =
      activeOrder.delivery_lng ?? (matchedCampusSpot?.lng ? Number(matchedCampusSpot.lng) : null);
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
          <DeliveryMap
            riderLat={effectiveRiderLat}
            riderLng={effectiveRiderLng}
            customerLat={effectiveCustomerLat}
            customerLng={effectiveCustomerLng}
            vendorLat={activeOrder.vendor_lat}
            vendorLng={activeOrder.vendor_lng}
            riderLabel="You (Live GPS)"
            customerLabel={activeOrder.delivery_location?.split(' • ')[0] || 'Customer Drop-off'}
            vendorLabel={activeOrder.vendor_name}
            showDirectionsBanner={true}
            height="360px"
            className="rounded-none border-x-0"
          />
        </div>

        {/* Rider Active Trip Telemetry & Quick Navigation Bar */}
        <div className="bg-slate-900 text-white px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2.5">
            {effectiveRiderLat && effectiveRiderLng ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 px-2.5 py-0.5 font-semibold">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Your GPS Pin Active
              </span>
            ) : (
              <button
                type="button"
                onClick={() => getPosition()}
                className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/20 border border-amber-400/30 text-amber-300 px-2.5 py-0.5 font-semibold"
              >
                <i className="fa-solid fa-location-crosshairs animate-spin text-[10px]" />
                Tap to Lock Your GPS Pin
              </button>
            )}
            <span className="text-slate-300 truncate max-w-[200px] sm:max-w-xs">
              → {activeOrder.delivery_location || 'Customer Drop-off'}
            </span>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {effectiveCustomerLat && effectiveCustomerLng && (
              <Button
                size="sm"
                className="h-7 text-xs gap-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white font-semibold"
                onClick={() => openInGoogleMaps(effectiveCustomerLat, effectiveCustomerLng)}
              >
                <i className="fa-solid fa-diamond-turn-right text-[11px]" />
                <span>Voice GPS</span>
              </Button>
            )}
          </div>
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
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Food Subtotal</span><span>₦{Number(activeOrder.total).toLocaleString()}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Your Earnings</span><span className="font-semibold text-primary">₦{riderFee.toLocaleString()}</span></div>
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

          {activeOrder.status === 'arrived' && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-center space-y-1">
              <div className="flex items-center justify-center gap-2 font-semibold text-sm text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4" />
                <span>Arrived at Drop-off — Hand Package to Customer</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Once you hand the meal to the customer, tap Complete Delivery below to fulfill the order and credit your wallet.
              </p>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-2.5">
            {activeOrder.status === 'picked_up' && (
              <Button className="flex-1 h-12 text-base gap-2" onClick={() => updateStatus(activeOrder.id, 'delivering')}>
                <Truck className="h-5 w-5" /> I'm On the Way
              </Button>
            )}
            {activeOrder.status === 'delivering' && (
              <>
                <Button
                  variant="outline"
                  className="flex-1 h-12 text-sm font-semibold gap-2 border-primary/40 text-primary hover:bg-primary/10"
                  disabled={uploadingProof}
                  onClick={() => handleDeliverWithProof(activeOrder.id, false)}
                >
                  <i className="fa-solid fa-bell text-xs" />
                  <span>Notify Customer I've Arrived</span>
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button className="flex-1 h-12 text-sm font-bold gap-2 bg-emerald-600 hover:bg-emerald-700 text-white" disabled={uploadingProof}>
                      <CheckCircle2 className="h-5 w-5" />
                      <span>{uploadingProof ? 'Uploading...' : 'Complete Delivery (Handed Over)'}</span>
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Confirm Order Delivered & Fulfilled?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Confirm that you have handed the meal to {activeOrder.customer_name}. This will mark the order as fulfilled and credit ₦{riderFee.toLocaleString()} to your wallet.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Not Yet</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleDeliverWithProof(activeOrder.id, true)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                      >
                        Yes, Order Delivered
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}
            {activeOrder.status === 'arrived' && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button className="w-full h-12 text-base font-bold gap-2 bg-emerald-600 hover:bg-emerald-700 text-white" disabled={uploadingProof}>
                    <CheckCircle2 className="h-5 w-5" />
                    <span>{uploadingProof ? 'Completing...' : 'Complete Delivery (Handed to Customer)'}</span>
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirm Order Delivered & Fulfilled?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Confirm that you have handed the package to {activeOrder.customer_name}. This will mark the order as fulfilled and release earnings to you and the vendor.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => handleDeliverWithProof(activeOrder.id, true)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      Yes, Fulfill & Complete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
          {activeOrder.status !== 'arrived' && (
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
          )}
        </div>
      </div>
    );
  }

  // ──────────────────────────────────────────
  // TABBED DEFAULT VIEW (Rider Dispatch App Shell)
  // ──────────────────────────────────────────
  const handleSignOut = async () => {
    try {
      await signOut();
    } finally {
      navigate('/login', { replace: true });
    }
  };

  const navItems = [
    { id: 'home', label: 'Dispatch', icon: 'fa-solid fa-motorcycle', badge: sortedAvailableOrders.length + myOrders.length },
    { id: 'history', label: 'Trips', icon: 'fa-solid fa-clock-rotate-left' },
    { id: 'earnings', label: 'Earnings', icon: 'fa-solid fa-sack-dollar' },
    { id: 'settings', label: 'Vehicle & Bank', icon: 'fa-solid fa-id-card' },
  ];

  return (
    <div className="min-h-screen bg-background pb-24 md:pb-10">
      {/* Dedicated Rider Top Navbar */}
      <header className="sticky top-0 z-40 border-b border-border/70 bg-card/95 backdrop-blur-xl">
        <div className="container max-w-4xl flex h-15 items-center justify-between gap-2 py-2.5">
          {/* Brand + Rider Badge */}
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-xl overflow-hidden border border-primary/30 bg-background p-0.5 shrink-0">
              <img src={logo} alt="Belly-Chow" className="h-full w-full object-contain" />
            </div>
            <div>
              <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary block w-fit">
                Rider Console
              </span>
              <p className="text-[11px] text-muted-foreground hidden sm:block mt-0.5">
                {position ? 'GPS Signal Locked' : 'Waiting for GPS Signal'}
              </p>
            </div>
          </div>

          {/* Desktop Center Navigation Pills */}
          <nav className="hidden md:flex items-center gap-1 rounded-xl bg-muted/60 p-1 border border-border/50">
            {navItems.map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`relative flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
                    active
                      ? 'bg-card text-primary shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <i className={`${item.icon} text-xs`} />
                  <span>{item.label}</span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="ml-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Right Action Controls: Online Toggle Pill + Today's Pay + Profile */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsOnline(!isOnline)}
              className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold border transition-all ${
                isOnline
                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                  : 'bg-muted text-muted-foreground border-border'
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground'}`} />
              <span>{isOnline ? 'Online' : 'Offline'}</span>
            </button>

            <NotificationCenter />

            <Link to="/profile">
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-muted-foreground hover:text-foreground" title="My Profile & ID Verification">
                <i className="fa-solid fa-user text-sm" />
              </Button>
            </Link>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-muted-foreground hover:text-destructive" title="Sign Out">
                  <i className="fa-solid fa-right-from-bracket text-sm" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="rounded-2xl">
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirm Logout</AlertDialogTitle>
                  <AlertDialogDescription>Are you sure you want to sign out of your Rider account?</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleSignOut} className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Sign Out
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </header>

      <div className="container max-w-4xl py-5 space-y-5">
        {/* Top Compact Summary Bar */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="border-border/60 shadow-sm cursor-pointer hover:border-primary/40 transition-colors" onClick={() => setActiveTab('earnings')}>
            <CardContent className="p-3.5 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-medium text-muted-foreground">Today's Pay</p>
                <p className="font-heading text-lg sm:text-xl font-bold text-primary mt-0.5">₦{earnings.today.toLocaleString()}</p>
                <p className="text-[10px] text-muted-foreground">{earnings.todayCount} trips today</p>
              </div>
              <div className="hidden sm:flex h-9 w-9 rounded-xl bg-primary/10 border border-primary/20 items-center justify-center text-primary">
                <i className="fa-solid fa-sack-dollar text-xs" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-sm cursor-pointer hover:border-primary/40 transition-colors" onClick={() => setActiveTab('earnings')}>
            <CardContent className="p-3.5 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-medium text-muted-foreground">Wallet Balance</p>
                <p className="font-heading text-lg sm:text-xl font-bold mt-0.5">₦{Math.max(walletBalance, earnings.total).toLocaleString()}</p>
                <p className="text-[10px] text-emerald-600 font-medium">Tap to cash out</p>
              </div>
              <div className="hidden sm:flex h-9 w-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 items-center justify-center text-emerald-600">
                <i className="fa-solid fa-wallet text-xs" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-sm">
            <CardContent className="p-3.5 flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-muted-foreground">GPS Radar</p>
                <p className={`font-heading text-sm sm:text-base font-bold mt-1 truncate ${position ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {position ? 'Locked' : 'Locating...'}
                </p>
                <button
                  type="button"
                  onClick={() => getPosition()}
                  className="text-[10px] text-primary hover:underline font-semibold flex items-center gap-1 mt-0.5"
                >
                  <i className="fa-solid fa-rotate text-[9px]" /> Refresh
                </button>
              </div>
              <div className={`hidden sm:flex h-9 w-9 rounded-xl border items-center justify-center ${position ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-amber-500/10 text-amber-600 border-amber-500/20'}`}>
                <i className="fa-solid fa-location-crosshairs text-xs" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          {/* ═══════ HOME / DISPATCH TAB ═══════ */}
          <TabsContent value="home" className="space-y-5 mt-0">
            {/* 0. Rider Live Position & Nearby Campus Radar Map */}
            {isOnline && (
              <Card className="overflow-hidden border-border/70 shadow-sm">
                <div className="bg-card px-4 py-2.5 border-b border-border/60 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${position ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                    <span className="font-heading text-xs font-bold text-foreground">
                      {position ? 'Your Live GPS Position on Campus' : 'Acquiring Your GPS Position...'}
                    </span>
                  </div>
                  {position && (
                    <span className="text-[11px] font-mono text-muted-foreground">
                      {position.lat.toFixed(5)}, {position.lng.toFixed(5)}
                    </span>
                  )}
                </div>
                <DeliveryMap
                  riderLat={position?.lat ?? myOrders[0]?.rider_lat ?? null}
                  riderLng={position?.lng ?? myOrders[0]?.rider_lng ?? null}
                  customerLat={
                    myOrders[0]?.delivery_lat ??
                    sortedAvailableOrders[0]?.delivery_lat ??
                    null
                  }
                  customerLng={
                    myOrders[0]?.delivery_lng ??
                    sortedAvailableOrders[0]?.delivery_lng ??
                    null
                  }
                  vendorLat={
                    myOrders[0]?.vendor_lat ??
                    sortedAvailableOrders[0]?.vendor_lat ??
                    null
                  }
                  vendorLng={
                    myOrders[0]?.vendor_lng ??
                    sortedAvailableOrders[0]?.vendor_lng ??
                    null
                  }
                  riderLabel="You (Live GPS)"
                  customerLabel={
                    myOrders[0]
                      ? myOrders[0].delivery_location?.split(' • ')[0] || 'Active Drop-off'
                      : sortedAvailableOrders[0]
                      ? sortedAvailableOrders[0].delivery_location?.split(' • ')[0] || 'Next Drop-off'
                      : 'Drop-off'
                  }
                  vendorLabel={
                    myOrders[0]?.vendor_name ||
                    sortedAvailableOrders[0]?.vendor_name ||
                    'Kitchen'
                  }
                  showDirectionsBanner={Boolean(myOrders[0] || sortedAvailableOrders[0])}
                  height="240px"
                  className="rounded-none border-0"
                />
              </Card>
            )}

            {/* 1. Active Assigned Deliveries */}
            {myOrders.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="font-heading text-base font-bold flex items-center gap-2 text-foreground">
                    <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary text-primary-foreground text-xs">
                      <i className="fa-solid fa-motorcycle" />
                    </span>
                    <span>Your Active Trip ({myOrders.length})</span>
                  </h2>
                  <span className="text-xs text-primary font-semibold">Tap card to open live map →</span>
                </div>

                <div className="space-y-3">
                  {myOrders.map(order => (
                    <Card
                      key={order.id}
                      className="cursor-pointer border-2 border-primary/40 bg-primary/5 hover:border-primary transition-all shadow-sm"
                      onClick={() => setActiveDeliveryId(order.id)}
                    >
                      <CardContent className="p-4 flex items-center justify-between gap-4">
                        <div className="space-y-1.5 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-heading font-bold text-sm">Order #{order.id.slice(0, 8)}</span>
                            <Badge className="uppercase text-[10px]">{order.status.replace('_', ' ')}</Badge>
                          </div>
                          <p className="text-xs font-medium text-foreground flex items-center gap-1.5 truncate">
                            <i className="fa-solid fa-store text-primary text-[11px] w-3.5" />
                            <span>Pickup: <strong>{order.vendor_name}</strong></span>
                          </p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1.5 truncate">
                            <i className="fa-solid fa-location-dot text-blue-600 text-[11px] w-3.5" />
                            <span>Drop-off: <strong>{order.delivery_location || 'Live GPS Pin'}</strong></span>
                          </p>
                        </div>
                        <div className="text-right shrink-0 space-y-2">
                          <p className="font-heading font-extrabold text-base text-primary">+₦{riderFee.toLocaleString()}</p>
                          <Button size="sm" className="h-8 text-xs font-bold gap-1.5 rounded-xl">
                            <span>Open Map</span>
                            <i className="fa-solid fa-arrow-right text-[10px]" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* 2. Available Orders Pool */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-heading text-base font-bold flex items-center gap-2">
                  <i className="fa-solid fa-boxes-packing text-primary text-sm" />
                  <span>Ready for Pickup ({sortedAvailableOrders.length})</span>
                </h2>
                {position && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <i className="fa-solid fa-location-arrow text-primary text-[10px]" /> Closest first
                  </span>
                )}
              </div>

              {!isOnline ? (
                <Card className="border-dashed">
                  <CardContent className="py-12 text-center space-y-3">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                      <i className="fa-solid fa-power-off text-lg" />
                    </div>
                    <div>
                      <p className="font-heading font-bold text-base">You are currently Offline</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Switch to Online in the top bar to receive campus delivery requests.</p>
                    </div>
                    <Button size="sm" onClick={() => setIsOnline(true)} className="gap-1.5 rounded-xl">
                      <i className="fa-solid fa-bolt text-xs" /> Go Online Now
                    </Button>
                  </CardContent>
                </Card>
              ) : sortedAvailableOrders.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="py-12 text-center space-y-2">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <i className="fa-solid fa-radar text-lg animate-spin" />
                    </div>
                    <p className="font-heading font-semibold text-sm">Scanning for Ready Orders...</p>
                    <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                      As soon as a campus vendor marks an order ready for pickup, it will pop up here automatically.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-3.5 sm:grid-cols-2">
                  {sortedAvailableOrders.map(order => {
                    const distKm = position && order.vendor_lat && order.vendor_lng
                      ? haversineKm(position.lat, position.lng, order.vendor_lat, order.vendor_lng)
                      : null;
                    return (
                      <Card key={order.id} className="overflow-hidden border-border/80 shadow-sm hover:border-primary/40 transition-all flex flex-col justify-between">
                        <div>
                          {/* Top Payout Header */}
                          <div className="bg-primary/10 border-b border-primary/15 px-4 py-2.5 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-heading font-bold text-xs text-foreground">
                                #{order.id.slice(0, 8)}
                              </span>
                              <span className="text-[11px] text-muted-foreground">
                                · {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              {distKm !== null && (
                                <Badge variant="outline" className="bg-background/80 text-[10px] font-semibold gap-1">
                                  <i className="fa-solid fa-route text-primary text-[9px]" />
                                  {distKm < 1 ? `${Math.round(distKm * 1000)}m` : `${distKm.toFixed(1)}km`}
                                </Badge>
                              )}
                              <span className="font-heading font-extrabold text-sm text-primary">
                                +₦{riderFee.toLocaleString()}
                              </span>
                            </div>
                          </div>

                          {/* Route Timeline: Pickup -> Dropoff */}
                          <div className="p-4 space-y-3">
                            <div className="relative pl-5 space-y-3 before:absolute before:left-[7px] before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
                              <div className="relative">
                                <span className="absolute -left-5 top-1 h-3 w-3 rounded-full border-2 border-slate-900 bg-background" />
                                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Pickup Kitchen</p>
                                <p className="text-sm font-bold text-foreground">{order.vendor_name}</p>
                                {order.vendor_address && (
                                  <p className="text-xs text-muted-foreground truncate">{order.vendor_address}</p>
                                )}
                              </div>

                              <div className="relative">
                                <span className="absolute -left-5 top-1 h-3 w-3 rounded-full border-2 border-primary bg-primary" />
                                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Student Drop-off</p>
                                <p className="text-sm font-bold text-foreground">{order.delivery_location || 'Live GPS Location'}</p>
                                <p className="text-xs text-muted-foreground">{order.customer_name}</p>
                              </div>
                            </div>

                            {order.items.length > 0 && (
                              <div className="rounded-xl bg-muted/50 px-3 py-2 text-xs flex items-center justify-between">
                                <span className="font-medium text-muted-foreground flex items-center gap-1.5 truncate">
                                  <i className="fa-solid fa-bag-shopping text-primary text-[11px]" />
                                  <span className="truncate">
                                    {order.items.map((item) => `${item.quantity}x ${item.name}`).join(', ')}
                                  </span>
                                </span>
                                <span className="text-[11px] font-semibold shrink-0 ml-2">
                                  {order.items.length} item{order.items.length !== 1 ? 's' : ''}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="px-4 pb-4 pt-1">
                          <Button className="w-full font-bold gap-2 rounded-xl h-10 shadow-sm" onClick={() => acceptOrder(order.id)}>
                            <i className="fa-solid fa-motorcycle text-xs" />
                            <span>Accept & Start Pickup</span>
                          </Button>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </TabsContent>

          {/* ═══════ HISTORY TAB ═══════ */}
          <TabsContent value="history" className="space-y-3">
            <h2 className="font-heading text-lg font-semibold flex items-center gap-2"><History className="h-5 w-5 text-muted-foreground" /> Delivery History</h2>
            {deliveryHistory.length === 0 ? (
              <Card><CardContent className="py-10 text-center text-muted-foreground">No completed deliveries yet.</CardContent></Card>
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
                      <div className="text-right"><p className="font-bold text-primary">₦{riderFee.toLocaleString()}</p><p className="text-xs text-muted-foreground">earned</p></div>
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
                {Number(withdrawAmount) > 0 && (
                  <div className="rounded-md bg-muted p-2.5 text-xs space-y-1 border">
                    <div className="flex justify-between"><span>Gross Amount:</span> <span className="font-semibold">₦{Number(withdrawAmount).toLocaleString()}</span></div>
                    <div className="flex justify-between text-muted-foreground"><span>Service Fee (₦50 / ₦1,000):</span> <span>-₦{Math.floor(Number(withdrawAmount) / 1000) * 50}</span></div>
                    <div className="flex justify-between text-primary font-bold pt-1 border-t"><span>Net Payout:</span> <span>₦{(Number(withdrawAmount) - Math.floor(Number(withdrawAmount) / 1000) * 50).toLocaleString()}</span></div>
                  </div>
                )}
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
                    <SelectItem value="motorcycle">Motorcycle</SelectItem>
                    <SelectItem value="bicycle">Bicycle</SelectItem>
                    <SelectItem value="car">Car</SelectItem>
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

      {/* Dedicated Rider Mobile Bottom Navigation Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none md:hidden pb-safe">
        <div className="px-3 pb-3 pt-1">
          <nav className="pointer-events-auto mx-auto max-w-md rounded-2xl border border-border/80 bg-card/95 backdrop-blur-xl shadow-lg p-1.5">
            <div className="flex items-center justify-around gap-1">
              {navItems.map((item) => {
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveTab(item.id)}
                    className={`relative flex flex-1 flex-col items-center justify-center py-2 px-1 rounded-xl text-[10px] font-medium transition-all select-none ${
                      active
                        ? 'bg-primary/10 text-primary font-semibold'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <div className="relative mb-1 flex items-center justify-center">
                      <i className={`${item.icon} text-sm ${active ? 'text-primary' : ''}`} />
                      {item.badge !== undefined && item.badge > 0 && (
                        <span className="absolute -right-3 -top-1.5 flex h-4 min-w-[1rem] px-1 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                          {item.badge > 99 ? '99+' : item.badge}
                        </span>
                      )}
                    </div>
                    <span className="tracking-tight leading-none">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </nav>
        </div>
      </div>
    </div>
  );
};

export default RiderDashboard;
