# Belly-Chow: Complete Platform Capabilities & Technical Specification 🍔

Belly-Chow is a highly customized, mobile-first campus food delivery Progressive Web App (PWA) built with **React**, **TypeScript**, **Vite**, and **Supabase** (Postgres database, Realtime replication, and Storage). It bridges campus customers, local food vendors, independent riders, and administrators in a unified real-time delivery ecosystem.

---

## 👥 User Roles & Detailed Feature Flows

### 1. Customers
The customer panel is designed for fast browsing, smooth shopping, and secure checkout on campus.
*   **Vendor Catalog & Discovery**:
    *   Browse active campus vendors sorted by category, status (Open/Closed), and review ratings.
    *   Horizontal scroll-snap category filters.
    *   Detailed vendor menu pages with drink/sides upsell suggestions.
*   **Session-Persistent Shopping Cart**:
    *   Build shopping carts with custom delivery instructions.
    *   Items are persisted in `localStorage` so they do not clear upon tab refreshes or temporary logout transitions.
*   **Checkout & Payment Integrations**:
    *   Select between **Pay on Delivery (Cash)**, **Instant Card/USSD (KoraPay)**, or **Manual Bank Transfer**.
    *   Upload transfer receipts directly to Supabase storage to request vendor confirmation.
*   **Real-Time Order Tracking Map**:
    *   Track active deliveries in real-time on Leaflet maps.
    *   Live GPS location sharing broadcasts the customer's coordinates to the assigned rider.
*   **Disputes & Feedback**:
    *   File support tickets and dispute logs for unresolved deliveries.
    *   Rate and review completed meals.

---

### 2. Food Vendors
The merchant panel provides store owners with full control over operations, inventory, and finances.
*   **Operational Control**:
    *   Theme-aware status toggle (Open/Closed) with high-contrast dark/light mode visibility.
    *   Real-time audio chimes for incoming order alerts.
*   **Orders Pipeline Management**:
    *   Four-step preparation flow: Accept ➔ Prepare ➔ Ready ➔ Delivered.
    *   Examine customer bank transfer receipts and approve or reject payment states manually.
    *   Access active chat rooms directly with assigned riders and customers.
*   **Menu Catalog Management**:
    *   Add and delete dishes with customizable category tags.
    *   Toggle inventory availability switches (Sold Out ➔ Available) with a single tap.
*   **Advanced Analytics Dashboards**:
    *   Responsive analytics trackers for Pending, Active, Total Sales, and Gross Revenue.
    *   OSRM-integrated Area and Bar charts highlighting last 7-day revenue flow and peak orders by hour.
    *   Statistics breakdown mapping top-selling items and percentage status ratios.
*   **Payouts & Settings**:
    *   Submit and edit business profiles (logo uploads, opening/closing times, address).
    *   Track wallet balances, escrow release timers, and download CSV sales logs.

---

### 3. Delivery Riders
Riders handle pick-ups and deliveries using dynamic mapping tools.
*   **Delivery Status Toggle**:
    *   Set status to "Online" to join the delivery pool, or "Offline" to rest.
*   **Order Pool Discovery**:
    *   Browse available ready orders awaiting pickup across campus.
*   **Real-Time GPS Route Mapping**:
    *   View real-time OSRM driving routes from the rider's position to the vendor, and vendor to the customer.
    *   Integrates with Google Maps routing directions.
*   **GPS Simulator (Offline Testing)**:
    *   A continuous OSRM route simulator that drives the rider marker along campus roads.
    *   Features `localStorage` state persistence so that simulated routes **auto-resume** if the page refreshes or the browser tab goes to sleep.
*   **Delivery Proof Verification**:
    *   Take and upload photos of deliveries directly at the destination point to complete orders.
*   **Withdrawal System**:
    *   Submit wallet withdrawal requests directly to administrators.

---

### 4. Platform Administrators
Admins oversee system health, approvals, disputes, and commission splits.
*   **Onboarding approvals**: Review and verify newly registered vendor profiles before they are listed on the student store front.
*   **Disputes resolution**: Mediate support tickets and issue refunds for contested transactions.
*   **Escrow Ledgers**: Monitor escrow holds, verify release dates, and track global platform commissions.
*   **Withdrawals processing**: Review and process rider payouts.

