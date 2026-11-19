-- ==============================================================================
-- 📍 BELLY-CHOW: CAMPUS LOCATION & PICKUP INTELLIGENCE UPGRADE (NO MOCK DATA)
-- ==============================================================================
-- Run this standalone script in your Supabase SQL Editor to upgrade
-- campus_locations, delivery_zones management, student-contributed slang aliases,
-- profiles saved places, orders micro-dropoff fields, and 10k-user indexes.
-- ==============================================================================

-- 1. Unify & Extend campus_locations schema (No hardcoded mock locations)
CREATE TABLE IF NOT EXISTS public.campus_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL DEFAULT 'Hostel',
  description TEXT DEFAULT '',
  short_code TEXT DEFAULT NULL,
  aliases TEXT[] DEFAULT '{}',
  zone_name VARCHAR(100) DEFAULT NULL,
  delivery_fee NUMERIC NOT NULL DEFAULT 500,
  estimated_delivery_mins INTEGER DEFAULT 15,
  dropoff_points TEXT[] DEFAULT ARRAY['Main Gate / Porter''s Lodge', 'Main Entrance'],
  is_popular BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  lat NUMERIC DEFAULT NULL,
  lng NUMERIC DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.campus_locations ADD COLUMN IF NOT EXISTS short_code TEXT DEFAULT NULL;
ALTER TABLE public.campus_locations ADD COLUMN IF NOT EXISTS aliases TEXT[] DEFAULT '{}';
ALTER TABLE public.campus_locations ADD COLUMN IF NOT EXISTS zone_name VARCHAR(100) DEFAULT NULL;
ALTER TABLE public.campus_locations ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC NOT NULL DEFAULT 500;
ALTER TABLE public.campus_locations ADD COLUMN IF NOT EXISTS estimated_delivery_mins INTEGER DEFAULT 15;
ALTER TABLE public.campus_locations ADD COLUMN IF NOT EXISTS dropoff_points TEXT[] DEFAULT ARRAY['Main Gate / Porter''s Lodge', 'Main Entrance'];
ALTER TABLE public.campus_locations ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;
ALTER TABLE public.campus_locations ADD COLUMN IF NOT EXISTS lat NUMERIC DEFAULT NULL;
ALTER TABLE public.campus_locations ADD COLUMN IF NOT EXISTS lng NUMERIC DEFAULT NULL;

-- Ensure unique constraint on name
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'campus_locations_name_key'
  ) THEN
    DELETE FROM public.campus_locations a
    USING public.campus_locations b
    WHERE a.id > b.id AND a.name = b.name;

    ALTER TABLE public.campus_locations ADD CONSTRAINT campus_locations_name_key UNIQUE (name);
  END IF;
END $$;

-- 2. Add Saved Places (My Hostel, My Dept, Study Spot) to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS saved_locations JSONB DEFAULT '[]'::jsonb;

-- 3. Add Micro-Dropoff & Delivery Instructions to orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS dropoff_point TEXT DEFAULT NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS room_number TEXT DEFAULT NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_instruction TEXT DEFAULT NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS discount_amount NUMERIC DEFAULT 0;

-- 3b. Align promo_codes columns with AdminPromoCodes & Cart checkout
ALTER TABLE public.promo_codes ADD COLUMN IF NOT EXISTS discount_amount NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE public.promo_codes ADD COLUMN IF NOT EXISTS min_order NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE public.promo_codes ADD COLUMN IF NOT EXISTS used_count INTEGER NOT NULL DEFAULT 0;

