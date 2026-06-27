import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { listProducts, StockProduct } from '@/lib/stock-queries';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, Search, Minus, Save } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';

const schema = z.object({
  name: z.string().trim().min(1, 'Informe o nome').max(120),
  sku: z.string().trim().max(60).optional(),
  category: z.string().trim().max(60).optional(),
  photo_url: z.string().trim().max(500).optional(),
  cost_price: z.number().min(0),
  sale_price: z.number().min(0),
  stock_qty: z.number().int().min(0),
  min_stock: z.number().int().min(0),
  ad_id: z.string().nullable().optional(),
  active: z.boolean(),
});

type FormState = z.infer<typeof schema>;

const empty: FormState = {
  name: '', sku: '', category: '', photo_url: '',
  cost_price: 0, sale_price: 0, stock_qty: 0, min_stock: 0,
  ad_id: null, active: true,
};

export function StockProducts() {
  const [items, setItems] = useState<StockProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<StockProduct | null>(null);
  const [form, setForm] = useState<FormState>(empty);
  const [saving, setSaving] = useState(false);
  const [ads, setAds] = useState<{ id: string; title: string; main_photo: string; price: number }[]>([]);

  const load = async () => {
    setLoading(true);
    setItems(await listProducts());
    setLoading(false);
  };

  useEffect(() => {
    load();
    (supabase as any).from('ads').select('id, title, main_photo, price').order('created_at', { ascending: false }).limit(500)
      .then(({ data }: any) => setAds(data || []));
  }, []);

  const openNew = () => {
    setEditing(null);
    setForm(empty);
    setOpen(true);
  };

  const openEdit = (p: StockProduct) => {
    setEditing(p);
    setForm({
      name: p.name, sku: p.sku || '', category: p.category || '', photo_url: p.photo_url || '',
      cost_price: Number(p.cost_price), sale_price: Number(p.sale_price),
      stock_qty: p.stock_qty, min_stock: p.min_stock, ad_id: p.ad_id, active: p.active,
    });
    setOpen(true);
  };

  const importFromAd = () => {
    if (!form.ad_id) return;
    const ad = ads.find((a) => a.id === form.ad_id);
    if (!ad) return;
    setForm((f) => ({ ...f, name: ad.title, photo_url: ad.main_photo, sale_price: Number(ad.price) }));
  };

  const save = async () => {
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setSaving(true);
    const payload = {
      ...parsed.data,
      sku: parsed.data.sku || null,
      category: parsed.data.category || null,
      photo_url: parsed.data.photo_url || null,
      ad_id: parsed.data.ad_id || null,
    };
    let error;
    if (editing) {
      ({ error } = await (supabase as any).from('stock_products').update(payload).eq('id', editing.id));
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      ({ error } = await (supabase as any).from('stock_products').insert({ ...payload, created_by: user?.id }));
    }
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(editing ? 'Produto atualizado' : 'Produto criado');
    setOpen(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm('Excluir este produto? Vendas vinculadas impedem exclusão.')) return;
    const { error } = await (supabase as any).from('stock_products').delete().eq('id', id);
    if (error) return toast.error(error.message);
    toast.success('Excluído');
    load();
  };

  const adjustQty = async (p: StockProduct, delta: number) => {
    const newQty = Math.max(0, p.stock_qty + delta);
    const { error } = await (supabase as any).from('stock_products').update({ stock_qty: newQty }).eq('id', p.id);
    if (error) return toast.error(error.message);
    await (supabase as any).from('stock_movements').insert({ product_id: p.id, type: 'adjust', quantity: delta, note: 'Ajuste rápido' });
    load();
  };

  const filtered = items.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar produto..." className="pl-9" />
        </div>
        <Button variant="cta" onClick={openNew}><Plus className="w-4 h-4" /> Novo</Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-12">Nenhum produto cadastrado.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((p) => {
            const margin = p.sale_price > 0 ? ((p.sale_price - p.cost_price) / p.sale_price) * 100 : 0;
            const low = p.stock_qty <= p.min_stock;
            return (
              <div key={p.id} className="bg-card border rounded-xl p-3 flex items-center gap-3">
                {p.photo_url ? (
                  <img src={p.photo_url} alt="" className="w-14 h-14 rounded-lg object-cover" />
                ) : (
                  <div className="w-14 h-14 rounded-lg bg-muted flex items-center justify-center text-xl">📦</div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{p.name}</p>
                  <p className="text-xs text-muted-foreground">
                    R$ {Number(p.sale_price).toFixed(2)} · margem {margin.toFixed(0)}%
                    {p.sku && ` · ${p.sku}`}
                  </p>
                  <p className={`text-xs ${low ? 'text-destructive font-semibold' : 'text-muted-foreground'}`}>
                    Estoque: {p.stock_qty} {low && '⚠️'}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" onClick={() => adjustQty(p, -1)}><Minus className="w-3 h-3" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => adjustQty(p, 1)}><Plus className="w-3 h-3" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => openEdit(p)}><Pencil className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => remove(p.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Editar produto' : 'Novo produto'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium">Vincular a um anúncio (opcional)</label>
              <select value={form.ad_id || ''} onChange={(e) => setForm((f) => ({ ...f, ad_id: e.target.value || null }))} className="w-full border rounded-md px-2 py-2 text-sm bg-background">
                <option value="">— Nenhum —</option>
                {ads.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
              </select>
              {form.ad_id && <Button type="button" variant="outline" size="sm" className="mt-2" onClick={importFromAd}>Importar dados do anúncio</Button>}
            </div>
            <div>
              <label className="text-xs font-medium">Nome *</label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium">SKU</label>
                <Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-medium">Categoria</label>
                <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium">URL da foto</label>
              <Input value={form.photo_url} onChange={(e) => setForm({ ...form, photo_url: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium">Custo (R$)</label>
                <Input type="number" step="0.01" value={form.cost_price} onChange={(e) => setForm({ ...form, cost_price: Number(e.target.value) })} />
              </div>
              <div>
                <label className="text-xs font-medium">Preço venda (R$)</label>
                <Input type="number" step="0.01" value={form.sale_price} onChange={(e) => setForm({ ...form, sale_price: Number(e.target.value) })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium">Estoque atual</label>
                <Input type="number" value={form.stock_qty} onChange={(e) => setForm({ ...form, stock_qty: Number(e.target.value) })} />
              </div>
              <div>
                <label className="text-xs font-medium">Estoque mínimo</label>
                <Input type="number" value={form.min_stock} onChange={(e) => setForm({ ...form, min_stock: Number(e.target.value) })} />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
              Produto ativo
            </label>
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
