import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Ad, useApp } from '@/contexts/AppContext';
import { AdForm } from '@/components/AdForm';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { DesktopShell } from '@/components/DesktopShell';

export default function EditAdPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { getAdBySlug, currentUser, loading } = useApp();
  const [ad, setAd] = useState<Ad | null>(null);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!loading && !currentUser) {
      navigate('/login', { replace: true });
    }
  }, [loading, currentUser, navigate]);

  useEffect(() => {
    if (slug) {
      getAdBySlug(slug).then(data => {
        setAd(data);
        setFetching(false);
      });
    }
  }, [slug]);

  if (fetching || loading) {
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
          <Button variant="cta" className="mt-4" onClick={() => navigate('/my-ads')}>
            Meus anúncios
          </Button>
        </div>
      </div>
    );
  }

  // Only owner (or admin) can edit
  const isOwner = currentUser?.user_id === ad.user_id;
  if (!isOwner && !currentUser?.is_admin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-4xl mb-4">🔒</p>
          <p className="font-semibold text-foreground">Você não tem permissão para editar este anúncio</p>
          <Button variant="cta" className="mt-4" onClick={() => navigate(`/ad/${ad.slug}`)}>
            Ver anúncio
          </Button>
        </div>
      </div>
    );
  }

  return (
    <DesktopShell>
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b sticky top-0 z-10 md:hidden">
        <div className="container max-w-lg mx-auto flex items-center gap-3 px-4 py-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/ad/${ad.slug}`)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-bold text-foreground">Editar anúncio</h1>
        </div>
      </header>

      <div className="container max-w-lg md:max-w-3xl mx-auto px-4 md:px-8 py-6 md:py-10">
        <div className="hidden md:block mb-6">
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Catálogo</p>
          <h1 className="text-2xl font-bold mt-1">Editar anúncio</h1>
        </div>
        <AdForm
          category={ad.category}
          ad={ad}
          onBack={() => navigate(`/ad/${ad.slug}`)}
        />
      </div>
    </div>
    </DesktopShell>
  );
}
