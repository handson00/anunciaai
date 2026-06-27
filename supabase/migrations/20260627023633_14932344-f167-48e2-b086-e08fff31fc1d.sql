
-- 1. Add can_manage_stock to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS can_manage_stock boolean NOT NULL DEFAULT false;

-- Seed the master admin (Handson)
UPDATE public.profiles SET can_manage_stock = true WHERE user_id = 'f518168d-3511-4c21-998c-7658943eabd5';

-- 2. Security definer function
CREATE OR REPLACE FUNCTION public.can_manage_stock()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid() AND can_manage_stock = true
  );
$$;

REVOKE ALL ON FUNCTION public.can_manage_stock() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_manage_stock() TO authenticated, service_role;

-- 3. stock_products
CREATE TABLE public.stock_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  sku text,
  photo_url text,
  category text,
  cost_price numeric(12,2) NOT NULL DEFAULT 0,
  sale_price numeric(12,2) NOT NULL DEFAULT 0,
  stock_qty integer NOT NULL DEFAULT 0,
  min_stock integer NOT NULL DEFAULT 0,
  ad_id uuid REFERENCES public.ads(id) ON DELETE SET NULL,
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_products TO authenticated;
GRANT ALL ON public.stock_products TO service_role;

ALTER TABLE public.stock_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stock managers manage products" ON public.stock_products
  FOR ALL TO authenticated
  USING (public.can_manage_stock())
  WITH CHECK (public.can_manage_stock());

CREATE TRIGGER stock_products_set_updated_at
  BEFORE UPDATE ON public.stock_products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_stock_products_active ON public.stock_products(active);

