import { lazy, Suspense } from "react";
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

// Core high-traffic entry routes (eagerly loaded for instant first paint)
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import NotificationBanner from "./components/NotificationBanner";

// Lazy-loaded Student & Shared pages
const VendorsPage = lazy(() => import("./pages/Vendors"));
const VendorDetail = lazy(() => import("./pages/VendorDetail"));
const Cart = lazy(() => import("./pages/Cart"));
const Orders = lazy(() => import("./pages/Orders"));
const Profile = lazy(() => import("./pages/Profile"));
const Support = lazy(() => import("./pages/Support"));
const Install = lazy(() => import("./pages/Install"));
const Notifications = lazy(() => import("./pages/Notifications"));
const PaymentVerification = lazy(() => import("./components/payment/PaymentVerification"));
const TestPaymentPage = lazy(() => import("./pages/TestPayment"));
const MockCheckout = lazy(() => import("./pages/MockCheckout"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Lazy-loaded Admin bundle (Recharts & 16 management screens only downloaded by admins)
const AdminLayout = lazy(() => import("./components/layout/AdminLayout"));
const AdminOverview = lazy(() => import("./pages/admin/AdminOverview"));
const AdminVendors = lazy(() => import("./pages/admin/AdminVendors"));
const AdminRiders = lazy(() => import("./pages/admin/AdminRiders"));
const AdminOrders = lazy(() => import("./pages/admin/AdminOrders"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers"));
const AdminSettings = lazy(() => import("./pages/admin/AdminSettings"));
const AdminDisputes = lazy(() => import("./pages/admin/AdminDisputes"));
const AdminRefunds = lazy(() => import("./pages/admin/AdminRefunds"));
const AdminVerifications = lazy(() => import("./pages/admin/AdminVerifications"));
const AdminTickets = lazy(() => import("./pages/admin/AdminTickets"));
const AdminPromoCodes = lazy(() => import("./pages/admin/AdminPromoCodes"));
const AdminPayments = lazy(() => import("./pages/admin/AdminPayments"));
const AdminEscrow = lazy(() => import("./pages/admin/AdminEscrow"));
const AdminLocations = lazy(() => import("./pages/admin/AdminLocations"));
const AdminBanners = lazy(() => import("./pages/admin/AdminBanners"));
const AdminDrinks = lazy(() => import("./pages/admin/AdminDrinks"));

// Lazy-loaded Vendor bundle
const VendorLayout = lazy(() => import("./components/layout/VendorLayout"));
const VendorOverview = lazy(() => import("./pages/vendor/VendorOverview"));
const VendorOrdersPage = lazy(() => import("./pages/vendor/VendorOrders"));
const VendorMenu = lazy(() => import("./pages/vendor/VendorMenu"));
const VendorPayouts = lazy(() => import("./pages/vendor/VendorPayouts"));
const VendorSettings = lazy(() => import("./pages/vendor/VendorSettings"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 120_000, // 2 minutes fresh cache
      gcTime: 600_000,    // 10 minutes garbage collection
      refetchOnWindowFocus: false,
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

const PageLoader = () => (
  <div className="flex min-h-[60vh] items-center justify-center">
    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
  </div>
);

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
        <Suspense fallback={<PageLoader />}>
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
        </Suspense>
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
