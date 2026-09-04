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
    <nav className="sticky top-0 z-50 glass-nav">
      <div className="container flex h-14 items-center justify-between">
        <Link to={user ? '/dashboard' : '/'} className="flex items-center gap-2.5 group">
          <div className="h-9 w-9 rounded-xl overflow-hidden border border-primary/30 shadow-md shadow-orange-500/10 group-hover:scale-105 transition-transform duration-300">
            <img src={logo} alt="Belly-Chow" className="h-full w-full object-contain bg-background" />
          </div>
          <span className="font-heading text-xl font-extrabold tracking-tight bg-gradient-to-r from-primary via-orange-500 to-amber-500 bg-clip-text text-transparent">Belly-Chow</span>
        </Link>

        <div className="flex items-center gap-1">
          {user ? (
            <>
              {role === 'student' && <WalletModal />}
              <NotificationCenter />
              {role === 'student' && (
                <div className="hidden md:flex items-center gap-1">
                  <Link to="/orders">
                    <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                      <Package className="h-5 w-5" />
                    </Button>
                  </Link>
                  <Link to="/cart" className="relative">
                    <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                      <ShoppingCart className="h-5 w-5" />
                      {itemCount > 0 && (
                        <span className="absolute -right-0.5 -top-0.5 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                          {itemCount}
                        </span>
                      )}
                    </Button>
                  </Link>
                </div>
              )}
              <Link to="/profile" className="hidden md:inline-flex">
                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                  <User className="h-5 w-5" />
                </Button>
              </Link>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                    <LogOut className="h-5 w-5" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirm Logout</AlertDialogTitle>
                    <AlertDialogDescription>Are you sure you want to log out of your Belly-Chow account?</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleSignOut} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Log Out</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          ) : (
            <>
              <Link to="/login"><Button variant="ghost" size="sm" className="text-muted-foreground">Log in</Button></Link>
              <Link to="/signup"><Button size="sm">Sign up</Button></Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

export default AppNavbar;
