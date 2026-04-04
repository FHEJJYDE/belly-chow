# Belly-Chow 🍔

A modern campus food delivery platform built with React, TypeScript, and Supabase.

## 🚀 Features

### For Students
- Browse campus food vendors with ratings and reviews
- Real-time order tracking from placement to delivery
- Secure payment options (pay on delivery, bank transfer)
- Order history and favorites
- Push notifications for order updates

### For Vendors
- Comprehensive vendor dashboard
- Menu management with image uploads
- Real-time order notifications with audio alerts
- Order acceptance/rejection workflow
- Analytics and earnings tracking

### For Riders
- Available order notifications
- GPS tracking and delivery management
- Earnings and delivery history

### For Admins
- Complete platform management dashboard
- Vendor approval and verification system
- Order dispute resolution
- Payment and commission management
- User management and support tickets

## 🛠️ Tech Stack

- **Frontend:** React 18, TypeScript, Vite
- **UI:** Tailwind CSS, shadcn/ui, Radix UI
- **Backend:** Supabase (PostgreSQL + Auth + Realtime)
- **Maps:** Leaflet, React Leaflet
- **State Management:** React Query, React Context
- **PWA:** Vite PWA plugin for offline support

## 🏗️ Architecture

- **Real-time Features:** WebSocket subscriptions for live order updates
- **Role-based Access:** 4 user roles with comprehensive RLS policies
- **Mobile-first:** Progressive Web App with offline capabilities
- **Security:** Row-level security, JWT authentication
- **Scalable:** Modular component architecture

## 📦 Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/FHEJJYDE/belly-chow.git
   cd belly-chow
   ```

2. **Install dependencies:**
   ```bash
   npm install --legacy-peer-deps
   ```

3. **Set up environment variables:**
   ```bash
   cp .env.example .env
   ```
   Then edit `.env` with your Supabase credentials.

4. **Set up Supabase:**
   ```bash
   npx supabase login
   npx supabase link --project-ref YOUR_PROJECT_ID
   npx supabase db push
   ```

5. **Start the development server:**
   ```bash
   npm run dev
   ```

## 🔧 Environment Setup

### Supabase Configuration

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Go to Project Settings → API
3. Copy your project URL and anon public key
4. Update your `.env` file with these values

### Database Schema

The project includes 28 database migrations that set up:
- User profiles and role management
- Vendor accounts with approval workflow
- Menu items with categories and images
- Order management with status tracking
- Payment processing
- Reviews and ratings system
- Platform settings and commission management

## 🚀 Deployment

### Build for Production
```bash
npm run build
```

### Preview Production Build
```bash
npm run preview
```

## 📱 PWA Features

- **Installable:** Can be installed on mobile devices
- **Offline Support:** Service worker for offline functionality
- **Push Notifications:** Real-time order updates
- **Responsive Design:** Mobile-first approach

## 🔐 Security Features

- **Row-Level Security (RLS):** Database-level access control
- **JWT Authentication:** Secure user sessions
- **Role-based Permissions:** Granular access control
- **Input Validation:** Zod schema validation
- **Secure File Uploads:** Supabase Storage integration

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with [Supabase](https://supabase.com) for backend services
- UI components from [shadcn/ui](https://ui.shadcn.com)
- Icons from [Lucide React](https://lucide.dev)
- Maps powered by [Leaflet](https://leafletjs.com)

---

**Belly-Chow** - Bringing campus food delivery into the modern age 🚀