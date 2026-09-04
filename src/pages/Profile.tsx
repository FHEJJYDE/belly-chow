import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import AppNavbar from '@/components/layout/AppNavbar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useGeolocation } from '@/hooks/useGeolocation';
import VerificationUpload from '@/components/VerificationUpload';
import { 
  MapPin, 
  Navigation, 
  Trash2, 
  LogOut, 
  HeadphonesIcon, 
  MessageCircle, 
  Mail, 
  ExternalLink, 
  HelpCircle, 
  Send,
  Sparkles,
  ChevronRight,
  ShieldCheck
} from 'lucide-react';
import AvatarUpload from '@/components/AvatarUpload';

const WHATSAPP_NUMBER = '2348000000000';

const FAQS = [
  {
    q: 'How long does campus delivery usually take?',
    a: 'Most on-campus orders are delivered in 15 to 25 minutes depending on the vendor preparation time and your hostel/hall location.'
  },
  {
    q: 'What if my meal is incorrect, delayed, or missing an item?',
    a: 'You can immediately reach our 24/7 student dispatch team via WhatsApp or submit a support ticket right below. We provide instant refunds or replacements.'
  },
  {
    q: 'How does the Belly-Chow Student Wallet work?',
    a: 'You can deposit funds into your secure wallet using Bank Transfer or Card. Wallet checkout is 1-tap and immune to bank gateway network failures during rush hours.'
  },
  {
    q: 'Can I cancel an order after placing it?',
    a: 'Orders can be cancelled before the vendor starts kitchen preparation. Once cooking begins, contact live dispatch for assistance.'
  }
];

