import { useNavigate } from 'react-router-dom';
import { useApp, Ad } from '@/contexts/AppContext';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useState, useEffect } from 'react';

const categoryEmoji: Record<string, string> = {
  automobile: '🚗', product: '📦', property: '🏠', service: '🔧',
};

const statusLabels: Record<string, { label: string; class: string }> = {
  draft: { label: 'Rascunho', class: 'bg-muted text-muted-foreground' },
  ready: { label: 'Pronto', class: 'bg-secondary text-secondary-foreground' },
  published: { label: 'Publicado', class: 'bg-accent text-accent-foreground' },
  error: { label: 'Erro', class: 'bg-destructive/10 text-destructive' },
};

export default function MyAdsPage() {
  const { getUserAds, deleteAd } = useApp();
  const navigate = useNavigate();
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getUserAds().then(data => {
      setAds(data);
      setLoading(false);
    });
  }, []);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Deseja excluir este anúncio?')) {
      await deleteAd(id);
      setAds(prev => prev.filter(a => a.id !== id));
      toast.success('Anúncio excluído');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b sticky top-0 z-10">
        <div className="container max-w-lg mx-auto flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="font-bold text-foreground">Meus anúncios</h1>
          </div>
          <Button variant="cta" size="sm" onClick={() => navigate('/create-ad')}>
            <Plus className="w-4 h-4" /> Novo
          </Button>
        </div>
      </header>

      <div className="container max-w-lg mx-auto px-4 py-6">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-cta border-t-transparent rounded-full animate-spin" />
          </div>
        ) : ads.length === 0 ? (
          <div className="text-center py-16 animate-fade-in-up">
            <p className="text-4xl mb-4">📋</p>
            <p className="font-semibold text-foreground mb-1">Nenhum anúncio ainda</p>
            <p className="text-sm text-muted-foreground mb-6">Crie seu primeiro anúncio agora!</p>
            <Button variant="cta" onClick={() => navigate('/create-ad')}>
              <Plus className="w-5 h-5" /> Anunciar agora
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {ads.map((ad, i) => {
              const st = statusLabels[ad.status] || statusLabels.draft;
              return (
                <div
                  key={ad.id}
                  onClick={() => navigate(`/ad/${ad.slug}`)}
                  className="bg-card rounded-xl p-4 flex items-center gap-3 border shadow-sm hover:shadow-md transition-shadow cursor-pointer active:scale-[0.98] animate-fade-in-up"
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  {ad.main_photo ? (
                    <img src={ad.main_photo} alt="" className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 text-2xl">
                      {categoryEmoji[ad.category]}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground text-sm truncate">{ad.title}</p>
                    <p className="text-cta font-bold text-sm">
                      R$ {Number(ad.price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${st.class}`}>{st.label}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(ad.created_at).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => handleDelete(ad.id, e)}
                    className="p-2 text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
