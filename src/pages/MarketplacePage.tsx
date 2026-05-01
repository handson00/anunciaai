import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Megaphone, Users } from 'lucide-react';
import logo from '@/assets/logo.png';
import type { Ad, AdCategory } from '@/contexts/AppContext';

const categoryFilters: { value: AdCategory | 'all'; label: string; emoji: string }[] = [
  { value: 'all', label: 'Todos', emoji: '🏪' },
  { value: 'automobile', label: 'Automóveis', emoji: '🚗' },
  { value: 'product', label: 'Produtos', emoji: '📦' },
  { value: 'property', label: 'Imóveis', emoji: '🏠' },
  { value: 'service', label: 'Serviços', emoji: '🔧' },
];

async function fetchPublishedAds(): Promise<Ad[]> {
  const { data } = await supabase
    .from('ads')
    .select('id,user_id,category,title,description,price,condition,brand,region,main_photo,photos,contact_phone,status,created_at,slug')
    .eq('status', 'published')
    .order('created_at', { ascending: false });

  const adsList = (data || []) as Ad[];
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
  return adsList;
}

export default function MarketplacePage() {
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<AdCategory | 'all'>('all');
  const [groupLink, setGroupLink] = useState<string | null>(null);

  const { data: ads = [], isLoading } = useQuery({
    queryKey: ['marketplace-ads'],
    queryFn: fetchPublishedAds,
    staleTime: 1000 * 60 * 2,
  });

  useEffect(() => {
    async function fetchGroup() {
      // Prioritize the group marked as the join link, otherwise fallback to the first active group
      const { data: joinLinkGroup } = await supabase
        .from('community_groups')
        .select('link')
        .eq('active', true)
        .eq('is_join_group_link', true)
        .maybeSingle();

      if (joinLinkGroup) {
        setGroupLink(joinLinkGroup.link);
      } else {
        const { data } = await supabase
          .from('community_groups')
          .select('link')
          .eq('active', true)
          .order('created_at', { ascending: true })
          .limit(1);
        
        if (data && data.length > 0) {
          setGroupLink(data[0].link);
        }
      }
    }
    fetchGroup();
  }, []);

  // Debounce search input (250ms)
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 250);
    return () => clearTimeout(t);
  }, [searchInput]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ads.filter(ad => {
      const matchesCategory = category === 'all' || ad.category === category;
      if (!matchesCategory) return false;
      if (!q) return true;
      return (
        ad.title.toLowerCase().includes(q) ||
        ad.description.toLowerCase().includes(q) ||
        (ad.region && ad.region.toLowerCase().includes(q))
      );
    });
  }, [ads, search, category]);

  const goToAd = useCallback((slug: string) => navigate(`/ad/${slug}`), [navigate]);

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card/80 backdrop-blur-md border-b sticky top-0 z-20">
        <div className="container max-w-5xl mx-auto flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <img src={logo} alt="anunciaAI" className="w-8 h-8" width={32} height={32} />
            <h1 className="text-lg font-bold">
              <span className="text-cta">anunci</span>AI
            </h1>
          </div>
          <Button 
            className="bg-cta hover:bg-cta/90 text-cta-foreground font-bold shadow-lg animate-pulse-slow hover:animate-none transition-all"
            size="sm" 
            onClick={() => navigate('/login')}
          >
            <Megaphone className="w-4 h-4 mr-1" /> Anunciar aqui
          </Button>
        </div>
        {groupLink && (
          <div className="container max-w-5xl mx-auto px-4 mt-2 mb-[-1rem]">
            <button
              onClick={() => window.open(groupLink, '_blank')}
              className="w-full bg-cta/10 text-cta py-2 px-4 rounded-lg flex items-center justify-center gap-2 text-sm font-bold border border-cta/20 animate-fade-in"
            >
              <Users className="w-4 h-4" /> Entrar no grupo da comunidade
            </button>
          </div>
        )}
      </header>

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
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      </div>

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

      <div className="container max-w-5xl mx-auto px-4 pb-12">
        {isLoading ? (
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
            {filtered.map((ad, idx) => (
              <button
                key={ad.id}
                onClick={() => goToAd(ad.slug)}
                className="bg-card rounded-xl overflow-hidden border hover:shadow-lg transition-all text-left group"
              >
                <div className="aspect-square overflow-hidden bg-muted">
                  <img
                    src={ad.main_photo}
                    alt={ad.title}
                    loading={idx < 4 ? 'eager' : 'lazy'}
                    decoding="async"
                    fetchPriority={idx < 4 ? 'high' : 'low'}
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
