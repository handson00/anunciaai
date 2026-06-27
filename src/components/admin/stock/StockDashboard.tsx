import { useEffect, useState } from 'react';
import { fetchKpis, DashboardKpis } from '@/lib/stock-queries';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { TrendingUp, DollarSign, Package, AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

const fmt = (v: number) => `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

export function StockDashboard() {
  const [kpis, setKpis] = useState<DashboardKpis | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    setKpis(await fetchKpis());
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  if (loading) {
    return <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }
  if (!kpis) return <p className="text-sm text-muted-foreground text-center py-8">Não foi possível carregar os indicadores.</p>;

  const cards = [
    { label: 'Vendas hoje', value: fmt(kpis.revenue_today), icon: DollarSign, color: 'bg-cta/10 text-cta' },
    { label: 'Vendas 7 dias', value: fmt(kpis.revenue_7d), icon: TrendingUp, color: 'bg-primary/10 text-primary' },
    { label: 'Vendas 30 dias', value: fmt(kpis.revenue_30d), icon: TrendingUp, color: 'bg-accent text-accent-foreground' },
    { label: 'Lucro 30 dias', value: fmt(kpis.profit_30d), icon: DollarSign, color: 'bg-cta/10 text-cta' },
    { label: 'Itens vendidos (30d)', value: String(kpis.items_sold_30d), icon: Package, color: 'bg-secondary text-secondary-foreground' },
    { label: 'Estoque baixo', value: String(kpis.low_stock_count), icon: AlertTriangle, color: kpis.low_stock_count > 0 ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={load}><RefreshCw className="w-4 h-4" /> Atualizar</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {cards.map((c) => (
          <div key={c.label} className="bg-card border rounded-xl p-4">
            <div className={`w-9 h-9 rounded-lg ${c.color} flex items-center justify-center mb-2`}>
              <c.icon className="w-4 h-4" />
            </div>
            <p className="text-xs text-muted-foreground">{c.label}</p>
            <p className="text-lg font-bold text-foreground mt-0.5">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-card border rounded-xl p-4">
        <h3 className="text-sm font-semibold mb-3">Faturamento últimos 30 dias</h3>
        {kpis.series_30d.length === 0 ? (
          <p className="text-xs text-muted-foreground py-6 text-center">Sem vendas no período.</p>
        ) : (
          <div className="w-full h-56">
            <ResponsiveContainer>
              <LineChart data={kpis.series_30d}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" tick={{ fontSize: 10 }} tickFormatter={(d) => new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: number) => fmt(v)} labelFormatter={(d) => new Date(d as string).toLocaleDateString('pt-BR')} />
                <Line type="monotone" dataKey="revenue" stroke="hsl(var(--cta))" strokeWidth={2} name="Vendas" dot={false} />
                <Line type="monotone" dataKey="profit" stroke="hsl(var(--primary))" strokeWidth={2} name="Lucro" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <div className="bg-card border rounded-xl p-4">
          <h3 className="text-sm font-semibold mb-3">Top 5 mais vendidos (30d)</h3>
          {kpis.top_products_30d.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhuma venda ainda.</p>
          ) : (
            <ul className="space-y-2">
              {kpis.top_products_30d.map((p) => (
                <li key={p.product_id} className="flex items-center justify-between text-sm">
                  <span className="truncate">{p.name}</span>
                  <span className="text-muted-foreground text-xs">{p.qty} un · {fmt(p.revenue)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-card border rounded-xl p-4">
          <h3 className="text-sm font-semibold mb-3">Estoque baixo</h3>
          {kpis.low_stock_items.length === 0 ? (
            <p className="text-xs text-muted-foreground">Tudo em ordem.</p>
          ) : (
            <ul className="space-y-2">
              {kpis.low_stock_items.map((p) => (
                <li key={p.id} className="flex items-center justify-between text-sm">
                  <span className="truncate">{p.name}</span>
                  <span className="text-destructive text-xs">{p.stock_qty} / mín {p.min_stock}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
