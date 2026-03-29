-- Fix 1: Restrict public ads SELECT to only published ads
DROP POLICY "Anyone can view published ads" ON public.ads;
CREATE POLICY "Anyone can view published ads"
ON public.ads FOR SELECT TO public
USING (status = 'published');

-- Authenticated users can also see their own ads regardless of status
CREATE POLICY "Users can view own ads"
ON public.ads FOR SELECT TO authenticated
USING (auth.uid() = user_id);

-- Admins can see all ads
CREATE POLICY "Admins can view all ads"
ON public.ads FOR SELECT TO authenticated
USING (is_admin());

-- Fix 2: Add RLS policies for recovery_codes (deny all direct access)
CREATE POLICY "Deny all access to recovery_codes"
ON public.recovery_codes FOR ALL TO public
USING (false)
WITH CHECK (false);

-- Fix 3: Prevent privilege escalation - drop and recreate user update policy with WITH CHECK
DROP POLICY "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id AND is_admin = false AND blocked = false);

-- Fix 4: Restrict profile visibility - users can only see own profile, admins see all
DROP POLICY "Users can view all profiles" ON public.profiles;
CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT TO authenticated
USING (is_admin());