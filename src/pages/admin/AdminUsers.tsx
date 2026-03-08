import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

interface UserWithRole {
  id: string;
  user_id: string;
  role: string;
  profile?: {
    full_name: string;
    phone: string | null;
    campus_location: string | null;
  };
}

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

  const roleColors: Record<string, string> = {
    admin: 'bg-purple-500/10 text-purple-700',
    vendor: 'bg-blue-500/10 text-blue-700',
    rider: 'bg-orange-500/10 text-orange-700',
    student: 'bg-green-500/10 text-green-700',
  };

  const filtered = users.filter(u =>
    u.profile?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    u.role.includes(search.toLowerCase()) ||
    u.user_id.includes(search)
  );

  const grouped = {
    admin: filtered.filter(u => u.role === 'admin'),
    vendor: filtered.filter(u => u.role === 'vendor'),
    rider: filtered.filter(u => u.role === 'rider'),
    student: filtered.filter(u => u.role === 'student'),
  };

  if (loading) return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;

  return (
    <div>
      <h1 className="mb-6 font-heading text-2xl font-bold">Users</h1>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search by name, role, or ID..." className="pl-10" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="mb-4 flex gap-3">
        {Object.entries(grouped).map(([role, list]) => (
          <Badge key={role} variant="outline" className="capitalize">{role}: {list.length}</Badge>
        ))}
      </div>

      <div className="space-y-2">
        {filtered.map(u => (
          <Card key={u.id}>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="font-medium">{u.profile?.full_name || 'Unknown User'}</p>
                <p className="text-sm text-muted-foreground">
                  {u.profile?.phone || 'No phone'} · {u.profile?.campus_location || 'No location'}
                </p>
                <p className="text-xs text-muted-foreground">{u.user_id.slice(0, 12)}...</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${roleColors[u.role] || ''}`}>
                {u.role}
              </span>
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && <p className="py-10 text-center text-muted-foreground">No users found</p>}
      </div>
    </div>
  );
};

export default AdminUsers;
