import logo from '@/assets/belly_chow_logo.png';
import { NavLink } from '@/components/NavLink';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';

const items = [
  { title: 'Store Overview', url: '/vendor-panel', icon: 'fa-solid fa-chart-pie' },
  { title: 'Kitchen Orders', url: '/vendor-panel/orders', icon: 'fa-solid fa-receipt' },
  { title: 'Menu & Dishes', url: '/vendor-panel/menu', icon: 'fa-solid fa-utensils' },
  { title: 'Wallet & Payouts', url: '/vendor-panel/payouts', icon: 'fa-solid fa-building-columns' },
  { title: 'Store Settings', url: '/vendor-panel/settings', icon: 'fa-solid fa-store' },
];

export function VendorSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';

  return (
    <Sidebar collapsible="icon" className="border-r border-border/60">
      <SidebarContent className="bg-card">
        <div className="flex items-center gap-3 px-4 py-4 border-b border-border/50">
          <img src={logo} alt="Belly-Chow" className="h-10 w-10 shrink-0 rounded-xl object-contain border border-border/60 p-0.5 bg-background shadow-sm" />
          {!collapsed && (
            <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary uppercase tracking-wider">
              Merchant Portal
            </span>
          )}
        </div>
        <SidebarGroup className="py-3">
          {!collapsed && (
            <SidebarGroupLabel className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 px-4 mb-1">
              Store Operations
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === '/vendor-panel'}
                      className="flex items-center gap-3 rounded-lg mx-2 px-3 py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                      activeClassName="bg-primary/10 text-primary font-semibold"
                    >
                      <i className={`${item.icon} w-4 text-center text-[13px] shrink-0`} />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
