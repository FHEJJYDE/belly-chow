-- Set replica identity FULL on orders so payload.old contains all columns
ALTER TABLE public.orders REPLICA IDENTITY FULL;

-- Allow message senders to delete their own messages
CREATE POLICY "Users can delete own messages"
ON public.messages
FOR DELETE
USING (auth.uid() = sender_id);