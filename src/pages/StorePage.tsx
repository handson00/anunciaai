import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Share2, Copy, Check, Loader2, Store as StoreIcon } from 'lucide-react';
import { toast } from 'sonner';
import type { Ad } from '@/contexts/AppContext';

interface Advertiser {
  user_id: string;
  name: string;
  store_name?: string | null;
  avatar_url?: string | null;
  store_slug?: string | null;
}

// UUID detector for backward compatibility with old /loja/{userId} links
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function StorePage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [advertiser, setAdvertiser] = useState<Advertiser | null>(null);
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!slug) return;
    (async () => {
      setLoading(true);
      let profile: Advertiser | null = null;

      if (UUID_RE.test(slug)) {
        const { data } = await supabase.rpc('get_public_advertisers', { _user_ids: [slug] });
        profile = (data?.[0] as any) || null;
      } else {
        const { data } = await supabase.rpc('get_advertiser_by_slug', { _slug: slug });
        profile = (data?.[0] as any) || null;
      }

      if (!profile) {
        setAdvertiser(null);
        setAds([]);
        setLoading(false);
        return;
      }

      const { data: adsData } = await supabase
        .from('ads')
        .select('id,user_id,category,title,price,main_photo,region,status,slug,is_sold,created_at')
        .eq('user_id', profile.user_id)
        .in('status', ['published', 'sold'])
        .order('created_at', { ascending: false });

      setAdvertiser(profile);
      setAds((adsData || []) as Ad[]);
      setLoading(false);

      // If user landed via UUID, replace URL with the nicer slug
      if (UUID_RE.test(slug) && profile.store_slug) {
        window.history.replaceState(null, '', `/loja/${profile.store_slug}`);
      }
    })();
  }, [slug]);

  const storeName = advertiser?.store_name || advertiser?.name || 'Loja';
  const storeHandle = advertiser?.store_slug || advertiser?.user_id || slug;
  const storeUrl = useMemo(() => `${window.location.origin}/loja/${storeHandle}`, [storeHandle]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(storeUrl);
    setCopied(true);
    toast.success('Link da loja copiado!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = () => {
    const text = `🏪 Confira a loja de *${storeName}* no AnunciaAI:\n${storeUrl}`;
    if (navigator.share) {
      navigator.share({ title: storeName, text, url: storeUrl }).catch(() => {});
    } else {
      navigator.clipboard.writeText(text);
      toast.success('Texto da loja copiado!');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-cta animate-spin" />
      </div>
    );
  }

  if (!advertiser) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-4xl mb-4">🏪</p>
          <p className="font-semibold text-foreground">Loja não encontrada</p>
          <Button variant="cta" className="mt-4" onClick={() => navigate('/')}>Ver marketplace</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card/80 backdrop-blur-md border-b sticky top-0 z-10">
        <div className="container max-w-5xl mx-auto flex items-center justify-between px-4 py-3">
          <Button variant="ghost" size="icon" aria-label="Voltar" onClick={() => navigate('/')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" aria-label="Copiar link" onClick={handleCopyLink}>
              {copied ? <Check className="w-5 h-5 text-cta" /> : <Copy className="w-5 h-5" />}
            </Button>
            <Button variant="ghost" size="icon" aria-label="Compartilhar loja" onClick={handleShare}>
              <Share2 className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      <div className="bg-gradient-to-b from-cta/10 to-background py-8 px-4">
        <div className="container max-w-5xl mx-auto text-center space-y-3">
          {advertiser.avatar_url ? (
            <img
              src={advertiser.avatar_url}
              alt={storeName}
              className="w-24 h-24 rounded-full object-cover mx-auto border-4 border-card shadow-md"
              width={96}
              height={96}
            />
          ) : (
            <div className="w-24 h-24 rounded-full bg-cta/10 flex items-center justify-center mx-auto border-4 border-card shadow-md">
              <StoreIcon className="w-10 h-10 text-cta" />
            </div>
          )}
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">{storeName}</h1>
          <p className="text-sm text-muted-foreground">
            {ads.length} {ads.length === 1 ? 'anúncio publicado' : 'anúncios publicados'}
          </p>
          <Button variant="cta" size="sm" onClick={handleShare}>
            <Share2 className="w-4 h-4" /> Compartilhar minha loja
          </Button>
        </div>
      </div>

      <main className="container max-w-5xl mx-auto px-4 py-6 pb-12">
        {ads.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-4xl mb-3">📭</p>
            <p className="font-semibold text-foreground">Nenhum anúncio publicado ainda</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
            {ads.map((ad) => (
              <button
                key={ad.id}
                onClick={() => navigate(`/ad/${ad.slug}`)}
                className="bg-card rounded-xl overflow-hidden border hover:shadow-lg transition-all text-left group"
              >
                <div className="aspect-square overflow-hidden bg-muted relative">
                  <img
                    src={ad.main_photo}
                    alt={ad.title}
                    loading="lazy"
                    decoding="async"
                    className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 ${ad.status === 'sold' ? 'grayscale opacity-75' : ''}`}
                  />
                  {ad.status === 'sold' && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                      <span className="bg-green-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-sm uppercase tracking-wider transform -rotate-12 border border-white shadow-sm">
                        Vendido
                      </span>
                    </div>
                  )}
                </div>
                <div className="p-3 space-y-1">
                  <p className="font-semibold text-foreground text-sm line-clamp-2 leading-tight">{ad.title}</p>
                  <p className="text-cta font-bold text-base">
                    R$ {Number(ad.price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                  {ad.region && <p className="text-xs text-muted-foreground">📍 {ad.region}</p>}
                </div>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
