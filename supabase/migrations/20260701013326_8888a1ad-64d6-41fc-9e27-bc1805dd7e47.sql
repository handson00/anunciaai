
CREATE OR REPLACE FUNCTION public.stock_dashboard_kpis()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    -- Realized profit: only the portion already paid counts toward profit.
    'profit_today', COALESCE((SELECT SUM(profit * (CASE WHEN total > 0 THEN LEAST(amount_paid,total)/total ELSE 0 END)) FROM stock_sales WHERE sold_at::date = CURRENT_DATE), 0),
    'profit_7d',    COALESCE((SELECT SUM(profit * (CASE WHEN total > 0 THEN LEAST(amount_paid,total)/total ELSE 0 END)) FROM stock_sales WHERE sold_at >= now() - interval '7 days'), 0),
    'profit_30d',   COALESCE((SELECT SUM(profit * (CASE WHEN total > 0 THEN LEAST(amount_paid,total)/total ELSE 0 END)) FROM stock_sales WHERE sold_at >= now() - interval '30 days'), 0),
    'items_sold_30d', COALESCE((SELECT SUM(quantity) FROM stock_sales WHERE sold_at >= now() - interval '30 days'), 0),
    'receivable_total', COALESCE((SELECT SUM(GREATEST(total - COALESCE(amount_paid,0), 0)) FROM stock_sales WHERE payment_type = 'installment'), 0),
    'receivable_30d',   COALESCE((SELECT SUM(GREATEST(total - COALESCE(amount_paid,0), 0)) FROM stock_sales WHERE payment_type = 'installment' AND sold_at >= now() - interval '30 days'), 0),
    'low_stock_count', (SELECT COUNT(*) FROM stock_products WHERE active = true AND stock_qty <= min_stock),
    'series_30d', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('day', day, 'revenue', revenue, 'profit', profit) ORDER BY day)
      FROM (
        SELECT date_trunc('day', sold_at)::date AS day,
               SUM(total) AS revenue,
               SUM(profit * (CASE WHEN total > 0 THEN LEAST(amount_paid,total)/total ELSE 0 END)) AS profit
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
$function$;