---

## 💬 Shared Collaboration & Real-Time Engines

*   **Real-Time Chat Rooms**:
    *   Dedicated order-based chat rooms connecting Customers, Vendors, and Riders.
    *   Updates stream instantly via Supabase postgres changes channels.
*   **Audio Alerts Engine**:
    *   Audio alert manager that triggers alert sounds on the vendor dashboard when a new order is received, ensuring no order is missed.
*   **Real-Time Location Setter & Broadcaster**:
    *   Continuous GPS location setter (`LocationContext`) that updates real-time coordinates for active delivery riders.
    *   Streams live coordinates (`rider_lat`, `rider_lng`) to Supabase `orders` table via throttled background polling (~4s window).
    *   Renders interactive live Leaflet map routes on both Vendor dashboards (`VendorOrders.tsx`) and Customer tracking views (`StudentOrderTracking.tsx`) so all parties can visualize rider location live.
*   **Storage Upload Pipeline**:
    *   Integrated file upload handling for avatars, vendor logos, payment receipts, and delivery proof photos.
    *   Media is uploaded to Supabase Storage and served via public authenticated URLs.
*   **PWA Installability**:
    *   Configured with service workers via `vite-plugin-pwa` for offline asset caching.
    *   Includes a native installation prompt widget for installing Belly-Chow directly to the home screen of Android and iOS devices.

---

## 🛢️ Supabase Database Schema Directory

The application relies on a Postgres database with real-time replication:

*   `profiles`: Connects user IDs to metadata, phone numbers, avatars, and roles (`student`, `vendor`, `rider`, `admin`).
*   `vendors`: Business names, descriptions, addresses, hours, logo URLs, approval states, and bank details.
*   `menu_items`: Store food catalogs, descriptions, prices, categories, and availability indicators.
*   `orders`: Coordinates delivery status (`pending` ➔ `accepted` ➔ `preparing` ➔ `ready` ➔ `picked_up` ➔ `delivering` ➔ `delivered`), coordinates, rider assignments, total price, and comments.
*   `payment_transactions`: Logs references, transaction statuses, and payment methods.
*   `escrow_transactions`: Locks payouts for 24 hours before release, ensuring customer protection.
*   `withdrawal_requests`: Monitors rider payout requests.

---

## 💳 Checkout & Escrow Architecture
*   **KoraPay Service**: Integrated for secure card, transfer, and USSD payments.
*   **Webhook Endpoints**: Local Supabase Deno edge functions verify references and update ledgers.
*   **Escrow Ledger**: Automatically holds funds until delivery completes, then schedules vendor releases while splitting system commission cuts.

---

## ⚡ Advanced Dynamic & Logistics Systems (Smart Features)

*   **Smart Pricing & Dynamic Delivery Fees**:
    *   Delivery prices are calculated using the customer's real-time GPS distance from the merchant.
    *   Includes a demand multiplier that dynamically scales rates during busy hours (calculated by active order counts divided by online riders).
*   **Tiered Delivery Speeds**:
    *   Customers can select between **Standard Delivery** (base rate) and **Express Delivery** (priority dispatch).
*   **Flat Platform Commission**:
    *   Vendors are charged a flat commission rate of **₦100 per completed food delivery** directly deducted from the escrow payout ledger.
*   **Proximity-Based Dispatch (Closest Rider)**:
    *   Orders are offered to delivery riders using the **Haversine Proximity Algorithm** in PostgreSQL to locate the nearest active online rider.
*   **Merit-Based & Paid Featured Placement**:
    *   Vendors can purchase featured ad slots.
    *   An automated weekly merit algorithm compiles total weekly sales and user ratings to highlight the best performing merchant.
*   **Paystack Wallet & Transfer Integration**:
    *   Supports Paystack checkout and merchant wallets.
    *   Enables automated withdrawal transfers for riders and vendors.
*   **Rider Referral System**:
    *   Riders can share unique referral links to earn registration and completion bonuses.
