import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp, AdCategory, Ad, Profile } from '@/contexts/AppContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Users, Megaphone, Trash2, Ban, CheckCircle, Search, ChevronDown, ChevronUp, Plus, Radio, X, Pencil, Save, RefreshCw, Download, Settings, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

const categoryLabels: Record<AdCategory, string> = {
  automobile: 'Automóvel', product: 'Produto', property: 'Imóvel', service: 'Serviço',
};

interface CommunityGroup {
  id: string;
  name: string;
  whatsapp_group_id: string;
  active: boolean;
  category: string | null;
}

export default function AdminPage() {
  const { currentUser, fetchAds, fetchUsers, ads, users, deleteAd } = useApp();
  const navigate = useNavigate();
  const [tab, setTab] = useState<'ads' | 'users' | 'groups' | 'settings'>('ads');
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<AdCategory | ''>('');
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [groups, setGroups] = useState<CommunityGroup[]>([]);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupId, setNewGroupId] = useState('');
  const [newGroupCategory, setNewGroupCategory] = useState('');
  const [editingGroup, setEditingGroup] = useState<CommunityGroup | null>(null);
  const [editName, setEditName] = useState('');
  const [editWhatsappId, setEditWhatsappId] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [whatsappGroups, setWhatsappGroups] = useState<any[]>([]);
  const [loadingWaGroups, setLoadingWaGroups] = useState(false);
  const [settingsUrl, setSettingsUrl] = useState('');
  const [settingsToken, setSettingsToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'connected' | 'error'>('idle');
  const [connectionInfo, setConnectionInfo] = useState<string>('');
  const [webhookUrl, setWebhookUrl] = useState('');

  useEffect(() => {
    if (currentUser?.is_admin) {
      fetchAds();
      fetchUsers();
      loadGroups();
      loadSettings();
    }
  }, [currentUser]);

  const loadSettings = async () => {
    const { data } = await supabase.from('app_settings').select('*').in('key', ['uazapi_server_url', 'uazapi_instance_token', 'webhook_url']);
    let hasUrl = false, hasToken = false;
    if (data) {
      for (const s of data) {
        if (s.key === 'uazapi_server_url') { setSettingsUrl(s.value); hasUrl = true; }
        if (s.key === 'uazapi_instance_token') { setSettingsToken(s.value); hasToken = true; }
        if (s.key === 'webhook_url') setWebhookUrl(s.value);
      }
    }
    if (hasUrl && hasToken) {
      // Auto-test on load
      setTimeout(() => testConnection(), 500);
    }
  };

  const testConnection = async () => {
    setConnectionStatus('testing');
    setConnectionInfo('Testando conexão...');
    try {
      const { data, error } = await supabase.functions.invoke('listar-grupos-whatsapp');
      if (error || data?.error) {
        setConnectionStatus('error');
        setConnectionInfo(data?.error || error?.message || 'Falha na conexão');
        return;
      }
      const count = data?.groups?.length || 0;
      setConnectionStatus('connected');
      setConnectionInfo(`Conectado · ${count} grupo(s) encontrado(s)`);
    } catch {
      setConnectionStatus('error');
      setConnectionInfo('Não foi possível conectar à API');
    }
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      for (const { key, value } of [
        { key: 'uazapi_server_url', value: settingsUrl.trim() },
        { key: 'uazapi_instance_token', value: settingsToken.trim() },
        { key: 'webhook_url', value: webhookUrl.trim() },
      ]) {
        if (!value) continue;
        const { data: existing } = await supabase.from('app_settings').select('id').eq('key', key).single();
        if (existing) {
          await supabase.from('app_settings').update({ value, updated_at: new Date().toISOString() }).eq('key', key);
        } else {
          await supabase.from('app_settings').insert({ key, value });
        }
      }
      toast.success('Configurações salvas');
      // Auto-test connection after saving
      await testConnection();
    } catch {
      toast.error('Erro ao salvar configurações');
    } finally {
      setSavingSettings(false);
    }
  };

  const loadGroups = async () => {
    const { data } = await supabase.from('community_groups').select('*').order('created_at', { ascending: false });
    setGroups((data || []) as CommunityGroup[]);
  };

  if (!currentUser?.is_admin) {
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
    const matchSearch = ad.title.toLowerCase().includes(search.toLowerCase());
    const matchCategory = !filterCategory || ad.category === filterCategory;
    return matchSearch && matchCategory;
  });

  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) || u.phone.includes(search)
  );

  const handleDeleteAd = async (id: string) => {
    if (confirm('Excluir este anúncio?')) {
      await deleteAd(id);
      fetchAds();
      toast.success('Anúncio excluído');
    }
  };

  const handleToggleBlock = async (userId: string, blocked: boolean) => {
    await supabase.from('profiles').update({ blocked: !blocked }).eq('user_id', userId);
    fetchUsers();
    toast.success(blocked ? 'Anunciante desbloqueado' : 'Anunciante bloqueado');
  };

  const fetchWhatsappGroups = async () => {
    setLoadingWaGroups(true);
    try {
      const { data, error } = await supabase.functions.invoke('listar-grupos-whatsapp');
      if (error) {
        toast.error('Erro ao buscar grupos do WhatsApp');
        console.error(error);
        return;
      }
      if (data?.error) {
        toast.error(data.error);
        return;
      }
      setWhatsappGroups(data?.groups || []);
      toast.success(`${(data?.groups || []).length} grupos encontrados`);
    } catch (err) {
      toast.error('Erro ao conectar com WhatsApp');
    } finally {
      setLoadingWaGroups(false);
    }
  };

  const handleImportGroup = async (waGroup: any) => {
    const existingIds = groups.map(g => g.whatsapp_group_id);
    const groupId = waGroup.JID || waGroup.id || waGroup.jid || waGroup.groupId;
    const groupName = waGroup.Name || waGroup.subject || waGroup.name || 'Grupo';
    
    if (existingIds.includes(groupId)) {
      toast.info('Grupo já cadastrado');
      return;
    }

    await supabase.from('community_groups').insert({
      name: groupName,
      whatsapp_group_id: groupId,
    });
    loadGroups();
    toast.success(`Grupo "${groupName}" importado`);
  };

  const handleAddGroup = async () => {
    if (!newGroupName.trim() || !newGroupId.trim()) {
      toast.error('Preencha nome e ID do grupo');
      return;
    }
    await supabase.from('community_groups').insert({
      name: newGroupName.trim(),
      whatsapp_group_id: newGroupId.trim(),
      category: newGroupCategory.trim() || null,
    });
    setNewGroupName('');
    setNewGroupId('');
    setNewGroupCategory('');
    loadGroups();
    toast.success('Grupo adicionado');
  };

  const handleToggleGroup = async (id: string, active: boolean) => {
    await supabase.from('community_groups').update({ active: !active }).eq('id', id);
    loadGroups();
  };

  const handleDeleteGroup = async (id: string) => {
    if (confirm('Remover este grupo?')) {
      await supabase.from('community_groups').delete().eq('id', id);
      loadGroups();
      toast.success('Grupo removido');
    }
  };

  const handleStartEdit = (group: CommunityGroup) => {
    setEditingGroup(group);
    setEditName(group.name);
    setEditWhatsappId(group.whatsapp_group_id);
    setEditCategory(group.category || '');
  };

  const handleSaveEdit = async () => {
    if (!editingGroup || !editName.trim() || !editWhatsappId.trim()) {
      toast.error('Preencha nome e ID do grupo');
      return;
    }
    await supabase.from('community_groups').update({
      name: editName.trim(),
      whatsapp_group_id: editWhatsappId.trim(),
      category: editCategory.trim() || null,
    }).eq('id', editingGroup.id);
    setEditingGroup(null);
    loadGroups();
    toast.success('Grupo atualizado');
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
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-card border rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{ads.length}</p>
            <p className="text-xs text-muted-foreground">Anúncios</p>
          </div>
          <div className="bg-card border rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{users.length}</p>
            <p className="text-xs text-muted-foreground">Anunciantes</p>
          </div>
          <div className="bg-card border rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{groups.filter(g => g.active).length}</p>
            <p className="text-xs text-muted-foreground">Grupos</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          {[
            { key: 'ads' as const, icon: Megaphone, label: 'Anúncios' },
            { key: 'users' as const, icon: Users, label: 'Anunciantes' },
            { key: 'groups' as const, icon: Radio, label: 'Grupos' },
            { key: 'settings' as const, icon: Settings, label: 'Config' },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setSearch(''); }}
              className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                tab === t.key ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
              }`}
            >
              <t.icon className="w-4 h-4 inline mr-1" />
              {t.label}
            </button>
          ))}
        </div>

        {/* Search */}
        {tab !== 'groups' && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={tab === 'ads' ? 'Buscar anúncio...' : 'Buscar anunciante...'}
              className="pl-10 h-11 rounded-xl"
            />
          </div>
        )}

        {/* Category Filter */}
        {tab === 'ads' && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button onClick={() => setFilterCategory('')}
              className={`text-xs px-3 py-1.5 rounded-full whitespace-nowrap font-medium ${!filterCategory ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'}`}>
              Todos
            </button>
            {(Object.keys(categoryLabels) as AdCategory[]).map(cat => (
              <button key={cat} onClick={() => setFilterCategory(cat)}
                className={`text-xs px-3 py-1.5 rounded-full whitespace-nowrap font-medium ${filterCategory === cat ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'}`}>
                {categoryLabels[cat]}
              </button>
            ))}
          </div>
        )}

        {/* Content */}
        {tab === 'ads' && (
          <div className="space-y-2">
            {filteredAds.length === 0 ? (
              <p className="text-center text-muted-foreground py-8 text-sm">Nenhum anúncio encontrado</p>
            ) : filteredAds.map(ad => (
              <div key={ad.id} className="bg-card border rounded-xl p-3 flex items-center gap-3">
                {ad.main_photo ? (
                  <img src={ad.main_photo} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-muted flex-shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground text-sm truncate">{ad.title}</p>
                  <p className="text-xs text-muted-foreground">{categoryLabels[ad.category]} · {ad.status}</p>
                  <p className="text-cta text-sm font-bold">R$ {Number(ad.price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
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
        )}

        {tab === 'users' && (
          <div className="space-y-2">
            {filteredUsers.length === 0 ? (
              <p className="text-center text-muted-foreground py-8 text-sm">Nenhum anunciante encontrado</p>
            ) : filteredUsers.map(user => (
              <div key={user.id} className="bg-card border rounded-xl overflow-hidden">
                <button
                  onClick={() => setExpandedUser(expandedUser === user.user_id ? null : user.user_id)}
                  className="w-full p-4 flex items-center gap-3 active:scale-[0.98] transition-transform"
                >
                  <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center flex-shrink-0">
                    <span className="font-bold text-accent-foreground text-sm">{user.name.charAt(0).toUpperCase()}</span>
                  </div>
                  <div className="min-w-0 flex-1 text-left">
                    <p className="font-medium text-foreground text-sm">{user.name}</p>
                    <p className="text-xs text-muted-foreground">{user.phone}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {user.blocked && <span className="text-xs bg-destructive/10 text-destructive px-2 py-0.5 rounded-full font-medium">Bloqueado</span>}
                    {expandedUser === user.user_id ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </button>

                {expandedUser === user.user_id && (
                  <div className="border-t px-4 pb-4 pt-3 space-y-3">
                    <div className="flex justify-end">
                      <Button
                        variant={user.blocked ? 'outline' : 'ghost'}
                        size="sm"
                        onClick={() => handleToggleBlock(user.user_id, user.blocked)}
                        className={user.blocked ? 'text-cta' : 'text-destructive'}
                      >
                        {user.blocked ? <><CheckCircle className="w-4 h-4" /> Desbloquear</> : <><Ban className="w-4 h-4" /> Bloquear</>}
                      </Button>
                    </div>
                    {(() => {
                      const userAds = ads.filter(a => a.user_id === user.user_id);
                      if (userAds.length === 0) return <p className="text-xs text-muted-foreground text-center py-2">Nenhum anúncio</p>;
                      return userAds.map(ad => (
                        <div key={ad.id} className="bg-secondary/50 rounded-lg p-3 flex items-center gap-3">
                          {ad.main_photo ? (
                            <img src={ad.main_photo} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-muted flex-shrink-0" />
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-foreground text-xs truncate">{ad.title}</p>
                            <p className="text-cta text-xs font-bold">R$ {Number(ad.price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                          </div>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(`/ad/${ad.slug}`)}>
                              <Search className="w-3.5 h-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDeleteAd(ad.id)}>
                              <Trash2 className="w-3.5 h-3.5 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {tab === 'groups' && (
          <div className="space-y-4">
            {/* Fetch from WhatsApp */}
            <div className="bg-card border rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-foreground text-sm">Importar do WhatsApp</h3>
                <Button variant="cta" size="sm" onClick={fetchWhatsappGroups} disabled={loadingWaGroups}>
                  {loadingWaGroups ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  {loadingWaGroups ? 'Buscando...' : 'Buscar grupos'}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Busca os grupos/comunidades direto do WhatsApp conectado via UazAPI</p>
              {whatsappGroups.length > 0 && (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {whatsappGroups.map((wg: any, idx: number) => {
                    const groupId = wg.JID || wg.id || wg.jid || wg.groupId || '';
                    const groupName = wg.Name || wg.subject || wg.name || 'Grupo';
                    const isImported = groups.some(g => g.whatsapp_group_id === groupId);
                    return (
                      <div key={groupId || idx} className="flex items-center gap-3 bg-secondary/50 rounded-lg p-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-foreground text-sm truncate">{groupName}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{groupId}</p>
                        </div>
                        {isImported ? (
                          <span className="text-xs text-muted-foreground">✓ Importado</span>
                        ) : (
                          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => handleImportGroup(wg)}>
                            <Download className="w-3.5 h-3.5" /> Importar
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Edit modal */}
            {editingGroup && (
              <div className="bg-card border-2 border-primary rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-foreground text-sm">Editar grupo</h3>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingGroup(null)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                <Input value={editName} onChange={e => setEditName(e.target.value)}
                  placeholder="Nome do grupo" className="h-11 rounded-xl" />
                <Input value={editWhatsappId} onChange={e => setEditWhatsappId(e.target.value)}
                  placeholder="ID do grupo no WhatsApp" className="h-11 rounded-xl" />
                <Input value={editCategory} onChange={e => setEditCategory(e.target.value)}
                  placeholder="Categoria (opcional)" className="h-11 rounded-xl" />
                <Button variant="cta" size="sm" className="w-full" onClick={handleSaveEdit}>
                  <Save className="w-4 h-4" /> Salvar alterações
                </Button>
              </div>
            )}

            {/* Manual add (collapsed) */}
            {!editingGroup && (
              <details className="bg-card border rounded-xl overflow-hidden">
                <summary className="p-4 cursor-pointer font-semibold text-foreground text-sm">
                  Adicionar manualmente
                </summary>
                <div className="px-4 pb-4 space-y-3">
                  <Input value={newGroupName} onChange={e => setNewGroupName(e.target.value)}
                    placeholder="Nome do grupo" className="h-11 rounded-xl" />
                  <Input value={newGroupId} onChange={e => setNewGroupId(e.target.value)}
                    placeholder="ID do grupo (ex: 120363...@g.us)" className="h-11 rounded-xl" />
                  <Input value={newGroupCategory} onChange={e => setNewGroupCategory(e.target.value)}
                    placeholder="Categoria (opcional)" className="h-11 rounded-xl" />
                  <Button variant="cta" size="sm" className="w-full" onClick={handleAddGroup}>
                    <Plus className="w-4 h-4" /> Adicionar grupo
                  </Button>
                </div>
              </details>
            )}

            {/* Group list */}
            <div className="space-y-2">
              <h3 className="font-semibold text-foreground text-sm">Grupos cadastrados ({groups.length})</h3>
              {groups.length === 0 ? (
                <p className="text-center text-muted-foreground py-4 text-sm">Nenhum grupo cadastrado</p>
              ) : groups.map(group => (
                <div key={group.id} className="bg-card border rounded-xl p-4 space-y-2">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full flex-shrink-0 ${group.active ? 'bg-cta' : 'bg-muted-foreground/30'}`} />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground text-sm">{group.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{group.whatsapp_group_id}</p>
                      {group.category && (
                        <span className="text-[10px] bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full mt-1 inline-block">
                          {group.category}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleStartEdit(group)}>
                        <Pencil className="w-4 h-4 text-muted-foreground" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8"
                        onClick={() => handleToggleGroup(group.id, group.active)}>
                        {group.active ? <Ban className="w-4 h-4 text-muted-foreground" /> : <CheckCircle className="w-4 h-4 text-cta" />}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDeleteGroup(group.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pl-6">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${group.active ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground'}`}>
                      {group.active ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'settings' && (
          <div className="space-y-4">
            <div className="bg-card border rounded-xl p-4 space-y-4">
              <h3 className="font-semibold text-foreground text-sm">Configuração UazAPI</h3>
              <p className="text-xs text-muted-foreground">Configure a URL e o token da sua instância UazAPI para integração com WhatsApp.</p>
              
              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground">URL do servidor</label>
                <Input
                  value={settingsUrl}
                  onChange={e => setSettingsUrl(e.target.value)}
                  placeholder="https://sua-instancia.uazapi.com"
                  className="h-11 rounded-xl"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground">Token da instância</label>
                <div className="relative">
                  <Input
                    value={settingsToken}
                    onChange={e => setSettingsToken(e.target.value)}
                    placeholder="Seu token de autenticação"
                    type={showToken ? 'text' : 'password'}
                    className="h-11 rounded-xl pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <Button variant="cta" className="w-full" onClick={handleSaveSettings} disabled={savingSettings}>
                <Save className="w-4 h-4" />
                {savingSettings ? 'Salvando...' : 'Salvar configurações'}
              </Button>
            </div>

            {/* Connection Status */}
            <div className="bg-card border rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-foreground text-sm">Status da Conexão</h3>
                <Button variant="outline" size="sm" onClick={testConnection} disabled={connectionStatus === 'testing'}>
                  <RefreshCw className={`w-4 h-4 ${connectionStatus === 'testing' ? 'animate-spin' : ''}`} />
                  Testar
                </Button>
              </div>

              <div className="flex items-center gap-3 bg-secondary/50 rounded-lg p-3">
                <div className={`w-3 h-3 rounded-full flex-shrink-0 ${
                  connectionStatus === 'connected' ? 'bg-green-500' :
                  connectionStatus === 'error' ? 'bg-destructive' :
                  connectionStatus === 'testing' ? 'bg-yellow-500 animate-pulse' :
                  'bg-muted-foreground/30'
                }`} />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground text-sm">UazAPI</p>
                  <p className="text-xs text-muted-foreground">
                    {connectionStatus === 'idle' && 'Salve as configurações para testar'}
                    {connectionStatus === 'testing' && 'Testando conexão...'}
                    {connectionStatus === 'connected' && connectionInfo}
                    {connectionStatus === 'error' && connectionInfo}
                  </p>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                  connectionStatus === 'connected' ? 'bg-green-500/10 text-green-600' :
                  connectionStatus === 'error' ? 'bg-destructive/10 text-destructive' :
                  connectionStatus === 'testing' ? 'bg-yellow-500/10 text-yellow-600' :
                  'bg-muted text-muted-foreground'
                }`}>
                  {connectionStatus === 'connected' ? 'Conectado' :
                   connectionStatus === 'error' ? 'Erro' :
                   connectionStatus === 'testing' ? 'Testando' :
                   'Aguardando'}
                </span>
              </div>
            </div>

            <div className="bg-secondary/50 border rounded-xl p-4">
              <p className="text-xs text-muted-foreground">
                💡 As configurações salvas aqui têm prioridade sobre as variáveis de ambiente do servidor. 
                Deixe os campos vazios para usar as variáveis de ambiente padrão.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
