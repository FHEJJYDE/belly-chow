import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
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
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/vendors" element={<ProtectedRoute allowedRoles={['student']}><VendorsPage /></ProtectedRoute>} />
          <Route path="/vendor/:id" element={<ProtectedRoute allowedRoles={['student']}><VendorDetail /></ProtectedRoute>} />
          <Route path="/cart" element={<ProtectedRoute allowedRoles={['student']}><Cart /></ProtectedRoute>} />
          <Route path="/orders" element={<ProtectedRoute allowedRoles={['student']}><Orders /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/support" element={<ProtectedRoute allowedRoles={['student']}><Support /></ProtectedRoute>} />
          <Route path="/install" element={<Install />} />
          <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
          <Route path="/payment/verify" element={<ProtectedRoute allowedRoles={['student']}><PaymentVerification /></ProtectedRoute>} />
          <Route path="/test-payment" element={<TestPaymentPage />} />
          <Route path="/mock-checkout" element={<MockCheckout />} />

          {/* Admin panel */}
          <Route path="/admin" element={<ProtectedRoute allowedRoles={['admin']}><AdminLayout /></ProtectedRoute>}>
            <Route index element={<AdminOverview />} />
            <Route path="banners" element={<AdminBanners />} />
            <Route path="vendors" element={<AdminVendors />} />
            <Route path="riders" element={<AdminRiders />} />
            <Route path="orders" element={<AdminOrders />} />
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

          {/* Vendor panel */}
          <Route path="/vendor-panel" element={<ProtectedRoute allowedRoles={['vendor']}><VendorLayout /></ProtectedRoute>}>
            <Route index element={<VendorOverview />} />
            <Route path="orders" element={<VendorOrdersPage />} />
            <Route path="menu" element={<VendorMenu />} />
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
