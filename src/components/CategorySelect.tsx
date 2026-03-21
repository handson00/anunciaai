import { Car, Package, Home, Wrench } from 'lucide-react';

export type AdCategory = 'automobile' | 'product' | 'property' | 'service';

const categories: { key: AdCategory; label: string; icon: typeof Car; desc: string }[] = [
  { key: 'automobile', label: 'Automóvel', icon: Car, desc: 'Carros, motos, caminhões' },
  { key: 'product', label: 'Produto', icon: Package, desc: 'Eletrônicos, roupas, etc' },
  { key: 'property', label: 'Imóvel', icon: Home, desc: 'Casas, apartamentos, terrenos' },
  { key: 'service', label: 'Serviço', icon: Wrench, desc: 'Serviços em geral' },
];

interface Props {
  onSelect: (category: AdCategory) => void;
}

export function CategorySelect({ onSelect }: Props) {
  return (
    <div className="space-y-4">
      <div className="text-center space-y-1">
        <h2 className="text-xl font-bold text-foreground">O que você deseja anunciar?</h2>
        <p className="text-sm text-muted-foreground">Escolha a categoria do seu anúncio</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {categories.map((cat, i) => (
          <button
            key={cat.key}
            onClick={() => onSelect(cat.key)}
            className="bg-card border rounded-2xl p-5 text-center hover:shadow-lg hover:border-primary/30 transition-all active:scale-[0.96] animate-fade-in-up"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center mx-auto mb-3">
              <cat.icon className="w-6 h-6 text-accent-foreground" />
            </div>
            <p className="font-semibold text-foreground text-sm">{cat.label}</p>
            <p className="text-xs text-muted-foreground mt-1">{cat.desc}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
