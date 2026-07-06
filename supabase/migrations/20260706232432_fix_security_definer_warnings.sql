-- Fix Supabase warnings: "Public Can Execute SECURITY DEFINER Function" and "Signed-In Users Can Execute SECURITY DEFINER Function"

-- 1. has_role function
-- Revoke execution from PUBLIC (anon). Authenticated role still has access, 
-- but this restricts unauthorized anonymous calls.
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM anon;
-- We leave authenticated intact because this function is necessary for RLS to evaluate whether the logged-in user is an admin.

-- 2. handle_new_user function
-- This function is executed by a database trigger (when auth.users receives an INSERT), 
-- it does not need to be executed by authenticated or anonymous users directly.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
