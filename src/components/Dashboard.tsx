import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp, Ad } from '@/contexts/AppContext';
import { Button } from '@/components/ui/button';
import { Plus, List, UserCog, LogOut, Shield } from 'lucide-react';
import logo from '@/assets/logo.png';

const statusLabels: Record<string, { label: string; class: string }> = {
  draft: { label: 'Rascunho', class: 'bg-muted text-muted-foreground' },
  ready: { label: 'Pronto', class: 'bg-secondary text-secondary-foreground' },
  published: { label: 'Publicado', class: 'bg-accent text-accent-foreground' },
  error: { label: 'Erro', class: 'bg-destructive/10 text-destructive' },
};

export function Dashboard() {
  const { currentUser, loading, logout, getUserAds } = useApp();
  const navigate = useNavigate();
  const [myAds, setMyAds] = useState<Ad[]>([]);

  useEffect(() => {
    if (!loading && !currentUser) {
      navigate('/', { replace: true });
    }
  }, [currentUser, loading, navigate]);

  useEffect(() => {
    if (currentUser) {
      getUserAds().then(setMyAds);
    }
  }, [currentUser]);

  const handleLogout = async () => {
    await logout();
    navigate('/', { replace: true });
  };

  if (loading || !currentUser) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b sticky top-0 z-10">
        <div className="container max-w-lg mx-auto flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <img src={logo} alt="anunciaAI" className="w-8 h-8" />
            <h1 className="text-lg font-bold">
              <span className="text-cta">anunci</span>AI
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {currentUser.is_admin && (
              <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}>
                <Shield className="w-5 h-5" />
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={handleLogout}>
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      <div className="container max-w-lg mx-auto px-4 py-6 space-y-6">
        <div className="animate-fade-in-up">
          <p className="text-muted-foreground text-sm">Olá,</p>
          <h2 className="text-2xl font-bold text-foreground">{currentUser.name} 👋</h2>
        </div>

        <div className="animate-fade-in-up" style={{ animationDelay: '100ms' }}>
          <Button
            variant="cta"
            size="xl"
            className="w-full h-16 text-lg rounded-2xl"
            onClick={() => navigate('/create-ad')}
          >
            <Plus className="w-6 h-6" />
            Anunciar agora
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
          <button
            onClick={() => navigate('/my-ads')}
            className="bg-card rounded-2xl p-5 text-left shadow-sm border hover:shadow-md transition-shadow active:scale-[0.97]"
          >
            <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center mb-3">
              <List className="w-5 h-5 text-accent-foreground" />
            </div>
            <p className="font-semibold text-foreground text-sm">Meus anúncios</p>
            <p className="text-xs text-muted-foreground mt-0.5">{myAds.length} anúncio{myAds.length !== 1 ? 's' : ''}</p>
          </button>

          <button
            onClick={() => navigate('/edit-profile')}
            className="bg-card rounded-2xl p-5 text-left shadow-sm border hover:shadow-md transition-shadow active:scale-[0.97]"
          >
            <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center mb-3">
              <UserCog className="w-5 h-5 text-secondary-foreground" />
            </div>
            <p className="font-semibold text-foreground text-sm">Editar cadastro</p>
            <p className="text-xs text-muted-foreground mt-0.5">Dados pessoais</p>
          </button>
        </div>

        {myAds.length > 0 && (
          <div className="animate-fade-in-up" style={{ animationDelay: '300ms' }}>
            <h3 className="font-semibold text-foreground mb-3">Últimos anúncios</h3>
            <div className="space-y-2">
              {myAds.slice(0, 3).map(ad => {
                const st = statusLabels[ad.status] || statusLabels.draft;
                return (
                  <button
                    key={ad.id}
                    onClick={() => navigate(`/ad/${ad.slug}`)}
                    className="w-full bg-card rounded-xl p-4 flex items-center gap-3 border shadow-sm hover:shadow-md transition-shadow active:scale-[0.98] text-left"
                  >
                    {ad.main_photo ? (
                      <img src={ad.main_photo} alt="" className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-14 h-14 rounded-lg bg-muted flex-shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground text-sm truncate">{ad.title}</p>
                      <p className="text-cta font-bold text-sm">
                        R$ {Number(ad.price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${st.class}`}>
                      {st.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
