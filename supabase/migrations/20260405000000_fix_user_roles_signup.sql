-- Fix user_roles RLS policy to allow signup
-- The issue is that during signup, the user might not be fully authenticated when inserting the role

-- Drop the existing restrictive INSERT policy
DROP POLICY IF EXISTS "Users can insert own role" ON public.user_roles;

-- Create a more permissive INSERT policy that allows authenticated users to insert their own role
-- This handles the case where auth.uid() might be available but the session isn't fully established
CREATE POLICY "Users can insert own role during signup" ON public.user_roles 
FOR INSERT 
WITH CHECK (
  -- Allow if the user_id matches the authenticated user
  auth.uid() = user_id 
  OR 
  -- Allow if this is during signup (user exists in auth.users but no role exists yet)
  (
    EXISTS (SELECT 1 FROM auth.users WHERE id = user_id) 
    AND NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = user_roles.user_id)
  )
);