const Profile = () => {
  const { user, role, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [campusLocation, setCampusLocation] = useState('');
  const [saving, setSaving] = useState(false);
  const [defaultLat, setDefaultLat] = useState<number | null>(null);
  const [defaultLng, setDefaultLng] = useState<number | null>(null);
  const [defaultLocationName, setDefaultLocationName] = useState('');
  const [savingLocation, setSavingLocation] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const { position, error: geoError, loading: geoLoading, getPosition } = useGeolocation();

  // Support ticket form state
  const [ticketCategory, setTicketCategory] = useState('order_issue');
  const [ticketMessage, setTicketMessage] = useState('');
  const [submittingTicket, setSubmittingTicket] = useState(false);
  const [ticketDialogOpen, setTicketDialogOpen] = useState(false);

  const handleLogout = async () => {
    setSigningOut(true);
    try {
      await signOut();
      toast({ title: 'Logged out successfully' });
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setSigningOut(false);
      navigate('/login', { replace: true });
    }
  };

  const handleWhatsApp = () => {
    const text = encodeURIComponent(`Hi Belly-Chow Support, I need help with my student account (${user?.email || ''}).`);
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${text}`, '_blank');
  };

  const handleEmailSupport = () => {
    window.open(`mailto:support@bellychow.com?subject=Support Request from ${encodeURIComponent(fullName || user?.email || 'Student')}`);
  };

  const handleTicketSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketMessage.trim()) {
      toast({ title: 'Message is required', variant: 'destructive' });
      return;
    }
    setSubmittingTicket(true);
    try {
      const { error } = await supabase.from('support_tickets').insert({
        user_id: user?.id || null,
        subject: `Support: ${ticketCategory.replace('_', ' ').toUpperCase()}`,
        message: ticketMessage.trim(),
        category: ticketCategory,
      } as any);

      if (error) throw error;
      toast({ title: 'Ticket submitted! ✓', description: 'Our campus support team will review and reply shortly.' });
      setTicketMessage('');
      setTicketDialogOpen(false);
    } catch (err: any) {
      toast({ title: 'Submission failed', description: err.message, variant: 'destructive' });
    } finally {
      setSubmittingTicket(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    supabase.from('profiles').select('*').eq('user_id', user.id).single()
      .then(({ data }) => {
        if (data) {
          setFullName(data.full_name);
          setPhone(data.phone ?? '');
          setAvatarUrl(data.avatar_url ?? null);
          setCampusLocation(data.campus_location ?? '');
          setDefaultLat((data as any).default_lat ?? null);
          setDefaultLng((data as any).default_lng ?? null);
          setDefaultLocationName((data as any).default_location_name ?? '');
        }
      });
  }, [user]);

  if (!loading && !user) return <Navigate to="/login" replace />;

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from('profiles').update({
      full_name: fullName,
      phone,
      campus_location: campusLocation,
    } as any).eq('user_id', user.id);
    setSaving(false);
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else toast({ title: 'Profile updated' });
  };

  const saveDefaultLocation = async () => {
    if (!user || !position) return;
    setSavingLocation(true);
    const { error } = await supabase.from('profiles').update({
      default_lat: position.lat,
      default_lng: position.lng,
      default_location_name: defaultLocationName || 'My Location',
    } as any).eq('user_id', user.id);
    setSavingLocation(false);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setDefaultLat(position.lat);
      setDefaultLng(position.lng);
      if (!defaultLocationName) setDefaultLocationName('My Location');
      toast({ title: 'Default location saved' });
    }
  };

  const clearDefaultLocation = async () => {
    if (!user) return;
    setSavingLocation(true);
    const { error } = await supabase.from('profiles').update({
      default_lat: null,
      default_lng: null,
      default_location_name: '',
    } as any).eq('user_id', user.id);
    setSavingLocation(false);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setDefaultLat(null);
      setDefaultLng(null);
      setDefaultLocationName('');
      toast({ title: 'Default location cleared' });
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24 md:pb-12">
      <AppNavbar />
      <div className="container max-w-lg py-8 space-y-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Account & Settings</p>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">My Profile</h1>
        </div>

        {/* Profile Card */}
        <Card>
          <CardContent className="space-y-5 p-6">
            {user && (
              <AvatarUpload
                userId={user.id}
                currentUrl={avatarUrl}
                fullName={fullName}
                onUploaded={setAvatarUrl}
              />
            )}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Email</Label>
              <Input value={user?.email || ''} disabled className="bg-muted/50 text-muted-foreground" />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Role</Label>
              <Input value={role || 'student'} disabled className="capitalize bg-muted/50 text-muted-foreground" />
            </div>

            <div className="border-t pt-5 space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Full Name</Label>
                <Input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Your full name" />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Phone Number</Label>
                <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+234 800 000 0000" />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Campus Hostel / Faculty Location</Label>
                <Input value={campusLocation} onChange={e => setCampusLocation(e.target.value)} placeholder="e.g. Block A, Independence Hall" />
              </div>
            </div>

            <Button onClick={save} disabled={saving} className="w-full font-semibold">
              {saving ? 'Saving...' : 'Save Profile Changes'}
            </Button>
          </CardContent>
        </Card>

        {/* Default Delivery Location */}
        {(role === 'student' || !role) && (
          <Card>
            <CardContent className="space-y-4 p-6">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" />
                <Label className="text-sm font-semibold text-foreground">Default Delivery Location</Label>
                <span className="text-xs text-muted-foreground">(GPS)</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Save your precise GPS coordinates for 1-tap checkout to your room or faculty.
              </p>

              {defaultLat && defaultLng ? (
                <div className="space-y-3">
                  <div className="rounded-xl border bg-muted/40 p-3 space-y-1">
                    <p className="text-sm font-semibold">{defaultLocationName || 'My Location'}</p>
                    <p className="text-xs text-muted-foreground font-mono">
                      GPS: {defaultLat.toFixed(5)}, {defaultLng.toFixed(5)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="gap-1.5 rounded-lg" onClick={() => { getPosition(); }} disabled={geoLoading}>
                      <Navigation className="h-3.5 w-3.5" />
                      {geoLoading ? 'Getting...' : 'Update GPS'}
                    </Button>
                    <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground rounded-lg" onClick={clearDefaultLocation} disabled={savingLocation}>
                      <Trash2 className="h-3.5 w-3.5" />
                      Clear
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <Button variant="outline" size="sm" className="gap-1.5 rounded-lg" onClick={getPosition} disabled={geoLoading}>
                    <Navigation className="h-3.5 w-3.5 text-primary" />
                    {geoLoading ? 'Getting location...' : 'Capture My GPS Location'}
                  </Button>
                  {geoError && <p className="text-xs text-destructive">{geoError}</p>}
                  {position && (
                    <div className="space-y-2 pt-2">
                      <p className="text-xs text-muted-foreground">GPS captured: {position.lat.toFixed(5)}, {position.lng.toFixed(5)}</p>
                      <Input placeholder="Label (e.g. My Hostel Room)" value={defaultLocationName} onChange={e => setDefaultLocationName(e.target.value)} />
                      <Button size="sm" onClick={saveDefaultLocation} disabled={savingLocation} className="w-full">
                        {savingLocation ? 'Saving...' : 'Save as default location'}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Verification upload for Rider/Vendor */}
        {(role === 'rider' || role === 'vendor') && (
          <VerificationUpload />
        )}

        {/* HELP & SUPPORT CENTER SECTION */}
        <Card className="border-primary/20 bg-card">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <HeadphonesIcon className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="font-heading text-lg font-bold">Help & Support Center</CardTitle>
                <CardDescription className="text-xs">Have questions or issues with an order? We're here 24/7.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Quick Contact Buttons */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={handleWhatsApp}
                className="flex items-center gap-2.5 p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/15 transition-all text-left group"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500 text-white shadow-sm">
                  <MessageCircle className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-xs">WhatsApp Chat</p>
                  <p className="text-[10px] text-muted-foreground">Instant dispatch</p>
                </div>
              </button>

              <button
                type="button"
                onClick={handleEmailSupport}
                className="flex items-center gap-2.5 p-3 rounded-xl border border-border bg-muted/40 hover:bg-muted/70 transition-all text-left group"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary shadow-sm">
                  <Mail className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-xs">Email Us</p>
                  <p className="text-[10px] text-muted-foreground">Official support</p>
                </div>
              </button>
            </div>

            {/* Submit Support Ticket Dialog Trigger */}
            <Dialog open={ticketDialogOpen} onOpenChange={setTicketDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full justify-between rounded-xl h-11 text-xs font-semibold">
                  <span className="flex items-center gap-2">
                    <Send className="h-3.5 w-3.5 text-primary" />
                    Submit a Support Ticket / Report Issue
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle className="font-heading text-lg">Submit a Support Ticket</DialogTitle>
                  <DialogDescription className="text-xs">
                    Let us know what went wrong and our campus team will investigate immediately.
                  </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleTicketSubmit} className="space-y-4 pt-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Issue Category</Label>
                    <Select value={ticketCategory} onValueChange={setTicketCategory}>
                      <SelectTrigger className="text-xs h-10">
                        <SelectValue placeholder="Select issue category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="order_issue">Delayed or Missing Order</SelectItem>
                        <SelectItem value="payment_wallet">Wallet / Payment Dispute</SelectItem>
                        <SelectItem value="vendor_feedback">Vendor Meal Quality</SelectItem>
                        <SelectItem value="rider_feedback">Rider Delivery Experience</SelectItem>
                        <SelectItem value="general">General Inquiry</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Describe the issue in detail *</Label>
                    <Textarea
                      placeholder="Include order number or specific details..."
                      value={ticketMessage}
                      onChange={(e) => setTicketMessage(e.target.value)}
                      rows={4}
                      className="text-xs"
                      required
                    />
                  </div>

                  <Button type="submit" disabled={submittingTicket} className="w-full font-bold gap-2">
                    {submittingTicket ? 'Submitting...' : 'Send Support Ticket'}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>

            {/* FAQs Accordion */}
            <div className="pt-2 border-t border-border">
              <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                <HelpCircle className="h-3.5 w-3.5 text-primary" /> Frequently Asked Questions
              </p>
              <Accordion type="single" collapsible className="w-full text-xs">
                {FAQS.map((faq, i) => (
                  <AccordionItem key={i} value={`faq-${i}`} className="border-border">
                    <AccordionTrigger className="text-xs font-semibold text-left py-2 hover:no-underline">
                      {faq.q}
                    </AccordionTrigger>
                    <AccordionContent className="text-xs text-muted-foreground leading-relaxed">
                      {faq.a}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </CardContent>
        </Card>

        {/* Log Out Action */}
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-sm text-destructive">Sign Out</p>
                <p className="text-xs text-muted-foreground">Log out of your Belly-Chow account on this device.</p>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={signingOut}
                    className="gap-2 font-semibold shrink-0"
                  >
                    <LogOut className="h-4 w-4" />
                    {signingOut ? 'Signing out...' : 'Log out'}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirm Logout</AlertDialogTitle>
                    <AlertDialogDescription>Are you sure you want to log out of your Belly-Chow account?</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleLogout} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Log Out</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Profile;
