import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { cn } from '@/lib/utils';

const BottomNav = () => {
  const { user, role } = useAuth();
  const { itemCount } = useCart();
  const location = useLocation();

  if (!user || role !== 'student') return null;

  const items = [
    { to: '/dashboard', icon: 'fa-solid fa-house', label: 'Home' },
    { to: '/vendors', icon: 'fa-solid fa-store', label: 'Restaurants' },
    { to: '/orders', icon: 'fa-solid fa-bag-shopping', label: 'Orders' },
    { to: '/cart', icon: 'fa-solid fa-basket-shopping', label: 'Tray', badge: itemCount },
    { to: '/profile', icon: 'fa-solid fa-user', label: 'Account' },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none md:hidden pb-safe">
      <div className="px-3 pb-3 pt-1">
        <nav className="pointer-events-auto mx-auto max-w-md rounded-2xl border border-border/80 bg-card/95 backdrop-blur-xl shadow-lg p-1.5">
          <div className="flex items-center justify-around gap-1">
            {items.map((item) => {
              const active = location.pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    'relative flex flex-1 flex-col items-center justify-center py-2 px-1 rounded-xl text-[10px] font-medium transition-all select-none',
                    active
                      ? 'bg-primary/10 text-primary font-semibold'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <div className="relative mb-1 flex items-center justify-center">
                    <i className={cn(item.icon, 'text-sm', active ? 'text-primary' : '')} />
                    {item.badge !== undefined && item.badge > 0 && (
                      <span className="absolute -right-3 -top-1.5 flex h-4 min-w-[1rem] px-1 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                        {item.badge > 99 ? '99+' : item.badge}
                      </span>
                    )}
                  </div>
                  <span className="tracking-tight leading-none">{item.label}</span>
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
