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

  // Simulation state
  const [isSimulating, setIsSimulating] = useState(false);
  const [simStep, setSimStep] = useState(0);
  const [totalSimSteps, setTotalSimSteps] = useState(0);
  const [simulatedPos, setSimulatedPos] = useState<{ lat: number; lng: number } | null>(null);
  const simIntervalRef = useRef<any>(null);

  const stopRouteSimulation = useCallback(() => {
    if (simIntervalRef.current) {
      clearInterval(simIntervalRef.current);
      simIntervalRef.current = null;
    }
    setIsSimulating(false);
    setSimulatedPos(null);
    setSimStep(0);
    setTotalSimSteps(0);
    if (activeDeliveryId) {
      localStorage.removeItem(`rider_sim_${activeDeliveryId}`);
      localStorage.removeItem(`rider_sim_step_${activeDeliveryId}`);
    }
  }, [activeDeliveryId]);

  useEffect(() => {
    return () => {
      if (simIntervalRef.current) {
        clearInterval(simIntervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (activeDeliveryId) {
      const savedSim = localStorage.getItem(`rider_sim_${activeDeliveryId}`);
      if (savedSim !== 'true') {
        stopRouteSimulation();
      }
    } else {
      stopRouteSimulation();
    }
  }, [activeDeliveryId, stopRouteSimulation]);

  const startRouteSimulation = async (startStepIndex = 0) => {
    const activeOrder = myOrders.find(o => o.id === activeDeliveryId);
    if (!activeOrder || !activeOrder.delivery_lat || !activeOrder.delivery_lng) {
      toast({ title: 'Cannot simulate', description: 'Customer delivery coordinates are missing.', variant: 'destructive' });
      return;
    }

    const customerLat = activeOrder.delivery_lat;
    const customerLng = activeOrder.delivery_lng;
    const vendorLat = customerLat + 0.003;
    const vendorLng = customerLng - 0.004;

    setIsSimulating(true);
    localStorage.setItem(`rider_sim_${activeDeliveryId}`, 'true');
    if (startStepIndex === 0) {
      toast({ title: 'Starting GPS simulation...', description: 'Fetching OSRM street route...' });
    } else {
      toast({ title: 'Resuming GPS simulation...', description: 'Continuing from last active step...' });
    }

    try {
      const res = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${vendorLng},${vendorLat};${customerLng},${customerLat}?overview=full&geometries=geojson`
      );
      if (!res.ok) throw new Error('OSRM route error');
      const data = await res.json();
      let coords: [number, number][] = [];
      if (data.routes && data.routes[0]) {
        coords = data.routes[0].geometry.coordinates.map(([lng, lat]: [number, number]) => [lat, lng]);
      } else {
        coords = [];
        const steps = 15;
        for (let i = 0; i <= steps; i++) {
          const t = i / steps;
          coords.push([
            vendorLat + (customerLat - vendorLat) * t,
            vendorLng + (customerLng - vendorLng) * t
          ]);
        }
      }

      if (coords.length === 0) {
        stopRouteSimulation();
        return;
      }

      const initialIndex = Math.min(startStepIndex, coords.length - 1);
      setTotalSimSteps(coords.length);
      setSimStep(initialIndex);
      setSimulatedPos({ lat: coords[initialIndex][0], lng: coords[initialIndex][1] });

      let currentIndex = initialIndex;
      await supabase.from('orders').update({
        rider_lat: coords[initialIndex][0],
        rider_lng: coords[initialIndex][1]
      } as any).eq('id', activeOrder.id);

      if (simIntervalRef.current) clearInterval(simIntervalRef.current);

      simIntervalRef.current = setInterval(async () => {
        currentIndex += 1;
        if (currentIndex >= coords.length) {
          stopRouteSimulation();
          toast({ title: 'Simulation complete 🎉', description: 'Rider has reached the destination!' });
          return;
        }

        setSimStep(currentIndex);
        localStorage.setItem(`rider_sim_step_${activeDeliveryId}`, currentIndex.toString());
        const nextPt = coords[currentIndex];
        setSimulatedPos({ lat: nextPt[0], lng: nextPt[1] });
        await supabase.from('orders').update({
          rider_lat: nextPt[0],
          rider_lng: nextPt[1]
        } as any).eq('id', activeOrder.id);
      }, 3000);

    } catch (err) {
      console.error('Failed to initialize route simulation:', err);
      toast({ title: 'Simulation error', description: 'Failed to fetch OSRM route. Check connection.', variant: 'destructive' });
      stopRouteSimulation();
    }
  };

  useEffect(() => {
    if (!activeDeliveryId || myOrders.length === 0 || isSimulating) return;
    const savedSim = localStorage.getItem(`rider_sim_${activeDeliveryId}`);
    if (savedSim === 'true') {
      const savedStep = parseInt(localStorage.getItem(`rider_sim_step_${activeDeliveryId}`) || '0', 10);
      startRouteSimulation(savedStep);
    }
  }, [activeDeliveryId, myOrders, isSimulating]);

  // Broadcast rider GPS to the currently active delivery only.
  // useGeolocation already throttles position updates to every ~4 seconds,
  // so this effect fires at most once per throttle window.
  useEffect(() => {
    if (isSimulating) return; // Prevent real GPS overwriting simulation coords
    if (!position || !user || !activeDeliveryId) return;
    supabase.from('orders').update({
      rider_lat: position.lat,
      rider_lng: position.lng,
    } as any).eq('id', activeDeliveryId).then(() => {});
  }, [position, activeDeliveryId, user, isSimulating]);

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

  useEffect(() => {
    if (!user) return;
    const fetchOrders = async () => {
      const [avail, mine, history] = await Promise.all([
        supabase.from('orders').select('*').eq('status', 'ready').is('rider_id', null).order('created_at', { ascending: false }).limit(30),
        supabase.from('orders').select('*').eq('rider_id', user.id).in('status', ['picked_up', 'delivering', 'arrived']).order('created_at', { ascending: false }).limit(10),
        supabase.from('orders').select('*').eq('rider_id', user.id).eq('status', 'delivered').order('created_at', { ascending: false }).limit(50),
      ]);
      const availList = avail.data || [];
      const mineList = mine.data || [];
      const historyList = history.data || [];

      // Deduplicate & enrich all orders in a single batch instead of 3 separate enrichOrders calls
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
    };
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
    return () => { supabase.removeChannel(channel); };
  }, [user]);

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

  const handleDeliverWithProof = async (orderId: string) => {
    let proofUrl: string | null = null;
    if (deliveryProof) {
      proofUrl = await uploadDeliveryProof(orderId);
    }
    const updateData: any = { status: 'arrived' };
    if (proofUrl) updateData.delivery_proof_url = proofUrl;
    const { error } = await supabase.from('orders').update(updateData).eq('id', orderId);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Ride ended! 🏁 Waiting for customer confirmation.' });
    setDeliveryProof(null);
    setDeliveryProofPreview(null);
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
          <DeliveryMap
            riderLat={isSimulating ? simulatedPos?.lat : position?.lat}
            riderLng={isSimulating ? simulatedPos?.lng : position?.lng}
            customerLat={activeOrder.delivery_lat}
            customerLng={activeOrder.delivery_lng}
            vendorLat={activeOrder.vendor_lat}
            vendorLng={activeOrder.vendor_lng}
            riderLabel="You"
            customerLabel="Customer"
            vendorLabel={activeOrder.vendor_name}
            height="320px"
            className="rounded-none border-x-0"
          />
        </div>

        {/* Rider Active Trip Telemetry & Quick Navigation Bar */}
        <div className="bg-slate-900 text-white px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-3">
            {studentSharingLocation ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 px-2.5 py-0.5 font-semibold">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
                Customer GPS Active
              </span>
            ) : (
              <span className="text-slate-400">Drop-off: {activeOrder.delivery_location}</span>
            )}
          </div>

          <div className="flex items-center gap-3 ml-auto">
            <div className="flex items-center gap-2 rounded-lg bg-white/10 px-2.5 py-1">
              <span className="text-[11px] font-medium flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${isSimulating ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400'}`} />
                {isSimulating ? `Simulating (${simStep + 1}/${totalSimSteps})` : 'GPS Demo'}
              </span>
              <Switch
                checked={isSimulating}
                onCheckedChange={(checked) => {
                  if (checked) startRouteSimulation();
                  else stopRouteSimulation();
                }}
              />
            </div>

            {activeOrder.delivery_lat && activeOrder.delivery_lng && (
              <Button
                size="sm"
                className="h-7 text-xs gap-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white font-semibold"
                onClick={() => openInGoogleMaps(activeOrder.delivery_lat!, activeOrder.delivery_lng!)}
              >
                <i className="fa-solid fa-diamond-turn-right text-[11px]" />
                <span>Turn-by-Turn</span>
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
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-center space-y-1">
              <div className="flex items-center justify-center gap-2 font-semibold text-sm text-amber-700 dark:text-amber-400">
                <Clock className="h-4 w-4 animate-pulse" />
                <span>Arrived — Waiting for Customer Confirmation ⏳</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Ride ended. The customer is currently confirming delivery receipt.
              </p>
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
                    <CheckCircle2 className="h-5 w-5" /> {uploadingProof ? 'Uploading...' : 'End Ride (Arrived)'}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>End Ride & Notify Customer</AlertDialogTitle>
                    <AlertDialogDescription>Have you arrived at the customer's location? Ending the ride will notify the customer to confirm delivery receipt.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleDeliverWithProof(activeOrder.id)}>Yes, Arrived</AlertDialogAction>
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
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl overflow-hidden border border-primary/30 bg-background p-0.5 shrink-0">
              <img src={logo} alt="Belly-Chow" className="h-full w-full object-contain" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-heading text-base font-bold tracking-tight">Belly-Chow</span>
                <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                  Rider
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground hidden sm:block">
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
