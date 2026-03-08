import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { CartProvider } from "@/contexts/CartContext";
import { useOrderNotifications } from "@/hooks/useOrderNotifications";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import VendorDetail from "./pages/VendorDetail";
import Cart from "./pages/Cart";
import Orders from "./pages/Orders";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";

// Admin pages
import AdminLayout from "./components/layout/AdminLayout";
import AdminOverview from "./pages/admin/AdminOverview";
import AdminVendors from "./pages/admin/AdminVendors";
import AdminOrders from "./pages/admin/AdminOrders";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminSettings from "./pages/admin/AdminSettings";
import AdminPayments from "./pages/admin/AdminPayments";
import AdminDisputes from "./pages/admin/AdminDisputes";
import AdminRefunds from "./pages/admin/AdminRefunds";
import AdminVerifications from "./pages/admin/AdminVerifications";
import AdminTickets from "./pages/admin/AdminTickets";
import Support from "./pages/Support";

// Vendor pages
import VendorLayout from "./components/layout/VendorLayout";
import VendorOverview from "./pages/vendor/VendorOverview";
import VendorOrdersPage from "./pages/vendor/VendorOrders";
import VendorMenu from "./pages/vendor/VendorMenu";
import VendorSettings from "./pages/vendor/VendorSettings";

const queryClient = new QueryClient();

const NotificationListener = () => {
  useOrderNotifications();
  return null;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <CartProvider>
            <NotificationListener />
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/vendor/:id" element={<VendorDetail />} />
              <Route path="/cart" element={<Cart />} />
              <Route path="/orders" element={<Orders />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/support" element={<Support />} />

              {/* Admin panel */}
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<AdminOverview />} />
                <Route path="vendors" element={<AdminVendors />} />
                <Route path="orders" element={<AdminOrders />} />
                <Route path="payments" element={<AdminPayments />} />
                <Route path="users" element={<AdminUsers />} />
                <Route path="disputes" element={<AdminDisputes />} />
                <Route path="refunds" element={<AdminRefunds />} />
                <Route path="verifications" element={<AdminVerifications />} />
                <Route path="settings" element={<AdminSettings />} />
              </Route>

              {/* Vendor panel */}
              <Route path="/vendor-panel" element={<VendorLayout />}>
                <Route index element={<VendorOverview />} />
                <Route path="orders" element={<VendorOrdersPage />} />
                <Route path="menu" element={<VendorMenu />} />
                <Route path="settings" element={<VendorSettings />} />
              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>
          </CartProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
