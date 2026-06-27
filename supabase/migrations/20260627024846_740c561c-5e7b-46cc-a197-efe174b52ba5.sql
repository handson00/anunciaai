
-- Adiciona controle de vendas parceladas/fiado
ALTER TABLE public.stock_sales
  ADD COLUMN IF NOT EXISTS payment_type text NOT NULL DEFAULT 'cash' CHECK (payment_type IN ('cash','installment')),
  ADD COLUMN IF NOT EXISTS installments_total integer NOT NULL DEFAULT 1 CHECK (installments_total >= 1),
  ADD COLUMN IF NOT EXISTS amount_paid numeric(12,2) NOT NULL DEFAULT 0;

-- Tabela de pagamentos recebidos para vendas parceladas
CREATE TABLE IF NOT EXISTS public.stock_sale_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES public.stock_sales(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  paid_at timestamptz NOT NULL DEFAULT now(),
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_sale_payments TO authenticated;
GRANT ALL ON public.stock_sale_payments TO service_role;

ALTER TABLE public.stock_sale_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stock_sale_payments_manage" ON public.stock_sale_payments;
CREATE POLICY "stock_sale_payments_manage" ON public.stock_sale_payments
  FOR ALL USING (public.can_manage_stock()) WITH CHECK (public.can_manage_stock());

CREATE INDEX IF NOT EXISTS idx_stock_sale_payments_sale ON public.stock_sale_payments(sale_id);

-- Mantém amount_paid da venda em sincronia com pagamentos
CREATE OR REPLACE FUNCTION public.recalc_sale_amount_paid()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  sid uuid;
BEGIN
  sid := COALESCE(NEW.sale_id, OLD.sale_id);
  UPDATE public.stock_sales s
  SET amount_paid = COALESCE((SELECT SUM(amount) FROM public.stock_sale_payments WHERE sale_id = sid), 0)
  WHERE s.id = sid;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_recalc_sale_paid_ins ON public.stock_sale_payments;
DROP TRIGGER IF EXISTS trg_recalc_sale_paid_upd ON public.stock_sale_payments;
DROP TRIGGER IF EXISTS trg_recalc_sale_paid_del ON public.stock_sale_payments;
CREATE TRIGGER trg_recalc_sale_paid_ins AFTER INSERT ON public.stock_sale_payments
  FOR EACH ROW EXECUTE FUNCTION public.recalc_sale_amount_paid();
CREATE TRIGGER trg_recalc_sale_paid_upd AFTER UPDATE ON public.stock_sale_payments
  FOR EACH ROW EXECUTE FUNCTION public.recalc_sale_amount_paid();
CREATE TRIGGER trg_recalc_sale_paid_del AFTER DELETE ON public.stock_sale_payments
  FOR EACH ROW EXECUTE FUNCTION public.recalc_sale_amount_paid();

-- Quando registra venda à vista, marca como totalmente paga
CREATE OR REPLACE FUNCTION public.init_sale_amount_paid()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.payment_type = 'cash' THEN
    NEW.amount_paid := COALESCE(NEW.total, NEW.unit_price * NEW.quantity);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_init_sale_paid ON public.stock_sales;
CREATE TRIGGER trg_init_sale_paid BEFORE INSERT ON public.stock_sales
  FOR EACH ROW EXECUTE FUNCTION public.init_sale_amount_paid();
