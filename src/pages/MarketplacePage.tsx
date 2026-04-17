import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, SlidersHorizontal, LogIn } from 'lucide-react';
import logo from '@/assets/logo.png';
import type { Ad, AdCategory } from '@/contexts/AppContext';

const categoryFilters: { value: AdCategory | 'all'; label: string; emoji: string }[] = [
  { value: 'all', label: 'Todos', emoji: '🏪' },
  { value: 'automobile', label: 'Automóveis', emoji: '🚗' },
  { value: 'product', label: 'Produtos', emoji: '📦' },
  { value: 'property', label: 'Imóveis', emoji: '🏠' },
  { value: 'service', label: 'Serviços', emoji: '🔧' },
];

export default function MarketplacePage() {
  const navigate = useNavigate();
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<AdCategory | 'all'>('all');

  useEffect(() => {
    fetchPublishedAds();
  }, []);

  const fetchPublishedAds = async () => {
    const { data } = await supabase
      .from('ads')
      .select('*')
      .eq('status', 'published')
      .order('created_at', { ascending: false });

    const adsList = (data || []) as Ad[];

    // Fetch advertiser names (store_name preferred, fallback to name)
    const userIds = Array.from(new Set(adsList.map(a => a.user_id)));
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, name, store_name')
        .in('user_id', userIds);
      const nameMap = new Map(
        (profiles || []).map(p => [p.user_id, (p as any).store_name || p.name])
      );
      adsList.forEach(ad => {
        ad.user_name = nameMap.get(ad.user_id) || 'Anunciante';
      });
    }

    setAds(adsList);
    setLoading(false);
  };

  const filtered = ads.filter(ad => {
    const matchesSearch = !search || 
      ad.title.toLowerCase().includes(search.toLowerCase()) ||
      ad.description.toLowerCase().includes(search.toLowerCase()) ||
      (ad.region && ad.region.toLowerCase().includes(search.toLowerCase()));
    const matchesCategory = category === 'all' || ad.category === category;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card/80 backdrop-blur-md border-b sticky top-0 z-20">
        <div className="container max-w-5xl mx-auto flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <img src={logo} alt="anunciaAI" className="w-8 h-8" />
            <h1 className="text-lg font-bold">
              <span className="text-cta">anunci</span>AI
            </h1>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate('/login')}>
            <LogIn className="w-4 h-4 mr-1" /> Entrar
          </Button>
        </div>
      </header>

      {/* Hero */}
      <div className="bg-gradient-to-b from-cta/10 to-background py-8 px-4">
        <div className="container max-w-5xl mx-auto text-center space-y-4">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground">
            Encontre o que procura 🔍
          </h2>
          <p className="text-muted-foreground text-sm">
            Veja os melhores anúncios da comunidade
          </p>
          <div className="relative max-w-md mx-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar anúncios..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      </div>

      {/* Category filters */}
      <div className="container max-w-5xl mx-auto px-4 py-4">
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {categoryFilters.map(cat => (
            <button
              key={cat.value}
              onClick={() => setCategory(cat.value)}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                category === cat.value
                  ? 'bg-cta text-cta-foreground shadow-md'
                  : 'bg-card border text-muted-foreground hover:bg-muted'
              }`}
            >
              {cat.emoji} {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Ads Grid */}
      <div className="container max-w-5xl mx-auto px-4 pb-12">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-cta border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-4xl mb-3">📭</p>
            <p className="font-semibold text-foreground">Nenhum anúncio encontrado</p>
            <p className="text-sm text-muted-foreground mt-1">Tente outra busca ou categoria</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
            {filtered.map(ad => (
              <button
                key={ad.id}
                onClick={() => navigate(`/ad/${ad.slug}`)}
                className="bg-card rounded-xl overflow-hidden border hover:shadow-lg transition-all text-left group"
              >
                <div className="aspect-square overflow-hidden">
                  <img
                    src={ad.main_photo}
                    alt={ad.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
                <div className="p-3 space-y-1">
                  <p className="font-semibold text-foreground text-sm line-clamp-2 leading-tight">
                    {ad.title}
                  </p>
                  <p className="text-cta font-bold text-base">
                    R$ {Number(ad.price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                  {ad.user_name && (
                    <p className="text-xs text-muted-foreground truncate">👤 {ad.user_name}</p>
                  )}
                  {ad.region && (
                    <p className="text-xs text-muted-foreground">📍 {ad.region}</p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
