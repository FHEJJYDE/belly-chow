import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { ShoppingCart, LogOut, User, Package } from 'lucide-react';
import NotificationCenter from '@/components/NotificationCenter';
import WalletModal from '@/components/wallet/WalletModal';
import logo from '@/assets/belly_chow_logo.png';

const AppNavbar = () => {
  const { user, role, signOut } = useAuth();
  const { itemCount } = useCart();
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
    <header className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-xl transition-all">
      <div className="container flex h-14 items-center justify-between">
        <Link to={user ? '/dashboard' : '/'} className="flex items-center group select-none">
          <div className="h-10 w-10 rounded-xl overflow-hidden border border-primary/25 shadow-sm group-hover:scale-105 transition-transform duration-300">
            <img src={logo} alt="Belly-Chow" className="h-full w-full object-contain bg-background" />
          </div>
        </Link>

        <div className="flex items-center gap-1.5">
          {user ? (
            <>
              {role === 'student' && <WalletModal />}
              <NotificationCenter />
              {role === 'student' && (
                <div className="hidden md:flex items-center gap-1">
                  <Link to="/orders">
                    <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-muted-foreground hover:text-foreground" title="My Orders">
                      <i className="fa-solid fa-bag-shopping text-sm" />
                    </Button>
                  </Link>
                  <Link to="/cart" className="relative">
                    <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-muted-foreground hover:text-foreground" title="My Tray">
                      <i className="fa-solid fa-basket-shopping text-sm" />
                      {itemCount > 0 && (
                        <span className="absolute -right-0.5 -top-0.5 flex h-4.5 min-w-[1.125rem] px-1 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground shadow-sm">
                          {itemCount > 99 ? '99+' : itemCount}
                        </span>
                      )}
                    </Button>
                  </Link>
                </div>
              )}
              <Link to="/profile" className="hidden md:inline-flex">
                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-muted-foreground hover:text-foreground" title="Account">
                  <i className="fa-solid fa-user text-sm" />
                </Button>
              </Link>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors" title="Sign Out">
                    <i className="fa-solid fa-right-from-bracket text-sm" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="rounded-2xl">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirm Logout</AlertDialogTitle>
                    <AlertDialogDescription>Are you sure you want to log out of your Belly-Chow account?</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleSignOut} className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Log Out
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Link to="/login">
                <Button variant="ghost" size="sm" className="rounded-xl text-muted-foreground font-medium">Log in</Button>
              </Link>
              <Link to="/signup">
                <Button size="sm" className="rounded-xl font-bold shadow-md shadow-orange-500/20">Sign up</Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default AppNavbar;
