import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Sparkles, 
  Plus, 
  Trash2, 
  Edit, 
  Tag, 
  CreditCard, 
  MapPin, 
  Utensils, 
  ExternalLink,
  Layers,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';

export interface HeroBanner {
  id: string;
  title: string;
  subtitle: string | null;
  badge_text: string | null;
  cta_text: string | null;
  cta_action: string | null;
  theme_gradient: string | null;
  image_url: string | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const GRADIENT_PRESETS: { [key: string]: { label: string; class: string; glow: string } } = {
  'orange-amber': {
    label: 'Sunset Orange & Amber',
    class: 'from-orange-500 via-amber-500 to-amber-600',
    glow: 'shadow-orange-500/20'
  },
  'emerald-teal': {
    label: 'Campus Emerald & Teal',
    class: 'from-emerald-600 via-teal-600 to-cyan-700',
    glow: 'shadow-emerald-500/20'
  },
  'midnight-purple': {
    label: 'Midnight Violet & Indigo',
    class: 'from-purple-600 via-indigo-600 to-blue-700',
    glow: 'shadow-purple-500/20'
  },
  'crimson-fire': {
    label: 'Hot Crimson & Chili',
    class: 'from-rose-600 via-red-600 to-orange-600',
    glow: 'shadow-rose-500/20'
  },
  'royal-blue': {
    label: 'Electric Royal Blue',
    class: 'from-blue-600 via-cyan-600 to-teal-500',
    glow: 'shadow-blue-500/20'
  },
  'dark-gold': {
    label: 'Premium Onyx & Gold',
    class: 'from-zinc-900 via-stone-900 to-amber-950 border border-amber-500/30',
    glow: 'shadow-amber-500/10'
  }
};

const ACTION_TYPES = [
  { value: 'promo_code', label: 'Copy Promo Code', icon: Tag, placeholder: 'e.g. CHOWPASS' },
  { value: 'open_wallet', label: 'Open Wallet Top-Up', icon: CreditCard, placeholder: 'No parameter needed' },
  { value: 'open_locations', label: 'Open Campus Delivery Locations', icon: MapPin, placeholder: 'No parameter needed' },
  { value: 'filter_category', label: 'Filter Food Category', icon: Utensils, placeholder: 'e.g. shawarma, rice, swallow' },
  { value: 'link', label: 'Custom App Route / Link', icon: ExternalLink, placeholder: 'e.g. /vendors or /orders' },
];

export default function AdminBanners() {
  const [banners, setBanners] = useState<HeroBanner[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [deleteCandidate, setDeleteCandidate] = useState<HeroBanner | null>(null);
  const [editingBanner, setEditingBanner] = useState<HeroBanner | null>(null);

  // Form states
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [badgeText, setBadgeText] = useState('');
  const [ctaText, setCtaText] = useState('Explore Now');
  const [actionType, setActionType] = useState('promo_code');
  const [actionParam, setActionParam] = useState('');
  const [themeGradient, setThemeGradient] = useState('orange-amber');
  const [imageUrl, setImageUrl] = useState('');
  const [displayOrder, setDisplayOrder] = useState(0);
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchBanners();
  }, []);

