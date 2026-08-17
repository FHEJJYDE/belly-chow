import { Outlet } from 'react-router-dom';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { VendorSidebar } from './VendorSidebar';
import VendorBottomNav from './VendorBottomNav';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from 'next-themes';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { LogOut, User, Sun, Moon } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import NotificationCenter from '@/components/NotificationCenter';

const VendorLayout = () => {
  const { signOut } = useAuth();
  const { resolvedTheme, setTheme } = useTheme();
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
  const isMobile = useIsMobile();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        {!isMobile && <VendorSidebar />}
        <div className="flex-1 flex flex-col">
          <header className="sticky top-0 z-50 h-14 flex items-center justify-between border-b border-border/40 bg-background/70 backdrop-blur-md px-4">
            {!isMobile && <SidebarTrigger />}
            {isMobile && <span className="font-heading text-lg font-bold">Vendor Panel</span>}
            <div className="flex items-center gap-1">
              <NotificationCenter />
              <Button variant="ghost" size="icon" onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')} className="text-muted-foreground hover:text-foreground">
                {resolvedTheme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </Button>
              <Link to="/profile">
                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground"><User className="h-5 w-5" /></Button>
              </Link>
              <Button variant="ghost" size="icon" onClick={handleSignOut} className="text-muted-foreground hover:text-foreground">
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          </header>
          <main className={`flex-1 p-6 ${isMobile ? 'pb-20' : ''}`}>
            <Outlet />
          </main>
        </div>
        {isMobile && <VendorBottomNav />}
      </div>
    </SidebarProvider>
  );
};

export default VendorLayout;
