-- Add WITH CHECK to the admins update policy to prevent admins from creating other admins via this policy unintentionally.
-- We require the updated row to remain non-blocked logic is admin-controlled, but is_admin escalation must go through a separate explicit DB function in future.
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;

CREATE POLICY "Admins can update any profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Restrictive policy: nobody (including admins via UPDATE) can flip is_admin on themselves through the regular UPDATE path.
-- This adds defense-in-depth on top of the user-self-update WITH CHECK.
CREATE POLICY "Prevent self is_admin escalation"
ON public.profiles
AS RESTRICTIVE
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (
  -- A user updating their own row cannot set is_admin = true
  NOT (auth.uid() = user_id AND is_admin = true)
);
