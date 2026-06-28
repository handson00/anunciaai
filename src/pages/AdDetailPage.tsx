import { useParams, useNavigate } from 'react-router-dom';
import { useApp, Ad } from '@/contexts/AppContext';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Phone, Share2, Copy, Check, Send, Loader2, Pencil, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';

const categoryLabels: Record<string, string> = {
  automobile: '🚗 Automóvel', product: '📦 Produto', property: '🏠 Imóvel', service: '🔧 Serviço',
};

const categoryEmoji: Record<string, string> = {
  automobile: '🚗', product: '🛒', property: '🏠', service: '🔧',
};

const statusLabels: Record<string, { label: string; class: string }> = {
  draft: { label: 'Rascunho', class: 'bg-muted text-muted-foreground' },
  ready: { label: 'Pronto', class: 'bg-secondary text-secondary-foreground' },
  published: { label: 'Publicado', class: 'bg-accent text-accent-foreground' },
  sold: { label: 'Vendido', class: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  error: { label: 'Erro', class: 'bg-destructive/10 text-destructive' },
};

export default function AdDetailPage() {
  const { slug } = useParams();
  const { getAdBySlug, currentUser, publishAd, updateAd } = useApp();
  const navigate = useNavigate();
  const [ad, setAd] = useState<Ad | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPhoto, setCurrentPhoto] = useState(0);
  const [copied, setCopied] = useState(false);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    if (slug) {
      getAdBySlug(slug).then(data => {
        setAd(data);
        setLoading(false);
      });
    }
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-cta border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!ad) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-4xl mb-4">😕</p>
          <p className="font-semibold text-foreground">Anúncio não encontrado</p>
          <Button variant="cta" className="mt-4" onClick={() => navigate('/')}>
            Voltar ao início
          </Button>
        </div>
      </div>
    );
  }

  const allPhotos = [ad.main_photo, ...(ad.photos || [])];
  const isOwner = currentUser?.user_id === ad.user_id;
  const canPublish = isOwner && (ad.status === 'draft' || ad.status === 'error' || ad.status === 'published');

  const generateWhatsAppText = () => {
    const catLabel = ad.category === 'automobile' ? 'AUTOMÓVEL' : ad.category === 'product' ? 'PRODUTO' : ad.category === 'property' ? 'IMÓVEL' : 'SERVIÇO';
    const emoji = categoryEmoji[ad.category];
    const lines = [
      `${emoji} *${catLabel}*`,
      '',
      `🏪 ${ad.user_name || 'Anunciante'}`,
      `📦 ${ad.title}`,
      `💰 R$ ${Number(ad.price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
    ];
    if (ad.region) lines.push(`📍 ${ad.region}`);
    if (ad.brand) lines.push(`🏷️ Marca: ${ad.brand}`);
    if (ad.condition) lines.push(`📋 ${ad.condition === 'new' ? 'Novo' : 'Usado'}`);
    lines.push('', `📝 ${ad.description}`, '', `📞 Contato: ${ad.contact_phone}`);
    lines.push('', `🔗 Ver mais: ${window.location.href}`);
    return lines.join('\n');
  };

  const handleShare = () => {
    const text = generateWhatsAppText();
    if (navigator.share) {
      navigator.share({ title: ad.title, text }).catch(() => {});
    } else {
      navigator.clipboard.writeText(text);
      toast.success('Texto do anúncio copiado!');
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    toast.success('Link copiado!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePublish = async () => {
    setPublishing(true);
    const result = await publishAd(ad.id);
    setPublishing(false);

    if (result.success) {
      toast.success('Anúncio publicado nos grupos!');
      setAd({ ...ad, status: 'published' });
    } else {
      toast.error(result.error || 'Erro ao publicar');
      setAd({ ...ad, status: 'error' });
    }
  };

  const st = statusLabels[ad.status] || statusLabels.draft;

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="bg-card/80 backdrop-blur-md border-b sticky top-0 z-10">
        <div className="container max-w-lg mx-auto flex items-center justify-between px-4 py-3">
          <Button variant="ghost" size="icon" aria-label="Voltar" onClick={() => navigate(isOwner ? '/my-ads' : '/')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-1 rounded-full font-medium ${st.class}`}>{st.label}</span>
            {isOwner && (
              <Button variant="ghost" size="icon" onClick={() => navigate(`/edit-ad/${ad.slug}`)} aria-label="Editar anúncio">
                <Pencil className="w-5 h-5" />
              </Button>
            )}
            <Button variant="ghost" size="icon" aria-label={copied ? 'Link copiado' : 'Copiar link'} onClick={handleCopyLink}>
              {copied ? <Check className="w-5 h-5 text-cta" /> : <Copy className="w-5 h-5" />}
            </Button>
            <Button variant="ghost" size="icon" aria-label="Compartilhar anúncio" onClick={handleShare}>
              <Share2 className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container max-w-lg mx-auto">
        {/* Photos */}
        <div className="relative bg-foreground/5">
          <img src={allPhotos[currentPhoto]} alt={ad.title} fetchPriority="high" decoding="async" className={`w-full aspect-[4/3] object-cover ${ad.status === 'sold' ? 'grayscale opacity-75' : ''}`} />
          {ad.status === 'sold' && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
              <span className="bg-green-600 text-white px-6 py-2 rounded-full font-bold text-xl uppercase tracking-wider transform -rotate-12 border-4 border-white shadow-lg">
                Vendido
              </span>
            </div>
          )}
          {allPhotos.length > 1 && (
            <>
              <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
                {allPhotos.map((_, i) => (
                  <button key={i} aria-label={`Ver foto ${i + 1}`} onClick={() => setCurrentPhoto(i)}
                    className={`w-2 h-2 rounded-full transition-all ${i === currentPhoto ? 'bg-card w-5' : 'bg-card/60'}`}
                  />
                ))}
              </div>
              <div className="absolute bottom-3 right-3 bg-foreground/60 text-card text-xs px-2 py-0.5 rounded-full">
                {currentPhoto + 1}/{allPhotos.length}
              </div>
            </>
          )}
        </div>

        {allPhotos.length > 1 && (
          <div className="flex gap-2 px-4 py-3 overflow-x-auto">
            {allPhotos.map((photo, i) => (
              <button key={i} aria-label={`Selecionar foto ${i + 1}`} onClick={() => setCurrentPhoto(i)}
                className={`flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-all ${
                  i === currentPhoto ? 'border-primary' : 'border-transparent opacity-60'
                }`}
              >
                <img src={photo} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}

        {/* Info */}
        <div className="px-4 py-5 space-y-4 animate-fade-in-up">
          <div>
            <span className="text-xs font-medium text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
              {categoryLabels[ad.category]}
            </span>
          </div>

          <h1 className="text-2xl font-bold text-foreground leading-tight">{ad.title}</h1>

          <p className="text-2xl font-bold text-cta">
            R$ {Number(ad.price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>

          <div className="flex flex-wrap gap-2">
            {ad.brand && (
              <span className="text-xs bg-secondary text-secondary-foreground px-3 py-1.5 rounded-full">
                🏷️ {ad.brand}
              </span>
            )}
            {ad.condition && (
              <span className="text-xs bg-secondary text-secondary-foreground px-3 py-1.5 rounded-full">
                {ad.condition === 'new' ? '✨ Novo' : '♻️ Usado'}
              </span>
            )}
            {ad.region && (
              <span className="text-xs bg-secondary text-secondary-foreground px-3 py-1.5 rounded-full">
                📍 {ad.region}
              </span>
            )}
          </div>

          <div className="border-t pt-4">
            <h2 className="font-semibold text-foreground mb-2">Descrição</h2>
            <p className="text-muted-foreground text-sm leading-relaxed whitespace-pre-wrap">{ad.description}</p>
          </div>

          <div className="border-t pt-4">
            <h2 className="font-semibold text-foreground mb-1">Anunciante</h2>
            <p className="text-muted-foreground text-sm">{ad.user_name || 'Anunciante'}</p>
            <p className="text-muted-foreground text-xs mt-0.5">
              Publicado em {new Date(ad.created_at).toLocaleDateString('pt-BR')}
            </p>
          </div>
        </div>
      </main>

      {/* Fixed Bottom */}
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t p-4 z-10">
        <div className="container max-w-lg mx-auto flex gap-3">
          {ad.status === 'sold' ? (
            <div className="flex-1 text-center py-2">
              <p className="text-green-600 font-bold text-lg flex items-center justify-center gap-2">
                Este item já foi vendido
              </p>
            </div>
          ) : (
            <>
              {canPublish && (
                <Button
                  variant="cta"
                  size="lg"
                  className={`flex-1 ${ad.status !== 'published' ? 'animate-[pulse-cta_2s_ease-in-out_infinite]' : ''}`}
                  onClick={handlePublish}
                  disabled={publishing}
                >
                  {publishing ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Send className="w-5 h-5" /> {ad.status === 'published' ? 'Republicar' : 'Publicar nos grupos'}</>}
                </Button>
              )}
              {(!isOwner || ad.status === 'published') && (
                <>
                  <Button variant="outline" size="lg" className="flex-1" onClick={handleShare}>
                    <Share2 className="w-5 h-5" /> Compartilhar
                  </Button>
                  {!isOwner && (
                    <Button variant="cta" size="lg" className="flex-1"
                      onClick={() => {
                        const msg = encodeURIComponent(`Olá! Vi seu anúncio "${ad.title}" na plataforma anunciaAI e gostaria de saber se ainda está disponível. 😊`);
                        window.open(`https://wa.me/55${ad.contact_phone}?text=${msg}`, '_blank');
                      }}>
                      <Phone className="w-5 h-5" /> Contato
                    </Button>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
