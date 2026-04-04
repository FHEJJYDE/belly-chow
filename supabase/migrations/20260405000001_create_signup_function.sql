-- Create a secure function to handle user signup with role assignment
-- This function runs with elevated privileges to bypass RLS during signup

CREATE OR REPLACE FUNCTION public.handle_user_signup(
  user_id UUID,
  user_role app_role,
  vendor_name TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert the user role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (user_id, user_role);
  
  -- If the role is vendor and vendor_name is provided, create vendor record
  IF user_role = 'vendor' AND vendor_name IS NOT NULL THEN
    INSERT INTO public.vendors (user_id, name)
    VALUES (user_id, vendor_name);
  END IF;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.handle_user_signup TO authenticated;