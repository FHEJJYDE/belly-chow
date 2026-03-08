-- Enable realtime on orders table for live tracking
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;