-- 4. stock_sales
CREATE TABLE public.stock_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.stock_products(id) ON DELETE RESTRICT,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price numeric(12,2) NOT NULL CHECK (unit_price >= 0),
  unit_cost numeric(12,2) NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
  total numeric(12,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  profit numeric(12,2) GENERATED ALWAYS AS (quantity * (unit_price - unit_cost)) STORED,
  customer_name text,
  note text,
  sold_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_sales TO authenticated;
GRANT ALL ON public.stock_sales TO service_role;

ALTER TABLE public.stock_sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stock managers manage sales" ON public.stock_sales
  FOR ALL TO authenticated
  USING (public.can_manage_stock())
  WITH CHECK (public.can_manage_stock());

CREATE INDEX idx_stock_sales_sold_at ON public.stock_sales(sold_at DESC);
CREATE INDEX idx_stock_sales_product ON public.stock_sales(product_id);

-- 5. stock_movements
CREATE TABLE public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.stock_products(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('in','out','adjust','sale','sale_reverse')),
  quantity integer NOT NULL,
  note text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_movements TO authenticated;
GRANT ALL ON public.stock_movements TO service_role;

ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stock managers manage movements" ON public.stock_movements
  FOR ALL TO authenticated
  USING (public.can_manage_stock())
  WITH CHECK (public.can_manage_stock());

CREATE INDEX idx_stock_movements_product ON public.stock_movements(product_id, created_at DESC);

-- 6. Triggers: adjust stock on sale insert/delete
CREATE OR REPLACE FUNCTION public.handle_stock_sale()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  current_qty integer;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT stock_qty INTO current_qty FROM public.stock_products WHERE id = NEW.product_id FOR UPDATE;
    IF current_qty IS NULL THEN
      RAISE EXCEPTION 'Produto não encontrado';
    END IF;
    IF current_qty < NEW.quantity THEN
      RAISE EXCEPTION 'Estoque insuficiente (disponível: %)', current_qty;
    END IF;
    UPDATE public.stock_products SET stock_qty = stock_qty - NEW.quantity, updated_at = now() WHERE id = NEW.product_id;
    INSERT INTO public.stock_movements(product_id, type, quantity, note, created_by)
      VALUES (NEW.product_id, 'sale', -NEW.quantity, 'Venda #'||NEW.id, NEW.created_by);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.stock_products SET stock_qty = stock_qty + OLD.quantity, updated_at = now() WHERE id = OLD.product_id;
    INSERT INTO public.stock_movements(product_id, type, quantity, note, created_by)
      VALUES (OLD.product_id, 'sale_reverse', OLD.quantity, 'Reversão venda #'||OLD.id, OLD.created_by);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER stock_sales_apply
  AFTER INSERT OR DELETE ON public.stock_sales
  FOR EACH ROW EXECUTE FUNCTION public.handle_stock_sale();

-- 7. KPIs RPC
CREATE OR REPLACE FUNCTION public.stock_dashboard_kpis()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  IF NOT public.can_manage_stock() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  SELECT jsonb_build_object(
    'revenue_today', COALESCE((SELECT SUM(total) FROM stock_sales WHERE sold_at::date = CURRENT_DATE), 0),
    'revenue_7d',   COALESCE((SELECT SUM(total) FROM stock_sales WHERE sold_at >= now() - interval '7 days'), 0),
    'revenue_30d',  COALESCE((SELECT SUM(total) FROM stock_sales WHERE sold_at >= now() - interval '30 days'), 0),
    'profit_today', COALESCE((SELECT SUM(profit) FROM stock_sales WHERE sold_at::date = CURRENT_DATE), 0),
    'profit_7d',    COALESCE((SELECT SUM(profit) FROM stock_sales WHERE sold_at >= now() - interval '7 days'), 0),
    'profit_30d',   COALESCE((SELECT SUM(profit) FROM stock_sales WHERE sold_at >= now() - interval '30 days'), 0),
    'items_sold_30d', COALESCE((SELECT SUM(quantity) FROM stock_sales WHERE sold_at >= now() - interval '30 days'), 0),
    'low_stock_count', (SELECT COUNT(*) FROM stock_products WHERE active = true AND stock_qty <= min_stock),
    'series_30d', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('day', day, 'revenue', revenue, 'profit', profit) ORDER BY day)
      FROM (
        SELECT date_trunc('day', sold_at)::date AS day,
               SUM(total) AS revenue,
               SUM(profit) AS profit
        FROM stock_sales
        WHERE sold_at >= now() - interval '30 days'
        GROUP BY 1
      ) d
    ), '[]'::jsonb),
    'top_products_30d', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('product_id', product_id, 'name', name, 'qty', qty, 'revenue', revenue) ORDER BY qty DESC)
      FROM (
        SELECT s.product_id, p.name, SUM(s.quantity) AS qty, SUM(s.total) AS revenue
        FROM stock_sales s JOIN stock_products p ON p.id = s.product_id
        WHERE s.sold_at >= now() - interval '30 days'
        GROUP BY s.product_id, p.name
        ORDER BY qty DESC
        LIMIT 5
      ) t
    ), '[]'::jsonb),
    'low_stock_items', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', id, 'name', name, 'stock_qty', stock_qty, 'min_stock', min_stock) ORDER BY stock_qty)
      FROM stock_products WHERE active = true AND stock_qty <= min_stock LIMIT 20
    ), '[]'::jsonb)
  ) INTO result;
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.stock_dashboard_kpis() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.stock_dashboard_kpis() TO authenticated, service_role;

-- 8. Helper for permissions tab: list admins (only for can_manage_stock users)
CREATE OR REPLACE FUNCTION public.list_admin_users()
RETURNS TABLE(user_id uuid, name text, can_manage_stock boolean, is_admin boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.can_manage_stock() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY
  SELECT p.user_id, p.name, p.can_manage_stock, p.is_admin
  FROM public.profiles p
  WHERE p.is_admin = true
  ORDER BY p.name;
END;
$$;

REVOKE ALL ON FUNCTION public.list_admin_users() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_admin_users() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.set_stock_permission(_target_user uuid, _can boolean)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.can_manage_stock() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  UPDATE public.profiles SET can_manage_stock = _can WHERE user_id = _target_user AND is_admin = true;
END;
$$;

REVOKE ALL ON FUNCTION public.set_stock_permission(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_stock_permission(uuid, boolean) TO authenticated, service_role;
