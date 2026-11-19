import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { CartProvider } from "@/contexts/CartContext";
import { LocationProvider } from "@/contexts/LocationContext";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { useOrderNotifications } from "@/hooks/useOrderNotifications";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useBackgroundNotifications } from "@/hooks/useBackgroundNotifications";
import BottomNav from "./components/layout/BottomNav";
import LoadingScreen from "./components/LoadingScreen";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import VendorsPage from "./pages/Vendors";
import VendorDetail from "./pages/VendorDetail";
import Cart from "./pages/Cart";
import Orders from "./pages/Orders";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";

// Admin pages
import AdminLayout from "./components/layout/AdminLayout";
import AdminOverview from "./pages/admin/AdminOverview";
import AdminVendors from "./pages/admin/AdminVendors";
import AdminRiders from "./pages/admin/AdminRiders";
import AdminOrders from "./pages/admin/AdminOrders";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminSettings from "./pages/admin/AdminSettings";
import AdminDisputes from "./pages/admin/AdminDisputes";
import AdminRefunds from "./pages/admin/AdminRefunds";
import AdminVerifications from "./pages/admin/AdminVerifications";
import AdminTickets from "./pages/admin/AdminTickets";
import AdminPromoCodes from "./pages/admin/AdminPromoCodes";
import AdminPayments from "./pages/admin/AdminPayments";
import AdminEscrow from "./pages/admin/AdminEscrow";
import AdminLocations from "./pages/admin/AdminLocations";
import AdminBanners from "./pages/admin/AdminBanners";
import AdminDrinks from "./pages/admin/AdminDrinks";
import Support from "./pages/Support";
import Install from "./pages/Install";
import Notifications from "./pages/Notifications";
import NotificationBanner from "./components/NotificationBanner";
import PaymentVerification from "./components/payment/PaymentVerification";
import TestPaymentPage from "./pages/TestPayment";
import MockCheckout from "./pages/MockCheckout";

// Vendor pages
import VendorLayout from "./components/layout/VendorLayout";
import VendorOverview from "./pages/vendor/VendorOverview";
import VendorOrdersPage from "./pages/vendor/VendorOrders";
import VendorMenu from "./pages/vendor/VendorMenu";
import VendorPayouts from "./pages/vendor/VendorPayouts";
import VendorSettings from "./pages/vendor/VendorSettings";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,   // 1 minute
      gcTime: 300_000,     // 5 minutes
    },
  },
});

const NotificationListener = () => {
  useOrderNotifications();
  usePushNotifications();
  useBackgroundNotifications();
  return null;
};

/** Redirects already-authenticated users away from guest-only pages (/login, /signup) */
const GuestRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, role, loading } = useAuth();
  if (loading || (user && !role)) {
    return <LoadingScreen />;
  }
  if (user) {
    if (role === 'admin') return <Navigate to="/admin" replace />;
    if (role === 'vendor') return <Navigate to="/vendor-panel" replace />;
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
};

const AppContent = () => {
  const { loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <>
      <NotificationListener />
      <NotificationBanner />
      <div className="pb-16 md:pb-0">
        <Routes>
          {/* Public & Guest routes */}
          <Route path="/" element={<Landing />} />
          <Route path="/install" element={<Install />} />
          <Route path="/login" element={<GuestRoute><Login /></GuestRoute>} />
          <Route path="/signup" element={<GuestRoute><Signup /></GuestRoute>} />

          {/* Shared authenticated routes */}
          <Route path="/dashboard" element={<ProtectedRoute allowedRoles={['student', 'rider', 'vendor', 'admin']}><Dashboard /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute allowedRoles={['student', 'rider', 'vendor', 'admin']}><Profile /></ProtectedRoute>} />
          <Route path="/notifications" element={<ProtectedRoute allowedRoles={['student', 'rider', 'vendor', 'admin']}><Notifications /></ProtectedRoute>} />

          {/* Student-only routes */}
          <Route path="/vendors" element={<ProtectedRoute allowedRoles={['student']}><VendorsPage /></ProtectedRoute>} />
          <Route path="/vendor/:id" element={<ProtectedRoute allowedRoles={['student']}><VendorDetail /></ProtectedRoute>} />
          <Route path="/cart" element={<ProtectedRoute allowedRoles={['student']}><Cart /></ProtectedRoute>} />
          <Route path="/orders" element={<ProtectedRoute allowedRoles={['student']}><Orders /></ProtectedRoute>} />
          <Route path="/support" element={<ProtectedRoute allowedRoles={['student', 'rider', 'vendor']}><Support /></ProtectedRoute>} />
          <Route path="/payment/verify" element={<ProtectedRoute allowedRoles={['student']}><PaymentVerification /></ProtectedRoute>} />
          <Route path="/mock-checkout" element={<ProtectedRoute allowedRoles={['student', 'admin']}><MockCheckout /></ProtectedRoute>} />
          <Route path="/test-payment" element={<ProtectedRoute allowedRoles={['admin']}><TestPaymentPage /></ProtectedRoute>} />

          {/* Admin panel (strictly admin only) */}
          <Route path="/admin" element={<ProtectedRoute allowedRoles={['admin']}><AdminLayout /></ProtectedRoute>}>
            <Route index element={<AdminOverview />} />
            <Route path="banners" element={<AdminBanners />} />
            <Route path="vendors" element={<AdminVendors />} />
            <Route path="riders" element={<AdminRiders />} />
            <Route path="orders" element={<AdminOrders />} />
            <Route path="drinks" element={<AdminDrinks />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="disputes" element={<AdminDisputes />} />
            <Route path="refunds" element={<AdminRefunds />} />
            <Route path="verifications" element={<AdminVerifications />} />
            <Route path="tickets" element={<AdminTickets />} />
            <Route path="promo-codes" element={<AdminPromoCodes />} />
            <Route path="locations" element={<AdminLocations />} />
            <Route path="payments" element={<AdminPayments />} />
            <Route path="escrow" element={<AdminEscrow />} />
            <Route path="settings" element={<AdminSettings />} />
          </Route>

          {/* Vendor panel (strictly vendor only) */}
          <Route path="/vendor-panel" element={<ProtectedRoute allowedRoles={['vendor']}><VendorLayout /></ProtectedRoute>}>
            <Route index element={<VendorOverview />} />
            <Route path="orders" element={<VendorOrdersPage />} />
            <Route path="menu" element={<VendorMenu />} />
            <Route path="payouts" element={<VendorPayouts />} />
            <Route path="settings" element={<VendorSettings />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
      <BottomNav />
    </>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <LocationProvider>
            <CartProvider>
              <AppContent />
            </CartProvider>
          </LocationProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