-- 4. RPC: Allow authenticated students to contribute a slang / nickname to any campus location
-- Safely validates length, prevents duplicates, and caps aliases per location.
CREATE OR REPLACE FUNCTION public.add_location_slang(
  p_location_id UUID,
  p_slang TEXT
)
RETURNS TEXT[] AS $$
DECLARE
  v_clean TEXT;
  v_existing TEXT[];
  v_updated TEXT[];
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'You must be logged in to add a campus slang or nickname';
  END IF;

  v_clean := TRIM(REGEXP_REPLACE(p_slang, '\s+', ' ', 'g'));

  IF LENGTH(v_clean) < 2 OR LENGTH(v_clean) > 30 THEN
    RAISE EXCEPTION 'Campus slang must be between 2 and 30 characters';
  END IF;

  SELECT COALESCE(aliases, '{}') INTO v_existing
  FROM public.campus_locations
  WHERE id = p_location_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Campus location not found';
  END IF;

  -- Check if slang already exists (case-insensitive)
  IF EXISTS (
    SELECT 1 FROM unnest(v_existing) AS elem
    WHERE LOWER(elem) = LOWER(v_clean)
  ) THEN
    RETURN v_existing;
  END IF;

  IF COALESCE(array_length(v_existing, 1), 0) >= 25 THEN
    RAISE EXCEPTION 'Maximum number of slang tags reached for this location';
  END IF;

  UPDATE public.campus_locations
  SET aliases = array_append(COALESCE(aliases, '{}'), v_clean),
      updated_at = NOW()
  WHERE id = p_location_id
  RETURNING aliases INTO v_updated;

  RETURN v_updated;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. High-Concurrency Indexes for 10,000+ Campus Users & Fast Page Loads
CREATE INDEX IF NOT EXISTS idx_campus_locations_active_popular
  ON public.campus_locations (is_active, is_popular DESC, display_order ASC);

CREATE INDEX IF NOT EXISTS idx_campus_locations_category
  ON public.campus_locations (category) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_orders_active_rider_tracking
  ON public.orders (rider_id, status)
  WHERE status IN ('accepted', 'preparing', 'ready', 'picked_up', 'delivering', 'arrived');

CREATE INDEX IF NOT EXISTS idx_orders_active_student_tracking
  ON public.orders (student_id, status)
  WHERE status IN ('pending', 'accepted', 'preparing', 'ready', 'picked_up', 'delivering', 'arrived');

