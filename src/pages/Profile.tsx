import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import AppNavbar from '@/components/layout/AppNavbar';
import { Card, CardContent } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useGeolocation } from '@/hooks/useGeolocation';
import VerificationUpload from '@/components/VerificationUpload';
import { MapPin, Navigation, Trash2, LogOut } from 'lucide-react';
import AvatarUpload from '@/components/AvatarUpload';

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
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <AppNavbar />
      <div className="container max-w-lg py-8">
        <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground">Account</p>
        <h1 className="mt-1 mb-8 font-heading text-2xl font-bold tracking-tight">My profile</h1>

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
              <Input value={user?.email || ''} disabled className="bg-muted/50" />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Role</Label>
              <Input value={role || 'student'} disabled className="capitalize bg-muted/50" />
            </div>

            <div className="border-t pt-5 space-y-5">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Full Name</Label>
                <Input value={fullName} onChange={e => setFullName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Phone</Label>
                <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+234..." />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Campus Location</Label>
                <Input value={campusLocation} onChange={e => setCampusLocation(e.target.value)} placeholder="e.g. Block A Hostel" />
              </div>
            </div>

            <Button onClick={save} disabled={saving} className="w-full">
              {saving ? 'Saving...' : 'Save changes'}
            </Button>
          </CardContent>
        </Card>

        {/* Default Delivery Location */}
        {(role === 'student' || !role) && (
          <Card className="mt-6">
            <CardContent className="space-y-4 p-6">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <Label className="text-sm font-semibold">Default Delivery Location</Label>
                <span className="text-xs text-muted-foreground">(optional)</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Save your GPS location so you can quickly use it when ordering meals.
              </p>

              {defaultLat && defaultLng ? (
                <div className="space-y-3">
                  <div className="rounded-lg border p-3 space-y-1">
                    <p className="text-sm font-medium">{defaultLocationName || 'My Location'}</p>
                    <p className="text-xs text-muted-foreground">
                      GPS: {defaultLat.toFixed(5)}, {defaultLng.toFixed(5)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={() => { getPosition(); }} disabled={geoLoading}>
                      <Navigation className="h-3.5 w-3.5" />
                      {geoLoading ? 'Getting...' : 'Update GPS'}
                    </Button>
                    <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={clearDefaultLocation} disabled={savingLocation}>
                      <Trash2 className="h-3.5 w-3.5" />
                      Clear
                    </Button>
                  </div>
                  {position && position.lat !== defaultLat && (
                    <div className="space-y-2">
                      <Input placeholder="Label (e.g. My Hostel)" value={defaultLocationName} onChange={e => setDefaultLocationName(e.target.value)} />
                      <Button size="sm" onClick={saveDefaultLocation} disabled={savingLocation} className="w-full">
                        {savingLocation ? 'Saving...' : 'Save new location'}
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={getPosition} disabled={geoLoading}>
                    <Navigation className="h-3.5 w-3.5" />
                    {geoLoading ? 'Getting location...' : 'Get my GPS location'}
                  </Button>
                  {geoError && <p className="text-xs text-destructive">{geoError}</p>}
                  {position && (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">GPS captured: {position.lat.toFixed(5)}, {position.lng.toFixed(5)}</p>
                      <Input placeholder="Label (e.g. My Hostel)" value={defaultLocationName} onChange={e => setDefaultLocationName(e.target.value)} />
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

        {(role === 'rider' || role === 'vendor') && (
          <div className="mt-6">
            <VerificationUpload />
          </div>
        )}

        {/* Log Out Action */}
        <Card className="mt-6 border-destructive/30 bg-destructive/5">
          <CardContent className="p-6">
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
