

# Belly-Chow — Implementation Plan

## Phase 1: Foundation & Auth (First Build)

### 1. Project Setup
- Update page title and metadata to "Belly-Chow"
- Set up color scheme: warm food-themed palette (orange/amber primary, dark neutrals)
- Configure Lovable Cloud (Supabase) for backend

### 2. Database Schema
- **profiles** — name, phone, avatar_url, campus_location
- **user_roles** — role enum (student, vendor, rider, admin) with security definer function
- **vendors** — name, description, logo, address, open/close hours, is_active
- **menu_items** — vendor_id, name, description, price, image, category, is_available
- **orders** — student_id, vendor_id, rider_id, status enum, total, delivery_fee, payment_method, payment_status, delivery_location, notes
- **order_items** — order_id, menu_item_id, quantity, price
- **reviews** — order_id, user_id, vendor_id, rider_id, rating, comment
- RLS policies on all tables using has_role() security definer pattern

### 3. Auth & Role Selection
- Sign up page with email/password + role selection (Student, Vendor, Rider)
- Login page
- Post-login redirect to role-specific dashboard
- Admin role assigned manually via DB

### 4. Student Pages
- **Home** — search bar, vendor cards grid, categories filter
- **Vendor page** — menu items grouped by category, add-to-cart buttons
- **Cart** — item list, quantity controls, delivery location input, payment method select (Pay on Delivery / Bank Transfer), place order
- **Order tracking** — live status with step indicator
- **Order history** — past orders list with reorder option
- **Reviews** — rate vendor & rider after delivery

### 5. Vendor Dashboard
- **Menu management** — CRUD for items with image upload, categories, availability toggle
- **Orders** — incoming orders list, accept/reject, mark as ready
- **Availability** — set hours, toggle open/closed
- **Earnings** — revenue charts (daily/weekly/monthly)

### 6. Rider Dashboard
- **Available orders** — list of ready-for-pickup orders, accept button
- **Active delivery** — vendor & student info, status update buttons (picked up → delivering → delivered)
- **Earnings** — completed deliveries and totals
- **Online/offline toggle**

### 7. Admin Dashboard
- **Analytics** — order count, revenue, active users (recharts)
- **User management** — list/approve/suspend vendors & riders
- **Order monitoring** — all orders with filters
- **Settings** — delivery fee, commission rate

### 8. Shared Components
- Responsive navbar with role-aware menu items
- Mobile-first layout (bottom nav on mobile)
- Toast notifications for order updates
- Real-time subscriptions for order status changes

This is a large build. I'll implement it incrementally, starting with database + auth + landing page, then student flow, vendor dashboard, rider dashboard, and admin last.