CREATE INDEX IF NOT EXISTS idx_orders_vendor_created
  ON public.orders (vendor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_student_created
  ON public.orders (student_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id
  ON public.order_items (order_id);

CREATE INDEX IF NOT EXISTS idx_menu_items_vendor_available
  ON public.menu_items (vendor_id, is_available);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications (user_id, is_read, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_vendors_approved
  ON public.vendors (is_approved, is_active);

CREATE INDEX IF NOT EXISTS idx_messages_order_created
  ON public.messages (order_id, created_at ASC);

-- 6. Enable Realtime Replication & Complete Missing RLS Policies for Chat, Notifications, Reviews, Support & Ledger
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.wallets;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;

-- Messages Policies (Select, Insert, Delete)
DROP POLICY IF EXISTS "Order participants can view messages" ON public.messages;
CREATE POLICY "Order participants can view messages" ON public.messages FOR SELECT TO authenticated USING (
  auth.uid() = sender_id
  OR EXISTS (
    SELECT 1 FROM public.orders
    WHERE orders.id = messages.order_id
      AND (
        orders.student_id = auth.uid()
        OR orders.rider_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.vendors WHERE vendors.id = orders.vendor_id AND vendors.user_id = auth.uid())
      )
  )
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

DROP POLICY IF EXISTS "Order participants can send messages" ON public.messages;
CREATE POLICY "Order participants can send messages" ON public.messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "Senders can delete own messages" ON public.messages;
CREATE POLICY "Senders can delete own messages" ON public.messages FOR DELETE TO authenticated USING (auth.uid() = sender_id);

-- Notifications Policies
DROP POLICY IF EXISTS "Users view own notifications" ON public.notifications;
CREATE POLICY "Users view own notifications" ON public.notifications FOR SELECT TO authenticated USING (
  auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

DROP POLICY IF EXISTS "Authenticated users create notifications" ON public.notifications;
CREATE POLICY "Authenticated users create notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Users update own notifications" ON public.notifications;
CREATE POLICY "Users update own notifications" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Push Subscriptions Policies
DROP POLICY IF EXISTS "Users manage own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users manage own push subscriptions" ON public.push_subscriptions FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Reviews Policies
DROP POLICY IF EXISTS "Reviews viewable by everyone" ON public.reviews;
CREATE POLICY "Reviews viewable by everyone" ON public.reviews FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users create reviews" ON public.reviews;
CREATE POLICY "Authenticated users create reviews" ON public.reviews FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Support Tickets Policies
DROP POLICY IF EXISTS "Users view own support tickets" ON public.support_tickets;
CREATE POLICY "Users view own support tickets" ON public.support_tickets FOR SELECT TO authenticated USING (
  auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

DROP POLICY IF EXISTS "Users create own support tickets" ON public.support_tickets;
CREATE POLICY "Users create own support tickets" ON public.support_tickets FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins update support tickets" ON public.support_tickets;
CREATE POLICY "Admins update support tickets" ON public.support_tickets FOR UPDATE TO authenticated USING (
  auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- Payment, Escrow, Refund & Payout Policies
DROP POLICY IF EXISTS "Participants view payment transactions" ON public.payment_transactions;
CREATE POLICY "Participants view payment transactions" ON public.payment_transactions FOR SELECT TO authenticated USING (
  auth.uid() = user_id
  OR EXISTS (SELECT 1 FROM public.vendors WHERE vendors.id = payment_transactions.vendor_id AND vendors.user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

DROP POLICY IF EXISTS "Participants insert payment transactions" ON public.payment_transactions;
CREATE POLICY "Participants insert payment transactions" ON public.payment_transactions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Participants update payment transactions" ON public.payment_transactions;
CREATE POLICY "Participants update payment transactions" ON public.payment_transactions FOR UPDATE TO authenticated USING (
  auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

DROP POLICY IF EXISTS "Participants view escrow transactions" ON public.escrow_transactions;
CREATE POLICY "Participants view escrow transactions" ON public.escrow_transactions FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.vendors WHERE vendors.id = escrow_transactions.vendor_id AND vendors.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.orders WHERE orders.id = escrow_transactions.order_id AND orders.student_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

DROP POLICY IF EXISTS "Authenticated insert escrow transactions" ON public.escrow_transactions;
CREATE POLICY "Authenticated insert escrow transactions" ON public.escrow_transactions FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Participants update escrow transactions" ON public.escrow_transactions;
CREATE POLICY "Participants update escrow transactions" ON public.escrow_transactions FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "Participants view refund transactions" ON public.refund_transactions;
CREATE POLICY "Participants view refund transactions" ON public.refund_transactions FOR SELECT TO authenticated USING (
  auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

DROP POLICY IF EXISTS "Admins and users manage refund transactions" ON public.refund_transactions;
CREATE POLICY "Admins and users manage refund transactions" ON public.refund_transactions FOR ALL TO authenticated USING (
  auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

DROP POLICY IF EXISTS "Vendors and admins view vendor payouts" ON public.vendor_payouts;
CREATE POLICY "Vendors and admins view vendor payouts" ON public.vendor_payouts FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.vendors WHERE vendors.id = vendor_payouts.vendor_id AND vendors.user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

DROP POLICY IF EXISTS "Vendors and admins manage vendor payouts" ON public.vendor_payouts;
CREATE POLICY "Vendors and admins manage vendor payouts" ON public.vendor_payouts FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.vendors WHERE vendors.id = vendor_payouts.vendor_id AND vendors.user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

DROP POLICY IF EXISTS "Admins manage withdrawal requests" ON public.withdrawal_requests;
CREATE POLICY "Admins manage withdrawal requests" ON public.withdrawal_requests FOR UPDATE TO authenticated USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
);

DROP POLICY IF EXISTS "Admins manage drinks" ON public.drinks;
CREATE POLICY "Admins manage drinks" ON public.drinks FOR ALL TO authenticated USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
);

DROP POLICY IF EXISTS "Admins manage promo codes" ON public.promo_codes;
CREATE POLICY "Admins manage promo codes" ON public.promo_codes FOR ALL TO authenticated USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
);

DROP POLICY IF EXISTS "Admins manage platform settings" ON public.platform_settings;
CREATE POLICY "Admins manage platform settings" ON public.platform_settings FOR ALL TO authenticated USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
);

DROP POLICY IF EXISTS "Admins update disputes" ON public.disputes;
CREATE POLICY "Admins update disputes" ON public.disputes FOR UPDATE TO authenticated USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- Admin profile & wallet management policies
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
CREATE POLICY "Admins can update any profile" ON public.profiles FOR UPDATE TO authenticated USING (
  auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

DROP POLICY IF EXISTS "Admins can update wallets" ON public.wallets;
CREATE POLICY "Admins can update wallets" ON public.wallets FOR UPDATE TO authenticated USING (
  auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- Storage Bucket & Automatic Vendor Rating Trigger
INSERT INTO storage.buckets (id, name, public) VALUES ('food-images', 'food-images', true) ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.update_vendor_rating_from_reviews()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.vendor_id IS NOT NULL THEN
    UPDATE public.vendors
    SET rating = COALESCE((SELECT ROUND(AVG(rating)::numeric, 1) FROM public.reviews WHERE vendor_id = NEW.vendor_id), 0),
        total_reviews = (SELECT COUNT(*) FROM public.reviews WHERE vendor_id = NEW.vendor_id)
    WHERE id = NEW.vendor_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_update_vendor_rating ON public.reviews;
CREATE TRIGGER trg_update_vendor_rating
AFTER INSERT OR UPDATE OR DELETE ON public.reviews
FOR EACH ROW EXECUTE FUNCTION public.update_vendor_rating_from_reviews();

CREATE INDEX IF NOT EXISTS idx_messages_order_created
  ON public.messages (order_id, created_at ASC);

-- 6. Enable Realtime Replication & Complete Missing RLS Policies for Chat, Notifications, Reviews, Support & Ledger
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.wallets;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;

-- Messages Policies (Select, Insert, Delete)
DROP POLICY IF EXISTS "Order participants can view messages" ON public.messages;
CREATE POLICY "Order participants can view messages" ON public.messages FOR SELECT TO authenticated USING (
  auth.uid() = sender_id
  OR EXISTS (
    SELECT 1 FROM public.orders
    WHERE orders.id = messages.order_id
      AND (
        orders.student_id = auth.uid()
        OR orders.rider_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.vendors WHERE vendors.id = orders.vendor_id AND vendors.user_id = auth.uid())
      )
  )
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

DROP POLICY IF EXISTS "Order participants can send messages" ON public.messages;
CREATE POLICY "Order participants can send messages" ON public.messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "Senders can delete own messages" ON public.messages;
CREATE POLICY "Senders can delete own messages" ON public.messages FOR DELETE TO authenticated USING (auth.uid() = sender_id);

-- Notifications Policies
DROP POLICY IF EXISTS "Users view own notifications" ON public.notifications;
CREATE POLICY "Users view own notifications" ON public.notifications FOR SELECT TO authenticated USING (
  auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

DROP POLICY IF EXISTS "Authenticated users create notifications" ON public.notifications;
CREATE POLICY "Authenticated users create notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Users update own notifications" ON public.notifications;
CREATE POLICY "Users update own notifications" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Push Subscriptions Policies
DROP POLICY IF EXISTS "Users manage own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users manage own push subscriptions" ON public.push_subscriptions FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Reviews Policies
DROP POLICY IF EXISTS "Reviews viewable by everyone" ON public.reviews;
CREATE POLICY "Reviews viewable by everyone" ON public.reviews FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users create reviews" ON public.reviews;
CREATE POLICY "Authenticated users create reviews" ON public.reviews FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Support Tickets Policies
DROP POLICY IF EXISTS "Users view own support tickets" ON public.support_tickets;
CREATE POLICY "Users view own support tickets" ON public.support_tickets FOR SELECT TO authenticated USING (
  auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

DROP POLICY IF EXISTS "Users create own support tickets" ON public.support_tickets;
CREATE POLICY "Users create own support tickets" ON public.support_tickets FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins update support tickets" ON public.support_tickets;
CREATE POLICY "Admins update support tickets" ON public.support_tickets FOR UPDATE TO authenticated USING (
  auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- Payment, Escrow, Refund & Payout Policies
DROP POLICY IF EXISTS "Participants view payment transactions" ON public.payment_transactions;
CREATE POLICY "Participants view payment transactions" ON public.payment_transactions FOR SELECT TO authenticated USING (
  auth.uid() = user_id
  OR EXISTS (SELECT 1 FROM public.vendors WHERE vendors.id = payment_transactions.vendor_id AND vendors.user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

DROP POLICY IF EXISTS "Participants insert payment transactions" ON public.payment_transactions;
CREATE POLICY "Participants insert payment transactions" ON public.payment_transactions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Participants update payment transactions" ON public.payment_transactions;
CREATE POLICY "Participants update payment transactions" ON public.payment_transactions FOR UPDATE TO authenticated USING (
  auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

DROP POLICY IF EXISTS "Participants view escrow transactions" ON public.escrow_transactions;
CREATE POLICY "Participants view escrow transactions" ON public.escrow_transactions FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.vendors WHERE vendors.id = escrow_transactions.vendor_id AND vendors.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.orders WHERE orders.id = escrow_transactions.order_id AND orders.student_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

DROP POLICY IF EXISTS "Authenticated insert escrow transactions" ON public.escrow_transactions;
CREATE POLICY "Authenticated insert escrow transactions" ON public.escrow_transactions FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Participants update escrow transactions" ON public.escrow_transactions;
CREATE POLICY "Participants update escrow transactions" ON public.escrow_transactions FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "Participants view refund transactions" ON public.refund_transactions;
CREATE POLICY "Participants view refund transactions" ON public.refund_transactions FOR SELECT TO authenticated USING (
  auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

DROP POLICY IF EXISTS "Admins and users manage refund transactions" ON public.refund_transactions;
CREATE POLICY "Admins and users manage refund transactions" ON public.refund_transactions FOR ALL TO authenticated USING (
  auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

DROP POLICY IF EXISTS "Vendors and admins view vendor payouts" ON public.vendor_payouts;
CREATE POLICY "Vendors and admins view vendor payouts" ON public.vendor_payouts FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.vendors WHERE vendors.id = vendor_payouts.vendor_id AND vendors.user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

DROP POLICY IF EXISTS "Vendors and admins manage vendor payouts" ON public.vendor_payouts;
CREATE POLICY "Vendors and admins manage vendor payouts" ON public.vendor_payouts FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.vendors WHERE vendors.id = vendor_payouts.vendor_id AND vendors.user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

DROP POLICY IF EXISTS "Admins manage withdrawal requests" ON public.withdrawal_requests;
CREATE POLICY "Admins manage withdrawal requests" ON public.withdrawal_requests FOR UPDATE TO authenticated USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
);

DROP POLICY IF EXISTS "Admins manage drinks" ON public.drinks;
CREATE POLICY "Admins manage drinks" ON public.drinks FOR ALL TO authenticated USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
);

DROP POLICY IF EXISTS "Admins manage promo codes" ON public.promo_codes;
CREATE POLICY "Admins manage promo codes" ON public.promo_codes FOR ALL TO authenticated USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
);

DROP POLICY IF EXISTS "Admins manage platform settings" ON public.platform_settings;
CREATE POLICY "Admins manage platform settings" ON public.platform_settings FOR ALL TO authenticated USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
);

DROP POLICY IF EXISTS "Admins update disputes" ON public.disputes;
CREATE POLICY "Admins update disputes" ON public.disputes FOR UPDATE TO authenticated USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- Storage Bucket & Automatic Vendor Rating Trigger
INSERT INTO storage.buckets (id, name, public) VALUES ('food-images', 'food-images', true) ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.update_vendor_rating_from_reviews()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.vendor_id IS NOT NULL THEN
    UPDATE public.vendors
    SET rating = COALESCE((SELECT ROUND(AVG(rating)::numeric, 1) FROM public.reviews WHERE vendor_id = NEW.vendor_id), 0),
        total_reviews = (SELECT COUNT(*) FROM public.reviews WHERE vendor_id = NEW.vendor_id)
    WHERE id = NEW.vendor_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_update_vendor_rating ON public.reviews;
CREATE TRIGGER trg_update_vendor_rating
AFTER INSERT OR UPDATE OR DELETE ON public.reviews
FOR EACH ROW EXECUTE FUNCTION public.update_vendor_rating_from_reviews();
