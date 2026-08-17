import { LayoutDashboard, Package, Settings, UtensilsCrossed } from 'lucide-react';
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
  { title: 'Overview', url: '/vendor-panel', icon: LayoutDashboard },
  { title: 'Orders', url: '/vendor-panel/orders', icon: Package },
  { title: 'Menu', url: '/vendor-panel/menu', icon: UtensilsCrossed },
  { title: 'Settings', url: '/vendor-panel/settings', icon: Settings },
];

export function VendorSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <div className="flex items-center gap-2 px-4 py-4">
          <img src={logo} alt="Belly-Chow" className="h-8 w-8 shrink-0 rounded-lg object-contain" />
          {!collapsed && <span className="font-heading text-lg font-bold">Vendor Panel</span>}
        </div>
        <SidebarGroup>
          <SidebarGroupLabel>Management</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === '/vendor-panel'}
                      className="hover:bg-primary/5 rounded-md w-full py-2 px-3 transition-colors"
                      activeClassName="bg-primary/10 text-primary font-semibold border-l-4 border-primary rounded-l-none"
                    >
                      <item.icon className="mr-2 h-4 w-4 shrink-0" />
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
