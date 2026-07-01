import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { listProducts, listSales, listSalePayments, StockProduct, StockSale, SalePayment } from '@/lib/stock-queries';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Trash2, Save, Wallet, CreditCard } from 'lucide-react';
import { toast } from 'sonner';

const fmt = (v: number) => `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

export function StockSales() {
  const [sales, setSales] = useState<StockSale[]>([]);
  const [products, setProducts] = useState<StockProduct[]>([]);
  const [loading, setLoading] = useState(true);

  // New sale modal
  const [open, setOpen] = useState(false);
  const [productId, setProductId] = useState('');
  const [qty, setQty] = useState(1);
  const [price, setPrice] = useState(0);
  const [customer, setCustomer] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [note, setNote] = useState('');
  const [paymentType, setPaymentType] = useState<'cash' | 'installment'>('cash');
  const [installments, setInstallments] = useState(2);
  const [downPayment, setDownPayment] = useState(0);
  const [saving, setSaving] = useState(false);

  // Template de cobrança
  const [tplOpen, setTplOpen] = useState(false);
  const [tplLoading, setTplLoading] = useState(false);
  const [template, setTemplate] = useState('');
  const [tplSaving, setTplSaving] = useState(false);
  const [sending, setSending] = useState(false);

  // Payments modal
  const [payOpen, setPayOpen] = useState(false);
  const [activeSale, setActiveSale] = useState<StockSale | null>(null);
  const [payments, setPayments] = useState<SalePayment[]>([]);
  const [payAmount, setPayAmount] = useState(0);
  const [payNote, setPayNote] = useState('');

  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'paid'>('all');

  const load = async () => {
    setLoading(true);
    const [s, p] = await Promise.all([listSales(), listProducts()]);
    setSales(s);
    setProducts(p);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openNew = () => {
    setProductId(''); setQty(1); setPrice(0); setCustomer(''); setCustomerPhone(''); setDueDate(''); setNote('');
    setPaymentType('cash'); setInstallments(2); setDownPayment(0);
    setOpen(true);
  };

  const openTemplate = async () => {
    setTplOpen(true);
    setTplLoading(true);
    const { data } = await (supabase as any)
      .from('app_settings').select('value').eq('key', 'billing_reminder_template').maybeSingle();
    setTemplate(data?.value || 'Olá {nome}! Passando para lembrar do pagamento de *{produto}* no valor de *R$ {valor}*. Qualquer dúvida estou à disposição.');
    setTplLoading(false);
  };

  const saveTemplate = async () => {
    setTplSaving(true);
    const { error } = await (supabase as any)
      .from('app_settings')
      .upsert({ key: 'billing_reminder_template', value: template }, { onConflict: 'key' });
    setTplSaving(false);
    if (error) return toast.error(error.message);
    toast.success('Mensagem salva');
    setTplOpen(false);
  };

  const runNow = async () => {
    setSending(true);
    const { data, error } = await supabase.functions.invoke('enviar-cobranca-fiado');
    setSending(false);
    if (error) return toast.error(error.message);
    toast.success(`Cobranças processadas: ${(data as any)?.processed ?? 0}`);
    load();
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
    if (paymentType === 'installment' && installments < 2) return toast.error('Parcelas devem ser ≥ 2');

    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { data: inserted, error } = await (supabase as any).from('stock_sales').insert({
      product_id: productId,
      quantity: qty,
      unit_price: price,
      unit_cost: Number(p.cost_price),
      customer_name: customer || null,
      customer_phone: customerPhone || null,
      due_date: dueDate || null,
      note: note || null,
      created_by: user?.id,
      payment_type: paymentType,
      installments_total: paymentType === 'installment' ? installments : 1,
    }).select().single();

    if (error) { setSaving(false); return toast.error(error.message); }

    // Registrar entrada se houver
    if (paymentType === 'installment' && downPayment > 0 && inserted) {
      const { error: payErr } = await (supabase as any).from('stock_sale_payments').insert({
        sale_id: inserted.id,
        amount: downPayment,
        note: 'Entrada',
        created_by: user?.id,
      });
      if (payErr) toast.error('Venda criada, mas falhou ao registrar entrada: ' + payErr.message);
    }

    setSaving(false);
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

  const openPayments = async (sale: StockSale) => {
    setActiveSale(sale);
    setPayAmount(0);
    setPayNote('');
    setPayments(await listSalePayments(sale.id));
    setPayOpen(true);
  };

  const addPayment = async () => {
    if (!activeSale) return;
    if (payAmount <= 0) return toast.error('Valor inválido');
    const remaining = Number(activeSale.total) - Number(activeSale.amount_paid);
    if (payAmount > remaining + 0.001) return toast.error(`Valor maior que o restante (${fmt(remaining)})`);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await (supabase as any).from('stock_sale_payments').insert({
      sale_id: activeSale.id,
      amount: payAmount,
      note: payNote || null,
      created_by: user?.id,
    });
    if (error) return toast.error(error.message);
    toast.success('Pagamento registrado');
    const updated = await listSales();
    setSales(updated);
    const fresh = updated.find((s) => s.id === activeSale.id);
    if (fresh) setActiveSale(fresh);
    setPayments(await listSalePayments(activeSale.id));
    setPayAmount(0); setPayNote('');
  };

  const removePayment = async (id: string) => {
    if (!activeSale) return;
    if (!confirm('Excluir este pagamento?')) return;
    const { error } = await (supabase as any).from('stock_sale_payments').delete().eq('id', id);
    if (error) return toast.error(error.message);
    const updated = await listSales();
    setSales(updated);
    const fresh = updated.find((s) => s.id === activeSale.id);
    if (fresh) setActiveSale(fresh);
    setPayments(await listSalePayments(activeSale.id));
  };

  const filtered = sales.filter((s) => {
    if (fromDate && s.sold_at < fromDate) return false;
    if (toDate && s.sold_at > toDate + 'T23:59:59') return false;
    const remaining = Number(s.total) - Number(s.amount_paid);
    if (filter === 'pending' && remaining <= 0.001) return false;
    if (filter === 'paid' && remaining > 0.001) return false;
    return true;
  });

  const totalFiltered = filtered.reduce((acc, s) => acc + Number(s.total), 0);
  const profitFiltered = filtered.reduce((acc, s) => acc + Number(s.profit), 0);
  const receivedFiltered = filtered.reduce((acc, s) => acc + Number(s.amount_paid), 0);
  const pendingFiltered = totalFiltered - receivedFiltered;

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
        <div>
          <label className="text-xs">Status</label>
          <select value={filter} onChange={(e) => setFilter(e.target.value as any)} className="h-9 border rounded-md px-2 text-sm bg-background">
            <option value="all">Todas</option>
            <option value="pending">Em aberto</option>
            <option value="paid">Quitadas</option>
          </select>
        </div>
        <div className="flex-1" />
        <Button variant="cta" onClick={openNew}><Plus className="w-4 h-4" /> Registrar venda</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div className="bg-card border rounded-lg p-3 text-center">
          <p className="text-[10px] text-muted-foreground">Vendas</p>
          <p className="font-bold text-sm">{filtered.length}</p>
        </div>
        <div className="bg-card border rounded-lg p-3 text-center">
          <p className="text-[10px] text-muted-foreground">Faturamento</p>
          <p className="font-bold text-sm text-cta">{fmt(totalFiltered)}</p>
        </div>
        <div className="bg-card border rounded-lg p-3 text-center">
          <p className="text-[10px] text-muted-foreground">Recebido</p>
          <p className="font-bold text-sm text-primary">{fmt(receivedFiltered)}</p>
        </div>
        <div className="bg-card border rounded-lg p-3 text-center">
          <p className="text-[10px] text-muted-foreground">A receber</p>
          <p className={`font-bold text-sm ${pendingFiltered > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>{fmt(pendingFiltered)}</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-12">Nenhuma venda no período.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((s) => {
            const total = Number(s.total);
            const paid = Number(s.amount_paid);
            const remaining = total - paid;
            const isInstallment = s.payment_type === 'installment';
            const isPaid = remaining <= 0.001;
            const pct = total > 0 ? Math.min(100, (paid / total) * 100) : 0;
            return (
              <div key={s.id} className="bg-card border rounded-xl p-3">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm truncate">{s.product_name || 'Produto'}</p>
                      {isInstallment ? (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${isPaid ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive'}`}>
                          <CreditCard className="w-3 h-3 inline mr-0.5" />
                          {isPaid ? 'Quitado' : `${s.installments_total}x`}
                        </span>
                      ) : (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-cta/10 text-cta">
                          <Wallet className="w-3 h-3 inline mr-0.5" /> À vista
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {s.quantity} un × {fmt(Number(s.unit_price))} = <span className="font-semibold text-cta">{fmt(total)}</span>
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {new Date(s.sold_at).toLocaleString('pt-BR')}
                      {s.customer_name && ` · ${s.customer_name}`}
                    </p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => remove(s.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                </div>

                {isInstallment && (
                  <div className="mt-2 space-y-1.5">
                    <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                      <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-primary font-medium">Pago: {fmt(paid)}</span>
                      <span className={remaining > 0.001 ? 'text-destructive font-medium' : 'text-muted-foreground'}>
                        Falta: {fmt(remaining)}
                      </span>
                    </div>
                    <Button variant="outline" size="sm" className="w-full h-8" onClick={() => openPayments(s)}>
                      <Wallet className="w-3.5 h-3.5" /> Pagamentos
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Nova venda */}
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

            <div className="border-t pt-3">
              <label className="text-xs font-medium block mb-1.5">Forma de pagamento</label>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setPaymentType('cash')}
                  className={`p-2 rounded-md border text-xs font-medium ${paymentType === 'cash' ? 'bg-cta text-cta-foreground border-cta' : 'bg-background'}`}>
                  <Wallet className="w-4 h-4 inline mr-1" /> À vista
                </button>
                <button type="button" onClick={() => setPaymentType('installment')}
                  className={`p-2 rounded-md border text-xs font-medium ${paymentType === 'installment' ? 'bg-primary text-primary-foreground border-primary' : 'bg-background'}`}>
                  <CreditCard className="w-4 h-4 inline mr-1" /> Parcelado / Fiado
                </button>
              </div>
              {paymentType === 'installment' && (
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div>
                    <label className="text-xs font-medium">Nº de parcelas</label>
                    <Input type="number" min={2} value={installments} onChange={(e) => setInstallments(Number(e.target.value))} />
                  </div>
                  <div>
                    <label className="text-xs font-medium">Entrada (R$)</label>
                    <Input type="number" step="0.01" min={0} value={downPayment} onChange={(e) => setDownPayment(Number(e.target.value))} />
                  </div>
                  <p className="col-span-2 text-[11px] text-muted-foreground">
                    Cada parcela: {fmt((qty * price - downPayment) / Math.max(1, installments))}
                  </p>
                </div>
              )}
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

      {/* Pagamentos */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Pagamentos da venda</DialogTitle></DialogHeader>
          {activeSale && (() => {
            const total = Number(activeSale.total);
            const paid = Number(activeSale.amount_paid);
            const remaining = total - paid;
            return (
              <div className="space-y-3">
                <div className="bg-secondary p-3 rounded-lg space-y-1 text-sm">
                  <div className="flex justify-between"><span>Total:</span><strong>{fmt(total)}</strong></div>
                  <div className="flex justify-between text-primary"><span>Pago:</span><strong>{fmt(paid)}</strong></div>
                  <div className="flex justify-between text-destructive"><span>Falta:</span><strong>{fmt(remaining)}</strong></div>
                  {activeSale.customer_name && <p className="text-xs text-muted-foreground pt-1">Cliente: {activeSale.customer_name}</p>}
                </div>

                <div>
                  <p className="text-xs font-semibold mb-1.5">Histórico</p>
                  {payments.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Nenhum pagamento ainda.</p>
                  ) : (
                    <ul className="space-y-1 max-h-40 overflow-y-auto">
                      {payments.map((p) => (
                        <li key={p.id} className="flex items-center justify-between text-xs bg-card border rounded p-2">
                          <div>
                            <p className="font-medium">{fmt(Number(p.amount))}</p>
                            <p className="text-muted-foreground text-[10px]">
                              {new Date(p.paid_at).toLocaleString('pt-BR')}
                              {p.note && ` · ${p.note}`}
                            </p>
                          </div>
                          <Button variant="ghost" size="icon" onClick={() => removePayment(p.id)}>
                            <Trash2 className="w-3.5 h-3.5 text-destructive" />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {remaining > 0.001 && (
                  <div className="border-t pt-3 space-y-2">
                    <p className="text-xs font-semibold">Registrar pagamento</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px]">Valor (R$)</label>
                        <Input type="number" step="0.01" value={payAmount} onChange={(e) => setPayAmount(Number(e.target.value))} />
                      </div>
                      <div>
                        <label className="text-[11px]">Observação</label>
                        <Input value={payNote} onChange={(e) => setPayNote(e.target.value)} placeholder="Ex: Parcela 2" />
                      </div>
                    </div>
                    <div className="flex gap-1 flex-wrap">
                      <Button variant="outline" size="sm" className="h-7 text-[11px]" onClick={() => setPayAmount(Number((remaining / Math.max(1, activeSale.installments_total)).toFixed(2)))}>
                        1 parcela
                      </Button>
                      <Button variant="outline" size="sm" className="h-7 text-[11px]" onClick={() => setPayAmount(Number(remaining.toFixed(2)))}>
                        Quitar tudo
                      </Button>
                    </div>
                    <Button variant="cta" className="w-full" onClick={addPayment}>
                      <Plus className="w-4 h-4" /> Adicionar pagamento
                    </Button>
                  </div>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
