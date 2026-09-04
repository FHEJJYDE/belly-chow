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
import { MapPin, Plus, Search, Edit, Trash2, Star, Sparkles, Building, Landmark, School, BookOpen, Compass } from 'lucide-react';

export interface CampusLocation {
  id: string;
  name: string;
  category: string;
  description: string | null;
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
  const [locations, setLocations] = useState<CampusLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Modal State
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<CampusLocation | null>(null);
  const [saving, setSaving] = useState(false);

  // Delete State
  const [deleteLocationId, setDeleteLocationId] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    category: 'Hostel',
    description: '',
    is_popular: false,
    is_active: true,
    lat: '',
    lng: '',
  });

  const fetchLocations = async () => {
    try {
      const { data, error } = await supabase
        .from('campus_locations')
        .select('*')
        .order('is_popular', { ascending: false })
        .order('name', { ascending: true });

      if (error) {
        console.error('Error fetching campus locations:', error);
      } else {
        setLocations(data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLocations();
  }, []);

  const openCreateDialog = () => {
    setEditingLocation(null);
    setFormData({
      name: '',
      category: 'Hostel',
      description: '',
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
    const payload = {
      name: formData.name.trim(),
      category: formData.category,
      description: formData.description.trim() || null,
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
        const { error } = await supabase
          .from('campus_locations')
          .insert(payload);

        if (error) throw error;
        toast({ title: 'Campus location added! 📍' });
      }

      setDialogOpen(false);
      fetchLocations();
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

      setLocations(prev =>
        prev.map(l => (l.id === id ? { ...l, [field]: value } : l))
      );
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

      setLocations(prev => prev.filter(l => l.id !== deleteLocationId));
      toast({ title: 'Location removed' });
    } catch (err: any) {
      toast({ title: 'Delete failed', description: err.message, variant: 'destructive' });
    } finally {
      setDeleteLocationId(null);
    }
  };

  const filteredLocations = useMemo(() => {
    const q = search.toLowerCase().trim();
    return locations.filter(loc => {
      const matchesSearch =
        !q ||
        loc.name.toLowerCase().includes(q) ||
        (loc.description && loc.description.toLowerCase().includes(q)) ||
        loc.category.toLowerCase().includes(q);

      const matchesCat = selectedCategory === 'all' || loc.category === selectedCategory;

      return matchesSearch && matchesCat;
    });
  }, [locations, search, selectedCategory]);

  const stats = useMemo(() => {
    return {
      total: locations.length,
      active: locations.filter(l => l.is_active).length,
      popular: locations.filter(l => l.is_popular).length,
    };
  }, [locations]);

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
            Delivery Locations 📍
          </h1>
          <p className="text-sm text-muted-foreground">
            Configure campus landmarks, hostels, and lecture halls for 1-click user selection & autocomplete.
          </p>
        </div>
        <Button onClick={openCreateDialog} className="gap-2 shrink-0">
          <Plus className="h-4 w-4" /> Add Campus Location
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="border shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase">Total Locations</p>
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
              <p className="text-xs font-medium text-muted-foreground uppercase">Active Delivery Hubs</p>
              <p className="font-heading text-2xl font-bold text-green-600">{stats.active}</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-green-500/10 flex items-center justify-center text-green-600">
              <Building className="h-5 w-5" />
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

      {/* Filter and Search Bar */}
      <Card className="border shadow-sm">
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search location name, description, category..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="all">All Categories</option>
              {CATEGORIES.map(c => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Category Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1 rounded-full font-medium transition-colors ${
                selectedCategory === 'all'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              All ({locations.length})
            </button>
            {CATEGORIES.map(cat => {
              const count = locations.filter(l => l.category === cat).length;
              if (count === 0) return null;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1 rounded-full font-medium transition-colors shrink-0 ${
                    selectedCategory === cat
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  {cat} ({count})
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Locations Table */}
      <Card className="border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Location Details</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-center">Popular Quick-Pick</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLocations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                    No locations match your search or filter criteria.
                  </TableCell>
                </TableRow>
              ) : (
                filteredLocations.map(loc => (
                  <TableRow key={loc.id}>
                    <TableCell>
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-muted/70 mt-0.5">
                          {getCategoryIcon(loc.category)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-foreground">{loc.name}</span>
                            {loc.is_popular && (
                              <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[10px] gap-1 px-1.5 py-0">
                                <Star className="h-2.5 w-2.5 fill-amber-500" /> Popular
                              </Badge>
                            )}
                          </div>
                          {loc.description && (
                            <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                              {loc.description}
                            </p>
                          )}
                          {loc.lat && loc.lng && (
                            <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                              📍 {loc.lat.toFixed(4)}, {loc.lng.toFixed(4)}
                            </p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize text-xs font-normal">
                        {loc.category}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={loc.is_popular}
                        onCheckedChange={v => toggleStatus(loc.id, 'is_popular', v)}
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={loc.is_active}
                        onCheckedChange={v => toggleStatus(loc.id, 'is_active', v)}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
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

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>
              {editingLocation ? 'Edit Campus Location' : 'Add New Campus Location'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="loc-name">Location Name *</Label>
              <Input
                id="loc-name"
                placeholder="e.g. Hall 3 (Alexander Brown), Main Library"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="loc-cat">Category</Label>
              <select
                id="loc-cat"
                value={formData.category}
                onChange={e => setFormData({ ...formData, category: e.target.value })}
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {CATEGORIES.map(c => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="loc-desc">Building / Landmark Description (Optional)</Label>
              <Input
                id="loc-desc"
                placeholder="e.g. East Wing Entrance, Near Porter's Lodge"
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
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
                  onChange={e => setFormData({ ...formData, lat: e.target.value })}
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
                  onChange={e => setFormData({ ...formData, lng: e.target.value })}
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/30">
              <div className="space-y-0.5">
                <Label className="text-sm font-semibold">Mark as Popular Quick-Pick</Label>
                <p className="text-xs text-muted-foreground">
                  Shown as 1-tap quick pills in the Hero section and checkout
                </p>
              </div>
              <Switch
                checked={formData.is_popular}
                onCheckedChange={v => setFormData({ ...formData, is_popular: v })}
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
                onCheckedChange={v => setFormData({ ...formData, is_active: v })}
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

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteLocationId} onOpenChange={() => setDeleteLocationId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Campus Location?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this delivery location? Users will no longer see it in autocomplete suggestions.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete Location
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminLocations;
