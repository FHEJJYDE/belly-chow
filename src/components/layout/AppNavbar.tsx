import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { Button } from '@/components/ui/button';
import { ShoppingCart, LogOut, User, Package } from 'lucide-react';
import NotificationCenter from '@/components/NotificationCenter';
import logo from '@/assets/belly_chow_logo.png';

const AppNavbar = () => {
  const { user, role, signOut } = useAuth();
  const { itemCount } = useCart();

  return (
    <nav className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-md">
      <div className="container flex h-14 items-center justify-between">
        <Link to={user ? '/dashboard' : '/'} className="flex items-center gap-2">
          <img src={logo} alt="Belly-Chow" className="h-8 w-8 rounded-lg object-contain" />
          <span className="font-heading text-lg font-bold">Belly-Chow</span>
        </Link>

        <div className="flex items-center gap-2">
          {user ? (
            <>
              <NotificationCenter />
              {role === 'student' && (
                <>
                  <Link to="/orders">
                    <Button variant="ghost" size="icon">
                      <Package className="h-5 w-5" />
                    </Button>
                  </Link>
                  <Link to="/cart" className="relative">
                    <Button variant="ghost" size="icon">
                      <ShoppingCart className="h-5 w-5" />
                      {itemCount > 0 && (
                        <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                          {itemCount}
                        </span>
                      )}
                    </Button>
                  </Link>
                </>
              )}
              <Link to="/profile">
                <Button variant="ghost" size="icon">
                  <User className="h-5 w-5" />
                </Button>
              </Link>
              <Button variant="ghost" size="icon" onClick={signOut}>
                <LogOut className="h-5 w-5" />
              </Button>
            </>
          ) : (
            <>
              <Link to="/login"><Button variant="ghost" size="sm">Log in</Button></Link>
              <Link to="/signup"><Button size="sm">Sign up</Button></Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

export default AppNavbar;