  const fetchBanners = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('hero_banners')
        .select('*')
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBanners((data as HeroBanner[]) || []);
    } catch (err: any) {
      console.error('Error fetching hero banners:', err);
      toast.error('Failed to load hero banners');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (banner?: HeroBanner) => {
    if (banner) {
      setEditingBanner(banner);
      setTitle(banner.title);
      setSubtitle(banner.subtitle || '');
      setBadgeText(banner.badge_text || '');
      setCtaText(banner.cta_text || 'Explore Now');
      
      // Parse action
      const action = banner.cta_action || '';
      if (action.startsWith('promo_code:')) {
        setActionType('promo_code');
        setActionParam(action.replace('promo_code:', ''));
      } else if (action === 'open_wallet') {
        setActionType('open_wallet');
        setActionParam('');
      } else if (action === 'open_locations') {
        setActionType('open_locations');
        setActionParam('');
      } else if (action.startsWith('filter_category:')) {
        setActionType('filter_category');
        setActionParam(action.replace('filter_category:', ''));
      } else if (action.startsWith('link:')) {
        setActionType('link');
        setActionParam(action.replace('link:', ''));
      } else {
        setActionType('link');
        setActionParam(action);
      }

      setThemeGradient(banner.theme_gradient || 'orange-amber');
      setImageUrl(banner.image_url || '');
      setDisplayOrder(banner.display_order || 0);
      setIsActive(banner.is_active);
    } else {
      setEditingBanner(null);
      setTitle('');
      setSubtitle('');
      setBadgeText('⚡ Flash Deal');
      setCtaText('Claim Offer');
      setActionType('promo_code');
      setActionParam('CHOWPASS');
      setThemeGradient('orange-amber');
      setImageUrl('');
      setDisplayOrder(banners.length + 1);
      setIsActive(true);
    }
    setIsDialogOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('Title is required');
      return;
    }

    // Build cta_action string
    let fullAction = '';
    if (actionType === 'open_wallet' || actionType === 'open_locations') {
      fullAction = actionType;
    } else if (actionType === 'promo_code') {
      fullAction = `promo_code:${actionParam.trim() || 'CHOWPASS'}`;
    } else if (actionType === 'filter_category') {
      fullAction = `filter_category:${actionParam.trim() || 'all'}`;
    } else if (actionType === 'link') {
      fullAction = `link:${actionParam.trim() || '/'}`;
    }

    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        subtitle: subtitle.trim() || null,
        badge_text: badgeText.trim() || null,
        cta_text: ctaText.trim() || 'Explore',
        cta_action: fullAction,
        theme_gradient: themeGradient,
        image_url: imageUrl.trim() || null,
        display_order: Number(displayOrder) || 0,
        is_active: isActive,
        updated_at: new Date().toISOString(),
      };

      if (editingBanner) {
        const { error } = await supabase
          .from('hero_banners')
          .update(payload)
          .eq('id', editingBanner.id);

        if (error) throw error;
        toast.success('Banner updated successfully!');
      } else {
        const { error } = await supabase
          .from('hero_banners')
          .insert([payload]);

        if (error) throw error;
        toast.success('New banner section created!');
      }

      setIsDialogOpen(false);
      fetchBanners();
    } catch (err: any) {
      console.error('Error saving banner:', err);
      toast.error(err.message || 'Failed to save banner');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (banner: HeroBanner) => {
    const nextStatus = !banner.is_active;
    try {
      const { error } = await supabase
        .from('hero_banners')
        .update({ is_active: nextStatus, updated_at: new Date().toISOString() })
        .eq('id', banner.id);

      if (error) throw error;
      setBanners(banners.map(b => b.id === banner.id ? { ...b, is_active: nextStatus } : b));
      toast.success(nextStatus ? 'Banner activated' : 'Banner paused');
    } catch (err: any) {
      console.error('Error updating status:', err);
      toast.error('Failed to update status');
    }
  };

  const handleDelete = async () => {
    if (!deleteCandidate) return;
    try {
      const { error } = await supabase
        .from('hero_banners')
        .delete()
        .eq('id', deleteCandidate.id);

      if (error) throw error;
      setBanners(banners.filter(b => b.id !== deleteCandidate.id));
      toast.success('Banner section deleted');
      setDeleteCandidate(null);
    } catch (err: any) {
      console.error('Error deleting banner:', err);
      toast.error('Failed to delete banner');
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Hero Section Banners
            </h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage the carousel promotions, flash discounts, and spotlight banners on the user dashboard.
          </p>
        </div>

        <Button onClick={() => handleOpenDialog()} className="gap-2 self-start shadow-sm sm:self-auto">
          <Plus className="h-4 w-4" />
          Add Banner Section
        </Button>
      </div>

      {/* Info Card */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex items-center gap-3 p-4 text-sm text-foreground">
          <Layers className="h-5 w-5 shrink-0 text-primary" />
          <div>
            <span className="font-semibold">Live Carousel Sync:</span> Active banners rotate automatically every 5 seconds on the student dashboard hero area. Students can click any banner CTA to instantly trigger actions like copying codes or opening top-up modals.
          </div>
        </CardContent>
      </Card>

      {/* Banners Grid / List */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-48 animate-pulse rounded-2xl bg-muted/60" />
          ))}
        </div>
      ) : banners.length === 0 ? (
        <Card className="border-dashed py-12 text-center">
          <CardContent className="space-y-3">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
              <Sparkles className="h-6 w-6" />
            </div>
            <h3 className="font-heading text-lg font-semibold text-foreground">No Hero Banners Yet</h3>
            <p className="mx-auto max-w-sm text-sm text-muted-foreground">
              Add exciting flash discounts, delivery perks, or student cashback promos to capture attention.
            </p>
            <Button onClick={() => handleOpenDialog()} variant="outline" className="gap-2">
              <Plus className="h-4 w-4" /> Create First Banner
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2">
          {banners.map((banner) => {
            const gradientConfig = GRADIENT_PRESETS[banner.theme_gradient || 'orange-amber'] || GRADIENT_PRESETS['orange-amber'];
            return (
              <div 
                key={banner.id} 
                className={`relative flex flex-col justify-between overflow-hidden rounded-2xl border transition-all ${
                  banner.is_active ? 'border-border shadow-md' : 'border-border/50 opacity-60'
                }`}
              >
                {/* Live Card Preview Box */}
                <div 
                  className={`relative p-5 text-white bg-gradient-to-r ${gradientConfig.class} overflow-hidden`}
                  style={banner.image_url ? {
                    backgroundImage: `linear-gradient(rgba(0,0,0,0.65), rgba(0,0,0,0.75)), url(${banner.image_url})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center'
                  } : undefined}
                >
                  <div className="flex items-center justify-between gap-2">
                    {banner.badge_text ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-black/30 px-2.5 py-0.5 text-xs font-semibold backdrop-blur-md border border-white/20">
                        {banner.badge_text}
                      </span>
                    ) : <div />}

                    <Badge variant={banner.is_active ? "default" : "secondary"} className="bg-white/20 backdrop-blur-md text-white border-white/30 text-xs">
                      {banner.is_active ? 'Active' : 'Paused'}
                    </Badge>
                  </div>

                  <div className="mt-4 space-y-1.5">
                    <h3 className="font-heading text-lg font-bold leading-snug drop-shadow-sm">
                      {banner.title}
                    </h3>
                    {banner.subtitle && (
                      <p className="text-xs text-white/90 line-clamp-2">
                        {banner.subtitle}
                      </p>
                    )}
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/95 px-3 py-1.5 text-xs font-bold text-zinc-900 shadow-sm">
                      {banner.cta_text || 'Explore'} →
                    </span>
                    <span className="text-[11px] font-mono text-white/75 bg-black/30 px-2 py-0.5 rounded-md">
                      Order: #{banner.display_order}
                    </span>
                  </div>
                </div>

                {/* Management Action Bar */}
                <div className="flex items-center justify-between gap-2 bg-card p-3.5 border-t border-border">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={banner.is_active}
                      onCheckedChange={() => handleToggleActive(banner)}
                      id={`toggle-${banner.id}`}
                    />
                    <Label htmlFor={`toggle-${banner.id}`} className="text-xs font-medium cursor-pointer">
                      {banner.is_active ? 'Shown on Dashboard' : 'Hidden'}
                    </Label>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenDialog(banner)}
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteCandidate(banner)}
                      className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Banner Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">
              {editingBanner ? 'Edit Hero Banner' : 'Create New Hero Banner Section'}
            </DialogTitle>
            <DialogDescription>
              Design a high-converting promotional slide for the user dashboard carousel.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4 pt-2">
            {/* Live Interactive Preview in Dialog */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Live Visual Preview</Label>
              <div 
                className={`relative p-4 text-white rounded-xl bg-gradient-to-r ${
                  (GRADIENT_PRESETS[themeGradient] || GRADIENT_PRESETS['orange-amber']).class
                } overflow-hidden shadow-sm`}
                style={imageUrl ? {
                  backgroundImage: `linear-gradient(rgba(0,0,0,0.65), rgba(0,0,0,0.75)), url(${imageUrl})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center'
                } : undefined}
              >
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1 rounded-full bg-black/30 px-2 py-0.5 text-xs font-semibold backdrop-blur-md border border-white/20">
                    {badgeText || '⚡ Flash Deal'}
                  </span>
                  <span className="text-[11px] font-mono text-white/80">
                    Order #{displayOrder}
                  </span>
                </div>
                <h4 className="mt-3 font-heading font-bold text-base leading-snug">
                  {title || 'Headline Promo Title Here'}
                </h4>
                <p className="mt-1 text-xs text-white/90">
                  {subtitle || 'Subtitle or short offer explanation here...'}
                </p>
                <div className="mt-3">
                  <span className="inline-flex items-center gap-1 rounded-md bg-white/95 px-2.5 py-1 text-xs font-bold text-zinc-900 shadow-sm">
                    {ctaText || 'Explore'} →
                  </span>
                </div>
              </div>
            </div>

            {/* Title & Badge */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2 space-y-1.5">
                <Label htmlFor="title" className="text-sm font-medium">
                  Banner Headline *
                </Label>
                <Input
                  id="title"
                  placeholder="e.g. Exam Crunch Chow: 20% OFF"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="badge" className="text-sm font-medium">
                  Pill Badge
                </Label>
                <Input
                  id="badge"
                  placeholder="e.g. ⚡ Flash Deal"
                  value={badgeText}
                  onChange={(e) => setBadgeText(e.target.value)}
                />
              </div>
            </div>

            {/* Subtitle */}
            <div className="space-y-1.5">
              <Label htmlFor="subtitle" className="text-sm font-medium">
                Subtitle / Description
              </Label>
              <Textarea
                id="subtitle"
                placeholder="e.g. Fuel your night study with hot Jollof & Shawarma. Use code CHOWPASS at checkout!"
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                rows={2}
              />
            </div>

            {/* Color Gradient Theme */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Color Gradient Palette</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {Object.entries(GRADIENT_PRESETS).map(([key, config]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setThemeGradient(key)}
                    className={`flex items-center gap-2 p-2 rounded-xl border text-left text-xs transition-all ${
                      themeGradient === key
                        ? 'border-primary ring-2 ring-primary/20 bg-primary/5 font-semibold text-foreground'
                        : 'border-border hover:bg-muted/50 text-muted-foreground'
                    }`}
                  >
                    <div className={`h-4 w-4 rounded-full bg-gradient-to-r ${config.class} shrink-0`} />
                    <span className="truncate">{config.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* CTA Button Label & Action Configuration */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ctaText" className="text-sm font-medium">
                  Button Label
                </Label>
                <Input
                  id="ctaText"
                  placeholder="e.g. Claim 20% OFF"
                  value={ctaText}
                  onChange={(e) => setCtaText(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Click Action Type</Label>
                <Select value={actionType} onValueChange={setActionType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select action" />
                  </SelectTrigger>
                  <SelectContent>
                    {ACTION_TYPES.map((act) => (
                      <SelectItem key={act.value} value={act.value}>
                        <div className="flex items-center gap-2">
                          <act.icon className="h-3.5 w-3.5 text-primary" />
                          <span>{act.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Action Parameter */}
            {actionType !== 'open_wallet' && actionType !== 'open_locations' && (
              <div className="space-y-1.5">
                <Label htmlFor="actionParam" className="text-sm font-medium">
                  {actionType === 'promo_code' ? 'Promo Code to Copy' : actionType === 'filter_category' ? 'Food Category Key' : 'Destination URL / Path'}
                </Label>
                <Input
                  id="actionParam"
                  placeholder={ACTION_TYPES.find(a => a.value === actionType)?.placeholder}
                  value={actionParam}
                  onChange={(e) => setActionParam(e.target.value)}
                />
              </div>
            )}

            {/* Optional Custom Background Image & Display Order */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2 space-y-1.5">
                <Label htmlFor="imageUrl" className="text-sm font-medium">
                  Custom Image URL (Optional)
                </Label>
                <Input
                  id="imageUrl"
                  placeholder="https://images.unsplash.com/..."
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="displayOrder" className="text-sm font-medium">
                  Display Order
                </Label>
                <Input
                  id="displayOrder"
                  type="number"
                  value={displayOrder}
                  onChange={(e) => setDisplayOrder(Number(e.target.value))}
                />
              </div>
            </div>

            {/* Active Toggle */}
            <div className="flex items-center justify-between rounded-xl border border-border p-3 bg-muted/20">
              <div>
                <div className="text-sm font-medium text-foreground">Make Slide Active</div>
                <div className="text-xs text-muted-foreground">Visible on student homepage carousel</div>
              </div>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving} className="gap-2">
                {saving ? 'Saving...' : editingBanner ? 'Save Changes' : 'Create Banner'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteCandidate} onOpenChange={(open) => !open && setDeleteCandidate(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive font-heading">
              <AlertCircle className="h-5 w-5" />
              Delete Hero Banner Section?
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete <strong>"{deleteCandidate?.title}"</strong>? This will remove the slide from the user dashboard carousel immediately.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 pt-3">
            <Button variant="outline" onClick={() => setDeleteCandidate(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete Banner
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
