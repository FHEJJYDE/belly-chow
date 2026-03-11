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
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur-lg md:hidden safe-area-bottom">
      <div className="flex items-center justify-around h-14">
        {items.map((item) => {
          const active = location.pathname === item.to;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                'flex flex-col items-center justify-center gap-0.5 flex-1 h-full text-[11px] transition-colors',
                active ? 'text-foreground font-medium' : 'text-muted-foreground'
              )}
            >
              <item.icon className="h-5 w-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default VendorBottomNav;
