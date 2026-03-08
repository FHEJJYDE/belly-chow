import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { ShoppingCart, LogOut, User, Package, Sun, Moon } from 'lucide-react';
import NotificationCenter from '@/components/NotificationCenter';
import logo from '@/assets/belly_chow_logo.png';

const AppNavbar = () => {
  const { user, role, signOut } = useAuth();
  const { itemCount } = useCart();
  const { theme, setTheme } = useTheme();

  return (
    <nav className="sticky top-0 z-50 border-b bg-background/90 backdrop-blur-lg">
      <div className="container flex h-14 items-center justify-between">
        <Link to={user ? '/dashboard' : '/'} className="flex items-center gap-2.5">
          <img src={logo} alt="Belly-Chow" className="h-8 w-8 rounded-lg object-contain" />
          <span className="font-heading text-lg font-bold tracking-tight">Belly-Chow</span>
        </Link>

        <div className="flex items-center gap-1">
          {user ? (
            <>
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
                        <span className="absolute -right-0.5 -top-0.5 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-foreground text-[10px] font-bold text-background">
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
              <Button variant="ghost" size="icon" onClick={signOut} className="text-muted-foreground hover:text-foreground">
                <LogOut className="h-5 w-5" />
              </Button>
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
