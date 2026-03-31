import { LayoutDashboard, Store, Package, Users, Settings, CreditCard, AlertTriangle, RefreshCw, ShieldCheck, MessageSquare, Tag, GlassWater } from 'lucide-react';
import logo from '@/assets/belly_chow_logo.png';
import { NavLink } from '@/components/NavLink';
import { useLocation } from 'react-router-dom';
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
  { title: 'Overview', url: '/admin', icon: LayoutDashboard },
  { title: 'Vendors', url: '/admin/vendors', icon: Store },
  { title: 'Orders', url: '/admin/orders', icon: Package },
  { title: 'Payments', url: '/admin/payments', icon: CreditCard },
  { title: 'Users', url: '/admin/users', icon: Users },
  { title: 'Disputes', url: '/admin/disputes', icon: AlertTriangle },
  { title: 'Refunds', url: '/admin/refunds', icon: RefreshCw },
  { title: 'Verifications', url: '/admin/verifications', icon: ShieldCheck },
  { title: 'Tickets', url: '/admin/tickets', icon: MessageSquare },
  { title: 'Promo Codes', url: '/admin/promo-codes', icon: Tag },
  { title: 'Settings', url: '/admin/settings', icon: Settings },
];

export function AdminSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const location = useLocation();

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <div className="flex items-center gap-2 px-4 py-4">
          <img src={logo} alt="Belly-Chow" className="h-8 w-8 shrink-0 rounded-lg object-contain" />
          {!collapsed && <span className="font-heading text-lg font-bold">Admin Panel</span>}
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
                      end={item.url === '/admin'}
                      className="hover:bg-sidebar-accent/50"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                    >
                      <item.icon className="mr-2 h-4 w-4" />
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
