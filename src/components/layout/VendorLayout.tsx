import { Outlet } from 'react-router-dom';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { VendorSidebar } from './VendorSidebar';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { LogOut, User, Sun, Moon } from 'lucide-react';
import { Link } from 'react-router-dom';

const VendorLayout = () => {
  const { signOut } = useAuth();
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <VendorSidebar />
        <div className="flex-1 flex flex-col">
          <header className="sticky top-0 z-50 h-14 flex items-center justify-between border-b bg-background/80 backdrop-blur-md px-4">
            <SidebarTrigger />
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="text-muted-foreground hover:text-foreground">
                {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </Button>
              <Link to="/profile">
                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground"><User className="h-5 w-5" /></Button>
              </Link>
              <Button variant="ghost" size="icon" onClick={signOut} className="text-muted-foreground hover:text-foreground">
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

export default VendorLayout;
