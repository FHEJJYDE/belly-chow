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

const groups = [
  {
    label: 'Command Center',
    items: [
      { title: 'Overview', url: '/admin', icon: 'fa-solid fa-chart-line' },
      { title: 'Live Orders', url: '/admin/orders', icon: 'fa-solid fa-boxes-packing' },
      { title: 'Delivery Zones', url: '/admin/locations', icon: 'fa-solid fa-map-location-dot' },
    ],
  },
  {
    label: 'Marketplace & Partners',
    items: [
      { title: 'Vendors', url: '/admin/vendors', icon: 'fa-solid fa-store' },
      { title: 'Riders & Vetting', url: '/admin/riders', icon: 'fa-solid fa-motorcycle' },
      { title: 'Users Directory', url: '/admin/users', icon: 'fa-solid fa-users' },
      { title: 'ID Verifications', url: '/admin/verifications', icon: 'fa-solid fa-id-card-clip' },
    ],
  },
  {
    label: 'Growth & Catalog',
    items: [
      { title: 'Hero Banners', url: '/admin/banners', icon: 'fa-solid fa-rectangle-ad' },
      { title: 'Drinks Catalog', url: '/admin/drinks', icon: 'fa-solid fa-bottle-water' },
      { title: 'Promo Codes', url: '/admin/promo-codes', icon: 'fa-solid fa-ticket' },
    ],
  },
  {
    label: 'Finance & Operations',
    items: [
      { title: 'Payments & Payouts', url: '/admin/payments', icon: 'fa-solid fa-money-check-dollar' },
      { title: 'Escrow Ledger', url: '/admin/escrow', icon: 'fa-solid fa-vault' },
      { title: 'Refunds', url: '/admin/refunds', icon: 'fa-solid fa-money-bill-transfer' },
      { title: 'Disputes', url: '/admin/disputes', icon: 'fa-solid fa-scale-balanced' },
      { title: 'Support Tickets', url: '/admin/tickets', icon: 'fa-solid fa-headset' },
      { title: 'Platform Settings', url: '/admin/settings', icon: 'fa-solid fa-sliders' },
    ],
  },
];

export function AdminSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';

  return (
    <Sidebar collapsible="icon" className="border-r border-border/60">
      <SidebarContent className="bg-card">
        <div className="flex items-center gap-3 px-4 py-4 border-b border-border/50">
          <img src={logo} alt="Belly-Chow" className="h-9 w-9 shrink-0 rounded-xl object-contain border border-border/60 p-0.5 bg-background shadow-sm" />
          {!collapsed && (
            <div className="min-w-0">
              <span className="font-heading text-base font-bold tracking-tight block leading-none">Belly-Chow</span>
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mt-1 block">Admin Console</span>
            </div>
          )}
        </div>

        <div className="py-2 space-y-1">
          {groups.map((group) => (
            <SidebarGroup key={group.label} className="py-1.5">
              {!collapsed && (
                <SidebarGroupLabel className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 px-4 mb-1">
                  {group.label}
                </SidebarGroupLabel>
              )}
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild>
                        <NavLink
                          to={item.url}
                          end={item.url === '/admin'}
                          className="flex items-center gap-3 rounded-lg mx-2 px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
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
          ))}
        </div>
      </SidebarContent>
    </Sidebar>
  );
}
