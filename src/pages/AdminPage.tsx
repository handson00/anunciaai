import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp, AdCategory } from '@/contexts/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Users, Megaphone, Trash2, Ban, CheckCircle, Search } from 'lucide-react';
import { toast } from 'sonner';

const categoryLabels: Record<AdCategory, string> = {
  automobile: 'Automóvel', product: 'Produto', property: 'Imóvel', service: 'Serviço',
};

export default function AdminPage() {
  const { currentUser, users, ads, deleteAd, updateAd, updateUser } = useApp();
  const navigate = useNavigate();
  const [tab, setTab] = useState<'ads' | 'users'>('ads');
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<AdCategory | ''>('');

  if (!currentUser?.isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-4xl mb-4">🔒</p>
          <p className="font-semibold text-foreground">Acesso restrito</p>
          <Button variant="cta" className="mt-4" onClick={() => navigate('/dashboard')}>Voltar</Button>
        </div>
      </div>
    );
  }

  const filteredAds = ads.filter(ad => {
    const matchSearch = ad.title.toLowerCase().includes(search.toLowerCase()) ||
      ad.userName.toLowerCase().includes(search.toLowerCase());
    const matchCategory = !filterCategory || ad.category === filterCategory;
    return matchSearch && matchCategory;
  });

  const filteredUsers = users.filter(u =>
    !u.isAdmin && (u.name.toLowerCase().includes(search.toLowerCase()) || u.phone.includes(search))
  );

  const handleDeleteAd = (id: string) => {
    if (confirm('Excluir este anúncio?')) {
      deleteAd(id);
      toast.success('Anúncio excluído');
    }
  };

  const handleToggleBlock = (userId: string, blocked: boolean) => {
    updateUser(userId, { blocked: !blocked });
    toast.success(blocked ? 'Anunciante desbloqueado' : 'Anunciante bloqueado');
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b sticky top-0 z-10">
        <div className="container max-w-2xl mx-auto flex items-center gap-3 px-4 py-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-bold text-foreground">Painel Administrativo</h1>
        </div>
      </header>

      <div className="container max-w-2xl mx-auto px-4 py-4 space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-card border rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{ads.length}</p>
            <p className="text-xs text-muted-foreground">Anúncios</p>
          </div>
          <div className="bg-card border rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{users.filter(u => !u.isAdmin).length}</p>
            <p className="text-xs text-muted-foreground">Anunciantes</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          <button
            onClick={() => { setTab('ads'); setSearch(''); }}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              tab === 'ads' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
            }`}
          >
            <Megaphone className="w-4 h-4 inline mr-1.5" />
            Anúncios
          </button>
          <button
            onClick={() => { setTab('users'); setSearch(''); }}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              tab === 'users' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
            }`}
          >
            <Users className="w-4 h-4 inline mr-1.5" />
            Anunciantes
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={tab === 'ads' ? 'Buscar anúncio...' : 'Buscar anunciante...'}
            className="pl-10 h-11 rounded-xl"
          />
        </div>

        {/* Category Filter for Ads */}
        {tab === 'ads' && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setFilterCategory('')}
              className={`text-xs px-3 py-1.5 rounded-full whitespace-nowrap font-medium transition-all ${
                !filterCategory ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
              }`}
            >
              Todos
            </button>
            {(Object.keys(categoryLabels) as AdCategory[]).map(cat => (
              <button
                key={cat}
                onClick={() => setFilterCategory(cat)}
                className={`text-xs px-3 py-1.5 rounded-full whitespace-nowrap font-medium transition-all ${
                  filterCategory === cat ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
                }`}
              >
                {categoryLabels[cat]}
              </button>
            ))}
          </div>
        )}

        {/* Content */}
        {tab === 'ads' ? (
          <div className="space-y-2">
            {filteredAds.length === 0 ? (
              <p className="text-center text-muted-foreground py-8 text-sm">Nenhum anúncio encontrado</p>
            ) : filteredAds.map(ad => (
              <div key={ad.id} className="bg-card border rounded-xl p-3 flex items-center gap-3">
                {ad.mainPhoto ? (
                  <img src={ad.mainPhoto} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-muted flex-shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground text-sm truncate">{ad.title}</p>
                  <p className="text-xs text-muted-foreground">{ad.userName} · {categoryLabels[ad.category]}</p>
                  <p className="text-cta text-sm font-bold">R$ {ad.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => navigate(`/ad/${ad.slug}`)}>
                    <Search className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDeleteAd(ad.id)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredUsers.length === 0 ? (
              <p className="text-center text-muted-foreground py-8 text-sm">Nenhum anunciante encontrado</p>
            ) : filteredUsers.map(user => (
              <div key={user.id} className="bg-card border rounded-xl p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center flex-shrink-0">
                  <span className="font-bold text-accent-foreground text-sm">
                    {user.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground text-sm">{user.name}</p>
                  <p className="text-xs text-muted-foreground">{user.phone}</p>
                  <p className="text-xs text-muted-foreground">
                    {ads.filter(a => a.userId === user.id).length} anúncio(s)
                  </p>
                </div>
                <Button
                  variant={user.blocked ? 'outline' : 'ghost'}
                  size="sm"
                  onClick={() => handleToggleBlock(user.id, user.blocked)}
                  className={user.blocked ? 'text-cta' : 'text-destructive'}
                >
                  {user.blocked ? (
                    <><CheckCircle className="w-4 h-4" /> Desbloquear</>
                  ) : (
                    <><Ban className="w-4 h-4" /> Bloquear</>
                  )}
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
