import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, User, Bike, Store, Shield } from 'lucide-react';

interface UserWithRole {
  id: string;
  user_id: string;
  role: string;
  profile?: {
    full_name: string;
    phone: string | null;
    campus_location: string | null;
    created_at: string;
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
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data: roles } = await supabase.from('user_roles').select('*');
      const { data: profiles } = await supabase.from('profiles').select('*');

      const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));
      const merged = (roles || []).map(r => ({
        ...r,
        profile: profileMap.get(r.user_id) as UserWithRole['profile'],
      }));

      setUsers(merged);
      setLoading(false);
    };
    fetch();
  }, []);

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

  const UserCard = ({ u }: { u: UserWithRole }) => (
    <Card>
      <CardContent className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-full ${roleColors[u.role]}`}>
            {roleIcons[u.role]}
          </div>
          <div>
            <p className="font-medium">{u.profile?.full_name || 'Unknown User'}</p>
            <p className="text-sm text-muted-foreground">
              {u.profile?.phone || 'No phone'} · {u.profile?.campus_location || 'No location'}
            </p>
            <p className="text-xs text-muted-foreground">
              Joined {u.profile?.created_at ? new Date(u.profile.created_at).toLocaleDateString() : 'Unknown'}
            </p>
          </div>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${roleColors[u.role]}`}>
          {u.role}
        </span>
      </CardContent>
    </Card>
  );

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
          <TabsTrigger value="student">Students ({grouped.student.length})</TabsTrigger>
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
