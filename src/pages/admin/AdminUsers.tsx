import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Search, User, Bike, Store, Shield, Ban, CheckCircle } from 'lucide-react';

interface UserWithRole {
  id: string;
  user_id: string;
  role: string;
  profile?: {
    full_name: string;
    phone: string | null;
    campus_location: string | null;
    created_at: string;
    is_suspended: boolean;
    suspension_reason: string | null;
  };
}

const roleIcons: Record<string, React.ReactNode> = {
  admin: <Shield className="h-4 w-4" />,
  vendor: <Store className="h-4 w-4" />,
  rider: <Bike className="h-4 w-4" />,
  student: <User className="h-4 w-4" />,
};

const roleColors: Record<string, string> = {
  admin: 'bg-purple-500/10 text-purple-700',
  vendor: 'bg-blue-500/10 text-blue-700',
  rider: 'bg-orange-500/10 text-orange-700',
  student: 'bg-green-500/10 text-green-700',
};

const AdminUsers = () => {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchUsers = async () => {
    const { data: profiles, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    if (error) {
      toast({ title: 'Error loading users', description: error.message, variant: 'destructive' });
      setLoading(false);
      return;
    }
    const formatted = (profiles || []).map((p: any) => ({
      id: p.id,
      user_id: p.user_id,
      role: p.role || 'student',
      profile: {
        full_name: p.full_name || 'Unnamed User',
        phone: p.phone || null,
        campus_location: p.campus_location || null,
        created_at: p.created_at,
        is_suspended: p.is_suspended || false,
        suspension_reason: p.suspension_reason || null,
      },
    }));
    setUsers(formatted);
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  const toggleSuspend = async (userId: string, currentlySuspended: boolean) => {
    const newStatus = !currentlySuspended;
    const { error } = await supabase.from('profiles').update({
      is_suspended: newStatus,
      suspension_reason: newStatus ? 'Suspended by admin' : null,
    } as any).eq('user_id', userId);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }

    setUsers(prev => prev.map(u =>
      u.user_id === userId
        ? { ...u, profile: u.profile ? { ...u.profile, is_suspended: newStatus, suspension_reason: newStatus ? 'Suspended by admin' : null } : u.profile }
        : u
    ));
    toast({ title: newStatus ? 'User suspended ⛔' : 'User unsuspended ✅' });
  };

  const filtered = users.filter(u =>
    u.profile?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    u.role.includes(search.toLowerCase()) ||
    u.user_id.includes(search)
  );

  const grouped = {
    all: filtered,
    student: filtered.filter(u => u.role === 'student'),
    vendor: filtered.filter(u => u.role === 'vendor'),
    rider: filtered.filter(u => u.role === 'rider'),
    admin: filtered.filter(u => u.role === 'admin'),
  };

  if (loading) return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;

  const UserCard = ({ u }: { u: UserWithRole }) => {
    const isSuspended = u.profile?.is_suspended || false;
    return (
      <Card className={isSuspended ? 'border-destructive/30 bg-destructive/5' : ''}>
        <CardContent className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-full ${roleColors[u.role]}`}>
              {roleIcons[u.role]}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-medium">{u.profile?.full_name || 'Unknown User'}</p>
                {isSuspended && <span className="text-xs text-destructive font-medium">⛔ Suspended</span>}
              </div>
              <p className="text-sm text-muted-foreground">
                {u.profile?.phone || 'No phone'} · {u.profile?.campus_location || 'No location'}
              </p>
              <p className="text-xs text-muted-foreground">
                Joined {u.profile?.created_at ? new Date(u.profile.created_at).toLocaleDateString() : 'Unknown'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${roleColors[u.role]}`}>
              {u.role}
            </span>
            {u.role !== 'admin' && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant={isSuspended ? 'outline' : 'destructive'} className="gap-1">
                    {isSuspended ? <CheckCircle className="h-3.5 w-3.5" /> : <Ban className="h-3.5 w-3.5" />}
                    {isSuspended ? 'Unsuspend' : 'Suspend'}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{isSuspended ? 'Unsuspend' : 'Suspend'} {u.profile?.full_name}?</AlertDialogTitle>
                    <AlertDialogDescription>
                      {isSuspended
                        ? 'This will restore the user\'s access to the platform.'
                        : 'This will prevent the user from accessing the platform until unsuspended.'}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => toggleSuspend(u.user_id, isSuspended)}>
                      {isSuspended ? 'Unsuspend' : 'Suspend'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  const UserList = ({ list }: { list: UserWithRole[] }) => (
    <div className="space-y-2">
      {list.length === 0 ? (
        <p className="py-10 text-center text-muted-foreground">No users found</p>
      ) : (
        list.map(u => <UserCard key={u.id} u={u} />)
      )}
    </div>
  );

  return (
    <div>
      <h1 className="mb-2 font-heading text-2xl font-bold">Users</h1>
      <p className="mb-6 text-sm text-muted-foreground">{users.length} registered users</p>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search by name, role, or ID..." className="pl-10" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All ({grouped.all.length})</TabsTrigger>
          <TabsTrigger value="student">Users ({grouped.student.length})</TabsTrigger>
          <TabsTrigger value="vendor">Vendors ({grouped.vendor.length})</TabsTrigger>
          <TabsTrigger value="rider">Riders ({grouped.rider.length})</TabsTrigger>
          <TabsTrigger value="admin">Admins ({grouped.admin.length})</TabsTrigger>
        </TabsList>
        {Object.entries(grouped).map(([key, list]) => (
          <TabsContent key={key} value={key} className="mt-4">
            <UserList list={list} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

export default AdminUsers;
