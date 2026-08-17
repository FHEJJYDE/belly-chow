import { Outlet } from 'react-router-dom';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AdminSidebar } from './AdminSidebar';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { LogOut, User } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import NotificationCenter from '@/components/NotificationCenter';

const AdminLayout = () => {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      navigate('/login', { replace: true });
    }
  };
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AdminSidebar />
        <div className="flex-1 flex flex-col">
          <header className="sticky top-0 z-50 h-14 flex items-center justify-between glass-nav px-4">
            <SidebarTrigger />
            <div className="flex items-center gap-1">
              <NotificationCenter />
              <Link to="/profile">
                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground"><User className="h-5 w-5" /></Button>
              </Link>
              <Button variant="ghost" size="icon" onClick={handleSignOut} className="text-muted-foreground hover:text-foreground">
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          </header>
          <main className="flex-1 p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default AdminLayout;
