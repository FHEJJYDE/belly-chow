import { Outlet } from 'react-router-dom';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { VendorSidebar } from './VendorSidebar';
import VendorBottomNav from './VendorBottomNav';
import { useAuth } from '@/contexts/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { LogOut, User } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import NotificationCenter from '@/components/NotificationCenter';

const VendorLayout = () => {
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
  const isMobile = useIsMobile();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        {!isMobile && <VendorSidebar />}
        <div className="flex-1 flex flex-col">
          <header className="sticky top-0 z-40 h-14 flex items-center justify-between border-b border-border/60 bg-card/95 backdrop-blur-md px-5">
            {!isMobile && (
              <div className="flex items-center gap-3">
                <SidebarTrigger />
                <span className="text-xs font-medium text-muted-foreground hidden sm:inline">Merchant Portal</span>
              </div>
            )}
            {isMobile && <span className="font-heading text-base font-bold">Merchant Portal</span>}
            <div className="flex items-center gap-1.5">
              <NotificationCenter />
              <Link to="/profile">
                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg text-muted-foreground hover:text-foreground">
                  <i className="fa-solid fa-user text-sm" />
                </Button>
              </Link>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg text-muted-foreground hover:text-destructive">
                    <i className="fa-solid fa-right-from-bracket text-sm" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirm Logout</AlertDialogTitle>
                    <AlertDialogDescription>Are you sure you want to log out of your vendor portal account?</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleSignOut} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Log Out</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
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
