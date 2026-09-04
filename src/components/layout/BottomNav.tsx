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
    <div className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none md:hidden pb-safe">
      <div className="px-3 pb-3 pt-1">
        <nav className="pointer-events-auto mx-auto max-w-md rounded-2xl border border-border/60 bg-background/85 dark:bg-card/90 backdrop-blur-xl shadow-xl shadow-black/5 dark:shadow-black/40 p-1.5 transition-all">
          <div className="flex items-center justify-around gap-1">
            {items.map((item) => {
              const active = location.pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    'relative flex flex-1 flex-col items-center justify-center py-1.5 px-1 rounded-xl text-[10px] font-medium transition-all duration-200 active:scale-95 select-none',
                    active
                      ? 'bg-primary/10 text-primary font-bold dark:bg-primary/20 shadow-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
                  )}
                >
                  <div className="relative mb-0.5 flex items-center justify-center">
                    <item.icon
                      className={cn(
                        'h-5 w-5 transition-all duration-200',
                        active ? 'scale-110 stroke-[2.5px] text-primary' : 'stroke-[1.75px]'
                      )}
                    />
                    {item.badge !== undefined && item.badge > 0 && (
                      <span className="absolute -right-2.5 -top-1.5 flex h-4.5 min-w-[1.125rem] px-1 items-center justify-center rounded-full bg-gradient-to-r from-primary to-amber-500 text-[10px] font-extrabold text-primary-foreground shadow-md animate-pulse">
                        {item.badge > 99 ? '99+' : item.badge}
                      </span>
                    )}
                  </div>
                  <span className="tracking-tight leading-tight">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
};

export default BottomNav;
