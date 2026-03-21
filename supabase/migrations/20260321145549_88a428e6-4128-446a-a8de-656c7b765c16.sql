
-- Create ad status enum
CREATE TYPE public.ad_status AS ENUM ('draft', 'ready', 'published', 'error');
-- Create ad category enum
CREATE TYPE public.ad_category AS ENUM ('automobile', 'product', 'property', 'service');
-- Create ad condition enum
CREATE TYPE public.ad_condition AS ENUM ('new', 'used');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  phone TEXT NOT NULL,
  name TEXT NOT NULL,
  is_admin BOOLEAN NOT NULL DEFAULT false,
  blocked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Create ads table
CREATE TABLE public.ads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  category public.ad_category NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  price NUMERIC(12,2) NOT NULL,
  condition public.ad_condition,
  brand TEXT,
  region TEXT,
  contact_phone TEXT NOT NULL,
  main_photo TEXT NOT NULL,
  photos TEXT[] DEFAULT '{}',
  slug TEXT NOT NULL UNIQUE,
  status public.ad_status NOT NULL DEFAULT 'draft',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.ads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view published ads" ON public.ads FOR SELECT USING (true);
CREATE POLICY "Users can insert own ads" ON public.ads FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own ads" ON public.ads FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own ads" ON public.ads FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Create community groups table
CREATE TABLE public.community_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  whatsapp_group_id TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.community_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view groups" ON public.community_groups FOR SELECT TO authenticated USING (true);

-- Admin-only policies for groups (using is_admin from profiles)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid() AND is_admin = true
  )
$$;

CREATE POLICY "Admins can insert groups" ON public.community_groups FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Admins can update groups" ON public.community_groups FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "Admins can delete groups" ON public.community_groups FOR DELETE TO authenticated USING (public.is_admin());

-- Admin policies for ads (admin can update/delete any ad)
CREATE POLICY "Admins can update any ad" ON public.ads FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "Admins can delete any ad" ON public.ads FOR DELETE TO authenticated USING (public.is_admin());

-- Admin policies for profiles (admin can update any profile - for blocking)
CREATE POLICY "Admins can update any profile" ON public.profiles FOR UPDATE TO authenticated USING (public.is_admin());

-- Create publication logs table
CREATE TABLE public.publication_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ad_id UUID REFERENCES public.ads(id) ON DELETE CASCADE NOT NULL,
  group_id UUID REFERENCES public.community_groups(id) ON DELETE CASCADE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  api_response JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.publication_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own publication logs" ON public.publication_logs FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ads WHERE ads.id = publication_logs.ad_id AND ads.user_id = auth.uid()));
CREATE POLICY "Admins can view all logs" ON public.publication_logs FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "System can insert logs" ON public.publication_logs FOR INSERT TO authenticated WITH CHECK (true);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_ads_updated_at BEFORE UPDATE ON public.ads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, phone, name)
  VALUES (
    NEW.id,
    COALESCE(NEW.phone, NEW.raw_user_meta_data->>'phone', ''),
    COALESCE(NEW.raw_user_meta_data->>'name', 'Usuário')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
