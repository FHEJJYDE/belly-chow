import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Package, UtensilsCrossed, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

const items = [
  { to: '/vendor-panel', icon: LayoutDashboard, label: 'Overview' },
  { to: '/vendor-panel/orders', icon: Package, label: 'Orders' },
  { to: '/vendor-panel/menu', icon: UtensilsCrossed, label: 'Menu' },
  { to: '/vendor-panel/settings', icon: Settings, label: 'Settings' },
];

const VendorBottomNav = () => {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/40 bg-background/60 backdrop-blur-md md:hidden safe-area-bottom">
      <div className="flex items-center justify-around h-14">
        {items.map((item) => {
          const active = location.pathname === item.to;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                'flex flex-col items-center justify-center gap-0.5 flex-1 h-full text-[11px] transition-all relative',
                active ? 'text-primary font-bold' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {active && (
                <div className="absolute top-0 w-8 h-0.5 rounded-b-full bg-primary shadow-[0_0_8px_rgba(249,115,22,0.6)]" />
              )}
              <item.icon className={cn('h-5 w-5 transition-transform', active && 'scale-110')} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default VendorBottomNav;
