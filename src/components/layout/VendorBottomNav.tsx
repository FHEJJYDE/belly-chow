import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';

const items = [
  { to: '/vendor-panel', icon: 'fa-solid fa-chart-pie', label: 'Overview' },
  { to: '/vendor-panel/orders', icon: 'fa-solid fa-receipt', label: 'Orders' },
  { to: '/vendor-panel/menu', icon: 'fa-solid fa-utensils', label: 'Menu' },
  { to: '/vendor-panel/payouts', icon: 'fa-solid fa-building-columns', label: 'Payouts' },
  { to: '/vendor-panel/settings', icon: 'fa-solid fa-store', label: 'Settings' },
];

const VendorBottomNav = () => {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/60 bg-card/95 backdrop-blur-md md:hidden safe-area-bottom">
      <div className="flex items-center justify-around h-14">
        {items.map((item) => {
          const active = location.pathname === item.to;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                'flex flex-col items-center justify-center gap-1 flex-1 h-full text-[11px] transition-all relative',
                active ? 'text-primary font-semibold' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {active && (
                <div className="absolute top-0 w-8 h-0.5 rounded-b-full bg-primary" />
              )}
              <i className={cn(item.icon, 'text-sm', active ? 'text-primary' : '')} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default VendorBottomNav;
