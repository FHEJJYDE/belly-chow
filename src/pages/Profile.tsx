import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import AppNavbar from '@/components/layout/AppNavbar';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import VerificationUpload from '@/components/VerificationUpload';
import type { Database } from '@/integrations/supabase/types';

type Profile = Database['public']['Tables']['profiles']['Row'];

const Profile = () => {
  const { user, role, loading } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [campusLocation, setCampusLocation] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from('profiles').select('*').eq('user_id', user.id).single()
      .then(({ data }) => {
        if (data) {
          setProfile(data);
          setFullName(data.full_name);
          setPhone(data.phone);
          setCampusLocation(data.campus_location);
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
    }).eq('user_id', user.id);
    setSaving(false);
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else toast({ title: 'Profile updated' });
  };

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <AppNavbar />
      <div className="container max-w-lg py-8">
        <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground">Account</p>
        <h1 className="mt-1 mb-8 font-heading text-2xl font-bold tracking-tight">My profile</h1>

        <Card>
          <CardContent className="space-y-5 p-6">
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

        {(role === 'rider' || role === 'vendor') && (
          <div className="mt-6">
            <VerificationUpload />
          </div>
        )}
      </div>
    </div>
  );
};

export default Profile;
