import { Link, useLocation } from 'react-router-dom';
import { Home, Package, ShoppingCart, User, HeadphonesIcon } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { cn } from '@/lib/utils';

const BottomNav = () => {
  const { user, role } = useAuth();
  const { itemCount } = useCart();
  const location = useLocation();

  if (!user || role === 'admin' || role === 'vendor') return null;

  const items = [
    { to: '/dashboard', icon: Home, label: 'Home' },
    { to: '/orders', icon: Package, label: 'Orders' },
    ...(role === 'student' ? [{ to: '/cart', icon: ShoppingCart, label: 'Cart', badge: itemCount }] : []),
    { to: '/support', icon: HeadphonesIcon, label: 'Help' },
    { to: '/profile', icon: User, label: 'Profile' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/60 glass-nav md:hidden safe-area-bottom">
      <div className="flex items-center justify-around h-14">
        {items.map((item) => {
          const active = location.pathname === item.to;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                'flex flex-col items-center justify-center gap-0.5 flex-1 h-full text-[11px] transition-colors relative',
                active ? 'text-foreground font-medium' : 'text-muted-foreground'
              )}
            >
              <div className="relative">
                <item.icon className="h-5 w-5" />
                {item.badge && item.badge > 0 && (
                  <span className="absolute -right-2 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-foreground text-[9px] font-bold text-background">
                    {item.badge}
                  </span>
                )}
              </div>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
