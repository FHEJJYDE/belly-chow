
-- Create role enum
CREATE TYPE public.app_role AS ENUM ('student', 'vendor', 'rider', 'admin');

-- Create order status enum
CREATE TYPE public.order_status AS ENUM ('pending', 'accepted', 'preparing', 'ready', 'picked_up', 'delivering', 'delivered', 'cancelled', 'rejected');

-- Create payment method enum
CREATE TYPE public.payment_method AS ENUM ('pay_on_delivery', 'bank_transfer');

-- Create payment status enum
CREATE TYPE public.payment_status AS ENUM ('pending', 'confirmed', 'failed');

-- Timestamp update function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT NOT NULL DEFAULT '',
  phone TEXT DEFAULT '',
  avatar_url TEXT DEFAULT '',
  campus_location TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- User roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Get user role function
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- Vendors table
CREATE TABLE public.vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  logo_url TEXT DEFAULT '',
  address TEXT DEFAULT '',
  opening_time TIME DEFAULT '08:00',
  closing_time TIME DEFAULT '22:00',
  is_active BOOLEAN DEFAULT false,
  is_approved BOOLEAN DEFAULT false,
  rating NUMERIC(2,1) DEFAULT 0,
  total_reviews INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_vendors_updated_at BEFORE UPDATE ON public.vendors
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Menu items table
CREATE TABLE public.menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID REFERENCES public.vendors(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  price NUMERIC(10,2) NOT NULL,
  image_url TEXT DEFAULT '',
  category TEXT NOT NULL DEFAULT 'General',
  is_available BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_menu_items_updated_at BEFORE UPDATE ON public.menu_items
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Orders table
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES auth.users(id) NOT NULL,
  vendor_id UUID REFERENCES public.vendors(id) NOT NULL,
  rider_id UUID REFERENCES auth.users(id),
  status order_status NOT NULL DEFAULT 'pending',
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  delivery_fee NUMERIC(10,2) NOT NULL DEFAULT 200,
  payment_method payment_method NOT NULL DEFAULT 'pay_on_delivery',
  payment_status payment_status NOT NULL DEFAULT 'pending',
  delivery_location TEXT NOT NULL DEFAULT '',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Order items table
CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  menu_item_id UUID REFERENCES public.menu_items(id) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  price NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Reviews table
CREATE TABLE public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  vendor_id UUID REFERENCES public.vendors(id),
  rider_id UUID REFERENCES auth.users(id),
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Platform settings table
CREATE TABLE public.platform_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_fee NUMERIC(10,2) NOT NULL DEFAULT 200,
  commission_rate NUMERIC(5,2) NOT NULL DEFAULT 10,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

INSERT INTO public.platform_settings (delivery_fee, commission_rate) VALUES (200, 10);

-- Trigger to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ RLS POLICIES ============

-- Profiles: users can read all profiles, update own
CREATE POLICY "Anyone can view profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- User roles: users can read own role, admins can manage
CREATE POLICY "Users can view own role" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own role" ON public.user_roles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Vendors: public read for approved, owners can manage
CREATE POLICY "Anyone can view approved vendors" ON public.vendors FOR SELECT USING (is_approved = true OR auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Vendor owners can insert" ON public.vendors FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Vendor owners can update" ON public.vendors FOR UPDATE USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- Menu items: public read for available, vendor owner can manage
CREATE POLICY "Anyone can view available menu items" ON public.menu_items FOR SELECT USING (true);
CREATE POLICY "Vendor owners can insert items" ON public.menu_items FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.vendors WHERE id = vendor_id AND user_id = auth.uid())
);
CREATE POLICY "Vendor owners can update items" ON public.menu_items FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.vendors WHERE id = vendor_id AND user_id = auth.uid())
);
CREATE POLICY "Vendor owners can delete items" ON public.menu_items FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.vendors WHERE id = vendor_id AND user_id = auth.uid())
);

-- Orders: students see own, vendors see theirs, riders see assigned, admin sees all
CREATE POLICY "Students can view own orders" ON public.orders FOR SELECT USING (
  auth.uid() = student_id OR
  EXISTS (SELECT 1 FROM public.vendors WHERE id = vendor_id AND user_id = auth.uid()) OR
  auth.uid() = rider_id OR
  public.has_role(auth.uid(), 'admin')
);
CREATE POLICY "Students can create orders" ON public.orders FOR INSERT WITH CHECK (auth.uid() = student_id);
CREATE POLICY "Authorized users can update orders" ON public.orders FOR UPDATE USING (
  auth.uid() = student_id OR
  EXISTS (SELECT 1 FROM public.vendors WHERE id = vendor_id AND user_id = auth.uid()) OR
  auth.uid() = rider_id OR
  public.has_role(auth.uid(), 'admin')
);

-- Order items: same access as orders
CREATE POLICY "Users can view order items" ON public.order_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.orders WHERE id = order_id AND (
    student_id = auth.uid() OR
    rider_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.vendors WHERE id = orders.vendor_id AND user_id = auth.uid()) OR
    public.has_role(auth.uid(), 'admin')
  ))
);
CREATE POLICY "Students can insert order items" ON public.order_items FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.orders WHERE id = order_id AND student_id = auth.uid())
);

-- Reviews
CREATE POLICY "Anyone can view reviews" ON public.reviews FOR SELECT USING (true);
CREATE POLICY "Users can create reviews" ON public.reviews FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Platform settings: public read, admin write
CREATE POLICY "Anyone can view settings" ON public.platform_settings FOR SELECT USING (true);
CREATE POLICY "Admins can update settings" ON public.platform_settings FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

-- Storage bucket for food images
INSERT INTO storage.buckets (id, name, public) VALUES ('food-images', 'food-images', true);
CREATE POLICY "Anyone can view food images" ON storage.objects FOR SELECT USING (bucket_id = 'food-images');
CREATE POLICY "Authenticated users can upload food images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'food-images' AND auth.role() = 'authenticated');
CREATE POLICY "Users can update own food images" ON storage.objects FOR UPDATE USING (bucket_id = 'food-images' AND auth.role() = 'authenticated');
