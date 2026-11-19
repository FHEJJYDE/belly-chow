import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { MapPin, Plus, Search, Edit, Trash2, Star, Sparkles, Building, Landmark, School, BookOpen, Compass, Layers, Tag } from 'lucide-react';
import { useCampusLocations, DeliveryZoneItem } from '@/hooks/useCampusLocations';

export interface CampusLocation {
  id: string;
  name: string;
  category: string;
  description: string | null;
  short_code?: string | null;
  aliases?: string[] | null;
  zone_name?: string | null;
  delivery_fee?: number | null;
  estimated_delivery_mins?: number | null;
  dropoff_points?: string[] | null;
  is_popular: boolean;
  is_active: boolean;
  lat: number | null;
  lng: number | null;
  created_at: string;
}

const CATEGORIES = [
  'Hostel',
  'Faculty',
  'Lecture Hall',
  'Library',
  'Landmark',
  'Gate',
  'Commercial',
  'Other',
];

const AdminLocations = () => {
  const { toast } = useToast();
  const { invalidateLocations } = useCampusLocations();

  const [activeTab, setActiveTab] = useState<'locations' | 'zones'>('locations');
  const [locations, setLocations] = useState<CampusLocation[]>([]);
  const [zones, setZones] = useState<DeliveryZoneItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Location Modal State
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<CampusLocation | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteLocationId, setDeleteLocationId] = useState<string | null>(null);

  // Zone Modal State
  const [zoneDialogOpen, setZoneDialogOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<DeliveryZoneItem | null>(null);
  const [savingZone, setSavingZone] = useState(false);
  const [deleteZoneId, setDeleteZoneId] = useState<string | null>(null);
  const [zoneForm, setZoneForm] = useState({
    zone_name: '',
    delivery_fee: '500',
    rider_fee: '500',
    is_active: true,
  });

  // Location Form State
  const [formData, setFormData] = useState({
    name: '',
    category: 'Hostel',
    description: '',
    short_code: '',
    aliases: '',
    zone_name: '',
    delivery_fee: '500',
    estimated_delivery_mins: '15',
    dropoff_points: "Porter's Lodge (Main Gate), Block A, Block B",
    is_popular: false,
    is_active: true,
    lat: '',
    lng: '',
  });

  const fetchAll = async () => {
    try {
      const [{ data: locData, error: locErr }, { data: zoneData, error: zoneErr }] =
        await Promise.all([
          supabase
            .from('campus_locations')
            .select('*')
            .order('is_popular', { ascending: false })
            .order('name', { ascending: true }),
          (supabase.from as any)('delivery_zones')
            .select('*')
            .order('delivery_fee', { ascending: true }),
        ]);

      if (!locErr && locData) {
        setLocations(locData as any);
      }
      if (!zoneErr && zoneData) {
        setZones(zoneData as DeliveryZoneItem[]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  // ── Zone CRUD Handlers ──────────────────────────────────────────────────────
  const openCreateZoneDialog = () => {
    setEditingZone(null);
    setZoneForm({
      zone_name: '',
      delivery_fee: '500',
      rider_fee: '500',
      is_active: true,
    });
    setZoneDialogOpen(true);
  };

  const openEditZoneDialog = (zone: DeliveryZoneItem) => {
    setEditingZone(zone);
    setZoneForm({
      zone_name: zone.zone_name,
      delivery_fee: String(zone.delivery_fee),
      rider_fee: String(zone.rider_fee ?? zone.delivery_fee),
      is_active: zone.is_active,
    });
    setZoneDialogOpen(true);
  };

  const handleSaveZone = async () => {
    if (!zoneForm.zone_name.trim()) {
      toast({ title: 'Zone name is required', variant: 'destructive' });
      return;
    }

    setSavingZone(true);
    const fee = parseFloat(zoneForm.delivery_fee) || 0;
    const riderFee = parseFloat(zoneForm.rider_fee) || fee;
    const payload = {
      zone_name: zoneForm.zone_name.trim(),
      delivery_fee: fee,
      rider_fee: riderFee,
      is_active: zoneForm.is_active,
    };

    try {
      if (editingZone) {
        const { error } = await (supabase.from as any)('delivery_zones')
          .update(payload)
          .eq('id', editingZone.id);
        if (error) throw error;

        // Also update linked campus locations if zone price or name changed
        await supabase
          .from('campus_locations')
          .update({
            zone_name: payload.zone_name,
            delivery_fee: fee,
            updated_at: new Date().toISOString(),
          } as any)
          .eq('zone_name', editingZone.zone_name);

        toast({
          title: 'Delivery Zone updated ✓',
          description: `All locations in "${payload.zone_name}" now use ₦${fee.toLocaleString()}.`,
        });
      } else {
        const { error } = await (supabase.from as any)('delivery_zones').insert(payload);
        if (error) throw error;
        toast({ title: 'Delivery Zone created! 🗺️' });
      }

      setZoneDialogOpen(false);
      invalidateLocations();
      fetchAll();
    } catch (err: any) {
      toast({
        title: 'Error saving zone',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setSavingZone(false);
    }
  };

  const handleDeleteZone = async () => {
    if (!deleteZoneId) return;
    try {
      const { error } = await (supabase.from as any)('delivery_zones')
        .delete()
        .eq('id', deleteZoneId);
      if (error) throw error;
      setZones((prev) => prev.filter((z) => z.id !== deleteZoneId));
      invalidateLocations();
      toast({ title: 'Delivery Zone removed' });
    } catch (err: any) {
      toast({ title: 'Delete failed', description: err.message, variant: 'destructive' });
    } finally {
      setDeleteZoneId(null);
    }
  };

  // ── Location CRUD Handlers ──────────────────────────────────────────────────
  const openCreateDialog = () => {
    setEditingLocation(null);
    const defaultZone = zones[0];
    setFormData({
      name: '',
      category: 'Hostel',
      description: '',
      short_code: '',
      aliases: '',
      zone_name: defaultZone ? defaultZone.zone_name : '',
      delivery_fee: defaultZone ? String(defaultZone.delivery_fee) : '500',
      estimated_delivery_mins: '15',
      dropoff_points: "Porter's Lodge (Main Gate), Block A, Block B",
      is_popular: false,
      is_active: true,
      lat: '',
      lng: '',
    });
    setDialogOpen(true);
  };

  const openEditDialog = (loc: CampusLocation) => {
    setEditingLocation(loc);
    setFormData({
      name: loc.name,
      category: loc.category || 'Hostel',
      description: loc.description || '',
      short_code: loc.short_code || '',
      aliases: Array.isArray(loc.aliases) ? loc.aliases.join(', ') : '',
      zone_name: loc.zone_name || (zones[0]?.zone_name ?? ''),
      delivery_fee: loc.delivery_fee != null ? String(loc.delivery_fee) : '500',
      estimated_delivery_mins:
        loc.estimated_delivery_mins != null ? String(loc.estimated_delivery_mins) : '15',
      dropoff_points: Array.isArray(loc.dropoff_points)
        ? loc.dropoff_points.join(', ')
        : "Porter's Lodge (Main Gate), Block A, Block B",
      is_popular: loc.is_popular,
      is_active: loc.is_active,
      lat: loc.lat ? String(loc.lat) : '',
      lng: loc.lng ? String(loc.lng) : '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast({ title: 'Location name is required', variant: 'destructive' });
      return;
    }

    setSaving(true);
    const aliasesArr = formData.aliases
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const dropoffArr = formData.dropoff_points
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const payload: any = {
      name: formData.name.trim(),
      category: formData.category,
      description: formData.description.trim() || null,
      short_code: formData.short_code.trim().toUpperCase() || null,
      aliases: aliasesArr,
      zone_name: formData.zone_name || null,
      delivery_fee: formData.delivery_fee ? parseFloat(formData.delivery_fee) : 500,
      estimated_delivery_mins: formData.estimated_delivery_mins
        ? parseInt(formData.estimated_delivery_mins, 10)
        : 15,
      dropoff_points: dropoffArr,
      is_popular: formData.is_popular,
      is_active: formData.is_active,
      lat: formData.lat ? parseFloat(formData.lat) : null,
      lng: formData.lng ? parseFloat(formData.lng) : null,
      updated_at: new Date().toISOString(),
    };

    try {
      if (editingLocation) {
        const { error } = await supabase
          .from('campus_locations')
          .update(payload)
          .eq('id', editingLocation.id);

        if (error) throw error;
        toast({ title: 'Location updated ✓' });
      } else {
        const { error } = await supabase.from('campus_locations').insert(payload);

        if (error) throw error;
        toast({ title: 'Campus location added! 📍' });
      }

      setDialogOpen(false);
      invalidateLocations();
      fetchAll();
    } catch (err: any) {
      toast({
        title: 'Error saving location',
        description: err.message || 'Check database permissions',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (id: string, field: 'is_active' | 'is_popular', value: boolean) => {
    try {
      const { error } = await supabase
        .from('campus_locations')
        .update({ [field]: value, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;

      setLocations((prev) => prev.map((l) => (l.id === id ? { ...l, [field]: value } : l)));
      invalidateLocations();
      toast({ title: `${field === 'is_popular' ? 'Popularity' : 'Status'} updated` });
    } catch (err: any) {
      toast({ title: 'Update failed', description: err.message, variant: 'destructive' });
    }
  };

  const handleDelete = async () => {
    if (!deleteLocationId) return;
    try {
      const { error } = await supabase
        .from('campus_locations')
        .delete()
        .eq('id', deleteLocationId);

      if (error) throw error;

      setLocations((prev) => prev.filter((l) => l.id !== deleteLocationId));
      invalidateLocations();
      toast({ title: 'Location removed' });
    } catch (err: any) {
      toast({ title: 'Delete failed', description: err.message, variant: 'destructive' });
    } finally {
      setDeleteLocationId(null);
    }
  };

  const filteredLocations = useMemo(() => {
    const q = search.toLowerCase().trim();
    return locations.filter((loc) => {
      const matchesSearch =
        !q ||
        loc.name.toLowerCase().includes(q) ||
        (loc.description && loc.description.toLowerCase().includes(q)) ||
        loc.category.toLowerCase().includes(q) ||
        (Array.isArray(loc.aliases) && loc.aliases.some((a) => a.toLowerCase().includes(q)));

      const matchesCat = selectedCategory === 'all' || loc.category === selectedCategory;

      return matchesSearch && matchesCat;
    });
  }, [locations, search, selectedCategory]);

  const stats = useMemo(() => {
    return {
      total: locations.length,
      zones: zones.length,
      popular: locations.filter((l) => l.is_popular).length,
    };
  }, [locations, zones]);

  const getCategoryIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case 'hostel':
        return <Building className="h-4 w-4 text-orange-500" />;
      case 'faculty':
      case 'lecture hall':
        return <School className="h-4 w-4 text-blue-500" />;
      case 'library':
        return <BookOpen className="h-4 w-4 text-emerald-500" />;
      case 'gate':
        return <Compass className="h-4 w-4 text-purple-500" />;
      default:
        return <Landmark className="h-4 w-4 text-amber-500" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">
            Delivery Zones & Campus Locations 📍
          </h1>
          <p className="text-sm text-muted-foreground">
            Set your own delivery zones & prices, manage campus buildings, and moderate student-added slang.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={openCreateZoneDialog} className="gap-1.5">
            <Layers className="h-4 w-4 text-primary" /> Add Zone & Price
          </Button>
          <Button onClick={openCreateDialog} className="gap-1.5">
            <Plus className="h-4 w-4" /> Add Location
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="border shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase">Campus Locations</p>
              <p className="font-heading text-2xl font-bold">{stats.total}</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <MapPin className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase">Pricing Zones</p>
              <p className="font-heading text-2xl font-bold text-green-600">{stats.zones}</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-green-500/10 flex items-center justify-center text-green-600">
              <Layers className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase">Popular 1-Tap Spots</p>
              <p className="font-heading text-2xl font-bold text-amber-500">{stats.popular}</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
              <Sparkles className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tab Switcher: Campus Locations vs Delivery Zones & Pricing */}
      <div className="flex items-center gap-2 border-b pb-2">
        <Button
          variant={activeTab === 'locations' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('locations')}
          className="gap-1.5"
        >
          <MapPin className="h-4 w-4" /> Campus Locations ({locations.length})
        </Button>
        <Button
          variant={activeTab === 'zones' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('zones')}
          className="gap-1.5"
        >
          <Layers className="h-4 w-4" /> Delivery Zones & Prices ({zones.length})
        </Button>
      </div>

      {/* TAB: DELIVERY ZONES & PRICING */}
      {activeTab === 'zones' && (
        <Card className="border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Zone Name</TableHead>
                  <TableHead>Customer Delivery Fee (₦)</TableHead>
                  <TableHead>Rider Payout Fee (₦)</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {zones.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                      No delivery zones configured yet. Click "Add Zone & Price" above to set your prices.
                    </TableCell>
                  </TableRow>
                ) : (
                  zones.map((z) => (
                    <TableRow key={z.id}>
                      <TableCell className="font-semibold text-foreground">{z.zone_name}</TableCell>
                      <TableCell className="font-bold text-primary">
                        ₦{Number(z.delivery_fee).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        ₦{Number(z.rider_fee ?? z.delivery_fee).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={z.is_active ? 'default' : 'secondary'}>
                          {z.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEditZoneDialog(z)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:bg-destructive/10"
                            onClick={() => setDeleteZoneId(z.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* TAB: CAMPUS LOCATIONS */}
      {activeTab === 'locations' && (
        <>
          <Card className="border shadow-sm">
            <CardContent className="p-4 space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search location name, student slang, category..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="all">All Categories</option>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </CardContent>
          </Card>

          <Card className="border shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Location & Student Slangs</TableHead>
                    <TableHead>Zone & Price</TableHead>
                    <TableHead className="text-center">Popular</TableHead>
                    <TableHead className="text-center">Active</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLocations.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                        No locations found. Click "Add Location" to add your campus buildings.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredLocations.map((loc) => (
                      <TableRow key={loc.id}>
                        <TableCell>
                          <div className="flex items-start gap-3">
                            <div className="p-2 rounded-lg bg-muted/70 mt-0.5">
                              {getCategoryIcon(loc.category)}
                            </div>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-foreground">{loc.name}</span>
                                <Badge variant="outline" className="text-[10px]">
                                  {loc.category}
                                </Badge>
                                {loc.is_popular && (
                                  <Badge
                                    variant="secondary"
                                    className="bg-amber-500/10 text-amber-600 text-[10px] gap-1 px-1.5 py-0"
                                  >
                                    <Star className="h-2.5 w-2.5 fill-amber-500" /> Popular
                                  </Badge>
                                )}
                              </div>
                              {Array.isArray(loc.aliases) && loc.aliases.length > 0 && (
                                <div className="flex items-center gap-1 flex-wrap mt-1">
                                  <Tag className="h-3 w-3 text-amber-500" />
                                  {loc.aliases.map((a) => (
                                    <Badge
                                      key={a}
                                      variant="secondary"
                                      className="text-[10px] px-1.5 py-0 font-normal"
                                    >
                                      {a}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                              {loc.description && (
                                <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                                  {loc.description}
                                </p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-xs">
                            <p className="font-bold text-foreground">
                              ₦{Number(loc.delivery_fee ?? 500).toLocaleString()}
                            </p>
                            <p className="text-muted-foreground">{loc.zone_name || 'Custom Fee'}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Switch
                            checked={loc.is_popular}
                            onCheckedChange={(v) => toggleStatus(loc.id, 'is_popular', v)}
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Switch
                            checked={loc.is_active}
                            onCheckedChange={(v) => toggleStatus(loc.id, 'is_active', v)}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => openEditDialog(loc)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:bg-destructive/10"
                              onClick={() => setDeleteLocationId(loc.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </>
      )}

      {/* Add / Edit Delivery Zone Dialog */}
      <Dialog open={zoneDialogOpen} onOpenChange={setZoneDialogOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>
              {editingZone ? 'Edit Delivery Zone & Price' : 'Create Delivery Zone & Price'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Zone Name *</Label>
              <Input
                placeholder="e.g. Main Campus Hostels, Off-Campus Gate"
                value={zoneForm.zone_name}
                onChange={(e) => setZoneForm({ ...zoneForm, zone_name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Customer Delivery Fee (₦) *</Label>
                <Input
                  type="number"
                  value={zoneForm.delivery_fee}
                  onChange={(e) =>
                    setZoneForm({
                      ...zoneForm,
                      delivery_fee: e.target.value,
                      rider_fee: e.target.value,
                    })
                  }
                />
              </div>
              <div>
                <Label>Rider Payout Fee (₦)</Label>
                <Input
                  type="number"
                  value={zoneForm.rider_fee}
                  onChange={(e) => setZoneForm({ ...zoneForm, rider_fee: e.target.value })}
                />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/30">
              <div>
                <Label className="text-sm font-semibold">Zone Active</Label>
                <p className="text-xs text-muted-foreground">Allow orders in this pricing zone</p>
              </div>
              <Switch
                checked={zoneForm.is_active}
                onCheckedChange={(v) => setZoneForm({ ...zoneForm, is_active: v })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setZoneDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveZone} disabled={savingZone}>
              {savingZone ? 'Saving...' : 'Save Zone'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add / Edit Location Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[540px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingLocation ? 'Edit Campus Location' : 'Add New Campus Location'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <Label htmlFor="loc-name">Location Name *</Label>
                <Input
                  id="loc-name"
                  placeholder="e.g. Independence Hall"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="loc-code">Short Code</Label>
                <Input
                  id="loc-code"
                  placeholder="Optional"
                  value={formData.short_code}
                  onChange={(e) => setFormData({ ...formData, short_code: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="loc-cat">Category</Label>
                <select
                  id="loc-cat"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="loc-zone">Delivery Zone</Label>
                <select
                  id="loc-zone"
                  value={formData.zone_name}
                  onChange={(e) => {
                    const z = zones.find((dz) => dz.zone_name === e.target.value);
                    setFormData({
                      ...formData,
                      zone_name: e.target.value,
                      delivery_fee: z ? String(z.delivery_fee) : formData.delivery_fee,
                    });
                  }}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Custom Price (No Zone)</option>
                  {zones.map((z) => (
                    <option key={z.id} value={z.zone_name}>
                      {z.zone_name} (₦{Number(z.delivery_fee).toLocaleString()})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="loc-fee">Delivery Fee (₦)</Label>
                <Input
                  id="loc-fee"
                  type="number"
                  value={formData.delivery_fee}
                  onChange={(e) => setFormData({ ...formData, delivery_fee: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="loc-eta">Estimated Delivery (Mins)</Label>
                <Input
                  id="loc-eta"
                  type="number"
                  value={formData.estimated_delivery_mins}
                  onChange={(e) =>
                    setFormData({ ...formData, estimated_delivery_mins: e.target.value })
                  }
                />
              </div>
            </div>

            <div>
              <Label htmlFor="loc-aliases">
                Student-Contributed Slangs & Aliases (comma-separated)
              </Label>
              <Input
                id="loc-aliases"
                placeholder="Students can add these directly, or edit them here"
                value={formData.aliases}
                onChange={(e) => setFormData({ ...formData, aliases: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="loc-dropoffs">Rider Micro-Dropoff Points (comma-separated)</Label>
              <Input
                id="loc-dropoffs"
                placeholder="e.g. Porter's Lodge, Block A, Block B"
                value={formData.dropoff_points}
                onChange={(e) => setFormData({ ...formData, dropoff_points: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="loc-desc">Description (Optional)</Label>
              <Input
                id="loc-desc"
                placeholder="e.g. Near North Gate"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="loc-lat">Latitude (Optional)</Label>
                <Input
                  id="loc-lat"
                  type="number"
                  step="any"
                  placeholder="e.g. 7.4412"
                  value={formData.lat}
                  onChange={(e) => setFormData({ ...formData, lat: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="loc-lng">Longitude (Optional)</Label>
                <Input
                  id="loc-lng"
                  type="number"
                  step="any"
                  placeholder="e.g. 3.8967"
                  value={formData.lng}
                  onChange={(e) => setFormData({ ...formData, lng: e.target.value })}
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/30">
              <div className="space-y-0.5">
                <Label className="text-sm font-semibold">Mark as Popular Quick-Pick</Label>
                <p className="text-xs text-muted-foreground">
                  Shown as 1-tap quick pills in the location picker and checkout
                </p>
              </div>
              <Switch
                checked={formData.is_popular}
                onCheckedChange={(v) => setFormData({ ...formData, is_popular: v })}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/30">
              <div className="space-y-0.5">
                <Label className="text-sm font-semibold">Active Status</Label>
                <p className="text-xs text-muted-foreground">
                  Allow students and riders to select this delivery hub
                </p>
              </div>
              <Switch
                checked={formData.is_active}
                onCheckedChange={(v) => setFormData({ ...formData, is_active: v })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : editingLocation ? 'Update Location' : 'Save Location'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Location Confirmation */}
      <AlertDialog open={!!deleteLocationId} onOpenChange={() => setDeleteLocationId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Campus Location?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this delivery location?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Location
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Zone Confirmation */}
      <AlertDialog open={!!deleteZoneId} onOpenChange={() => setDeleteZoneId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Delivery Zone?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this pricing zone?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteZone}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Zone
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminLocations;
