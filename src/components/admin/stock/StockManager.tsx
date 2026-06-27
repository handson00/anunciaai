import { useState } from 'react';
import { StockDashboard } from './StockDashboard';
import { StockProducts } from './StockProducts';
import { StockSales } from './StockSales';
import { StockPermissions } from './StockPermissions';
import { BarChart3, Package, ShoppingCart, Shield } from 'lucide-react';

type SubTab = 'dashboard' | 'products' | 'sales' | 'perms';

export function StockManager({ currentUserId }: { currentUserId: string }) {
  const [sub, setSub] = useState<SubTab>('dashboard');

  const tabs: { key: SubTab; label: string; icon: any }[] = [
    { key: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { key: 'products', label: 'Produtos', icon: Package },
    { key: 'sales', label: 'Vendas', icon: ShoppingCart },
    { key: 'perms', label: 'Permissões', icon: Shield },
  ];

  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setSub(t.key)}
            className={`flex-1 min-w-[90px] py-2 rounded-lg text-xs font-semibold transition-all ${
              sub === t.key ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
            }`}
          >
            <t.icon className="w-4 h-4 inline mr-1" />
            {t.label}
          </button>
        ))}
      </div>

      {sub === 'dashboard' && <StockDashboard />}
      {sub === 'products' && <StockProducts />}
      {sub === 'sales' && <StockSales />}
      {sub === 'perms' && <StockPermissions currentUserId={currentUserId} />}
    </div>
  );
}
