import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '@/contexts/AppContext';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Phone, Share2, Copy, Check } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

const categoryLabels: Record<string, string> = {
  automobile: '🚗 Automóvel', product: '📦 Produto', property: '🏠 Imóvel', service: '🔧 Serviço',
};

const categoryEmoji: Record<string, string> = {
  automobile: '🚗', product: '🛒', property: '🏠', service: '🔧',
};

export default function AdDetailPage() {
  const { slug } = useParams();
  const { getAdBySlug } = useApp();
  const navigate = useNavigate();
  const [currentPhoto, setCurrentPhoto] = useState(0);
  const [copied, setCopied] = useState(false);

  const ad = getAdBySlug(slug || '');

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

  const allPhotos = [ad.mainPhoto, ...ad.photos];

  const generateWhatsAppText = () => {
    const emoji = categoryEmoji[ad.category];
    const lines = [
      `${emoji} *${ad.category === 'automobile' ? 'AUTOMÓVEL' : ad.category === 'product' ? 'PRODUTO' : ad.category === 'property' ? 'IMÓVEL' : 'SERVIÇO'}*`,
      '',
      `🏪 ${ad.userName}`,
      `📦 ${ad.title}`,
      `💰 R$ ${ad.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
    ];
    if (ad.brand) lines.push(`🏷️ Marca: ${ad.brand}`);
    if (ad.condition) lines.push(`📋 ${ad.condition === 'new' ? 'Novo' : 'Usado'}`);
    lines.push('', `📝 ${ad.description}`, '', `📞 Contato: ${ad.contactPhone}`);
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

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="bg-card/80 backdrop-blur-md border-b sticky top-0 z-10">
        <div className="container max-w-lg mx-auto flex items-center justify-between px-4 py-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" onClick={handleCopyLink}>
              {copied ? <Check className="w-5 h-5 text-cta" /> : <Copy className="w-5 h-5" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={handleShare}>
              <Share2 className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      <div className="container max-w-lg mx-auto">
        {/* Photos */}
        <div className="relative bg-foreground/5">
          <img
            src={allPhotos[currentPhoto]}
            alt={ad.title}
            className="w-full aspect-[4/3] object-cover"
          />
          {allPhotos.length > 1 && (
            <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
              {allPhotos.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentPhoto(i)}
                  className={`w-2 h-2 rounded-full transition-all ${
                    i === currentPhoto ? 'bg-card w-5' : 'bg-card/60'
                  }`}
                />
              ))}
            </div>
          )}
          {allPhotos.length > 1 && (
            <div className="absolute bottom-3 right-3 bg-foreground/60 text-card text-xs px-2 py-0.5 rounded-full">
              {currentPhoto + 1}/{allPhotos.length}
            </div>
          )}
        </div>

        {/* Thumbnails */}
        {allPhotos.length > 1 && (
          <div className="flex gap-2 px-4 py-3 overflow-x-auto">
            {allPhotos.map((photo, i) => (
              <button
                key={i}
                onClick={() => setCurrentPhoto(i)}
                className={`flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-all ${
                  i === currentPhoto ? 'border-primary' : 'border-transparent opacity-60'
                }`}
              >
                <img src={photo} alt="" className="w-full h-full object-cover" />
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
            R$ {ad.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
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
          </div>

          <div className="border-t pt-4">
            <h3 className="font-semibold text-foreground mb-2">Descrição</h3>
            <p className="text-muted-foreground text-sm leading-relaxed whitespace-pre-wrap">
              {ad.description}
            </p>
          </div>

          <div className="border-t pt-4">
            <h3 className="font-semibold text-foreground mb-1">Anunciante</h3>
            <p className="text-muted-foreground text-sm">{ad.userName}</p>
            <p className="text-muted-foreground text-xs mt-0.5">
              Publicado em {new Date(ad.createdAt).toLocaleDateString('pt-BR')}
            </p>
          </div>
        </div>
      </div>

      {/* Fixed Bottom CTA */}
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t p-4 z-10">
        <div className="container max-w-lg mx-auto flex gap-3">
          <Button
            variant="outline"
            size="lg"
            className="flex-1"
            onClick={handleShare}
          >
            <Share2 className="w-5 h-5" />
            Compartilhar
          </Button>
          <Button
            variant="cta"
            size="lg"
            className="flex-1"
            onClick={() => window.open(`https://wa.me/55${ad.contactPhone}`, '_blank')}
          >
            <Phone className="w-5 h-5" />
            Contato
          </Button>
        </div>
      </div>
    </div>
  );
}
