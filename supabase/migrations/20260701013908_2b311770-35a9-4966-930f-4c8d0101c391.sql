
ALTER TABLE public.stock_sales
  ADD COLUMN IF NOT EXISTS due_date date,
  ADD COLUMN IF NOT EXISTS customer_phone text,
  ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_stock_sales_due_date
  ON public.stock_sales(due_date)
  WHERE due_date IS NOT NULL AND reminder_sent_at IS NULL;
