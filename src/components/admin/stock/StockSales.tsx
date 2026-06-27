import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { listProducts, listSales, StockProduct, StockSale } from '@/lib/stock-queries';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Trash2, Save } from 'lucide-react';
import { toast } from 'sonner';

const fmt = (v: number) => `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

export function StockSales() {
  const [sales, setSales] = useState<StockSale[]>([]);
  const [products, setProducts] = useState<StockProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [productId, setProductId] = useState('');
  const [qty, setQty] = useState(1);
  const [price, setPrice] = useState(0);
  const [customer, setCustomer] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const load = async () => {
    setLoading(true);
    const [s, p] = await Promise.all([listSales(), listProducts()]);
    setSales(s);
    setProducts(p);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openNew = () => {
    setProductId(''); setQty(1); setPrice(0); setCustomer(''); setNote('');
    setOpen(true);
  };

  const onProductChange = (id: string) => {
    setProductId(id);
    const p = products.find((x) => x.id === id);
    if (p) setPrice(Number(p.sale_price));
  };

  const save = async () => {
    if (!productId) return toast.error('Selecione um produto');
    if (qty <= 0) return toast.error('Quantidade inválida');
    const p = products.find((x) => x.id === productId);
    if (!p) return;
    if (qty > p.stock_qty) return toast.error(`Estoque insuficiente (${p.stock_qty})`);

    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await (supabase as any).from('stock_sales').insert({
      product_id: productId,
      quantity: qty,
      unit_price: price,
      unit_cost: Number(p.cost_price),
      customer_name: customer || null,
      note: note || null,
      created_by: user?.id,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success('Venda registrada');
    setOpen(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm('Excluir esta venda? O estoque será devolvido.')) return;
    const { error } = await (supabase as any).from('stock_sales').delete().eq('id', id);
    if (error) return toast.error(error.message);
    toast.success('Venda excluída');
    load();
  };

  const filtered = sales.filter((s) => {
    if (fromDate && s.sold_at < fromDate) return false;
    if (toDate && s.sold_at > toDate + 'T23:59:59') return false;
    return true;
  });

  const totalFiltered = filtered.reduce((acc, s) => acc + Number(s.total), 0);
  const profitFiltered = filtered.reduce((acc, s) => acc + Number(s.profit), 0);

  return (
    <div className="space-y-3">
      <div className="flex gap-2 items-end flex-wrap">
        <div>
          <label className="text-xs">De</label>
          <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="h-9" />
        </div>
        <div>
          <label className="text-xs">Até</label>
          <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="h-9" />
        </div>
        <div className="flex-1" />
        <Button variant="cta" onClick={openNew}><Plus className="w-4 h-4" /> Registrar venda</Button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="bg-card border rounded-lg p-3 text-center">
          <p className="text-[10px] text-muted-foreground">Vendas</p>
          <p className="font-bold text-sm">{filtered.length}</p>
        </div>
        <div className="bg-card border rounded-lg p-3 text-center">
          <p className="text-[10px] text-muted-foreground">Faturamento</p>
          <p className="font-bold text-sm text-cta">{fmt(totalFiltered)}</p>
        </div>
        <div className="bg-card border rounded-lg p-3 text-center">
          <p className="text-[10px] text-muted-foreground">Lucro</p>
          <p className="font-bold text-sm text-primary">{fmt(profitFiltered)}</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-12">Nenhuma venda no período.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((s) => (
            <div key={s.id} className="bg-card border rounded-xl p-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{s.product_name || 'Produto'}</p>
                <p className="text-xs text-muted-foreground">
                  {s.quantity} un × {fmt(Number(s.unit_price))} = <span className="font-semibold text-cta">{fmt(Number(s.total))}</span>
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {new Date(s.sold_at).toLocaleString('pt-BR')}
                  {s.customer_name && ` · ${s.customer_name}`}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Lucro</p>
                <p className="text-sm font-bold text-primary">{fmt(Number(s.profit))}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => remove(s.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Registrar venda</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium">Produto *</label>
              <select value={productId} onChange={(e) => onProductChange(e.target.value)} className="w-full border rounded-md px-2 py-2 text-sm bg-background">
                <option value="">— Selecionar —</option>
                {products.filter((p) => p.active).map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.stock_qty} disp)</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium">Quantidade *</label>
                <Input type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value))} />
              </div>
              <div>
                <label className="text-xs font-medium">Preço unit. (R$) *</label>
                <Input type="number" step="0.01" value={price} onChange={(e) => setPrice(Number(e.target.value))} />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium">Cliente</label>
              <Input value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="Opcional" />
            </div>
            <div>
              <label className="text-xs font-medium">Observação</label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Opcional" />
            </div>
            {productId && (
              <p className="text-sm bg-secondary p-2 rounded">
                Total: <strong className="text-cta">{fmt(qty * price)}</strong>
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button variant="cta" onClick={save} disabled={saving}><Save className="w-4 h-4" /> Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
