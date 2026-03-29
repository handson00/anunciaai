-- Fix: Prevent privilege escalation on INSERT - enforce is_admin = false
DROP POLICY "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
ON public.profiles FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND is_admin = false AND blocked = false);

-- Fix: Restrict community_groups SELECT to admins only
DROP POLICY "Authenticated users can view groups" ON public.community_groups;
CREATE POLICY "Admins can view groups"
ON public.community_groups FOR SELECT TO authenticated
USING (is_admin());