import { supabase } from '@/integrations/supabase/client';

export interface StockProduct {
  id: string;
  name: string;
  sku: string | null;
  photo_url: string | null;
  category: string | null;
  cost_price: number;
  sale_price: number;
  stock_qty: number;
  min_stock: number;
  ad_id: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface StockSale {
  id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  unit_cost: number;
  total: number;
  profit: number;
  customer_name: string | null;
  note: string | null;
  sold_at: string;
  payment_type: 'cash' | 'installment';
  installments_total: number;
  amount_paid: number;
  // joined
  product_name?: string;
}

export interface SalePayment {
  id: string;
  sale_id: string;
  amount: number;
  paid_at: string;
  note: string | null;
}

export async function listSalePayments(saleId: string): Promise<SalePayment[]> {
  const { data, error } = await (supabase as any)
    .from('stock_sale_payments')
    .select('*')
    .eq('sale_id', saleId)
    .order('paid_at', { ascending: true });
  if (error) { console.error(error); return []; }
  return (data || []) as SalePayment[];
}

export interface DashboardKpis {
  revenue_today: number;
  revenue_7d: number;
  revenue_30d: number;
  profit_today: number;
  profit_7d: number;
  profit_30d: number;
  items_sold_30d: number;
  low_stock_count: number;
  series_30d: { day: string; revenue: number; profit: number }[];
  top_products_30d: { product_id: string; name: string; qty: number; revenue: number }[];
  low_stock_items: { id: string; name: string; stock_qty: number; min_stock: number }[];
}

export async function fetchKpis(): Promise<DashboardKpis | null> {
  const { data, error } = await (supabase as any).rpc('stock_dashboard_kpis');
  if (error) {
    console.error(error);
    return null;
  }
  return data as DashboardKpis;
}

export async function listProducts(): Promise<StockProduct[]> {
  const { data, error } = await (supabase as any)
    .from('stock_products')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) {
    console.error(error);
    return [];
  }
  return (data || []) as StockProduct[];
}

export async function listSales(): Promise<StockSale[]> {
  const { data, error } = await (supabase as any)
    .from('stock_sales')
    .select('*, stock_products(name)')
    .order('sold_at', { ascending: false })
    .limit(200);
  if (error) {
    console.error(error);
    return [];
  }
  return ((data || []) as any[]).map((s) => ({
    ...s,
    product_name: s.stock_products?.name,
  })) as StockSale[];
}
