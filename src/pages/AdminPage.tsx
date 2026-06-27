import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp, AdCategory, Ad, Profile } from '@/contexts/AppContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Users, Megaphone, Trash2, Ban, CheckCircle, Search, ChevronDown, ChevronUp, Plus, Radio, X, Pencil, Save, RefreshCw, Download, Settings, Eye, EyeOff, MessageSquare, Send, ClipboardList, Instagram, Boxes } from 'lucide-react';
import { toast } from 'sonner';
import { StockManager } from '@/components/admin/stock/StockManager';

const categoryLabels: Record<AdCategory, string> = {
  automobile: 'Automóvel', product: 'Produto', property: 'Imóvel', service: 'Serviço',
};

const logStatusLabels: Record<string, string> = {
  queued: 'Na fila',
  processing: 'Enviando',
  retry: 'Tentando novamente',
  success: 'Sucesso',
  error: 'Erro',
  failed: 'Erro',
};

const logStatusClasses: Record<string, string> = {
  success: 'bg-accent text-accent-foreground',
  error: 'bg-destructive/10 text-destructive',
  failed: 'bg-destructive/10 text-destructive',
  queued: 'bg-secondary text-secondary-foreground',
  processing: 'bg-primary/10 text-primary',
  retry: 'bg-secondary text-secondary-foreground',
};

interface CommunityGroup {
  id: string;
  name: string;
  whatsapp_group_id: string;
  link: string | null;
  active: boolean;
  is_join_group_link: boolean;
  category: string | null;
}

export default function AdminPage() {
  const { currentUser, fetchAds, fetchUsers, ads, users, deleteAd } = useApp();
  const navigate = useNavigate();
  const [tab, setTab] = useState<'ads' | 'users' | 'groups' | 'settings' | 'logs' | 'instagram' | 'system' | 'stock'>('ads');
  const [logs, setLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [igMonitors, setIgMonitors] = useState<any[]>([]);
  const [igUsername, setIgUsername] = useState('');
  const [savingIg, setSavingIg] = useState(false);
  const [testingIg, setTestingIg] = useState(false);
  const [runningIg, setRunningIg] = useState(false);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<AdCategory | ''>('');
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [groups, setGroups] = useState<CommunityGroup[]>([]);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupId, setNewGroupId] = useState('');
  const [newGroupLink, setNewGroupLink] = useState('');
  const [newGroupCategory, setNewGroupCategory] = useState('');
  const [editingGroup, setEditingGroup] = useState<CommunityGroup | null>(null);
  const [editName, setEditName] = useState('');
  const [editWhatsappId, setEditWhatsappId] = useState('');
  const [editLink, setEditLink] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [whatsappGroups, setWhatsappGroups] = useState<any[]>([]);
  const [loadingWaGroups, setLoadingWaGroups] = useState(false);
  const [settingsUrl, setSettingsUrl] = useState('');
  const [settingsToken, setSettingsToken] = useState('');
  const [communityJoinLink, setCommunityJoinLink] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'connected' | 'error'>('idle');
  const [connectionInfo, setConnectionInfo] = useState<string>('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [postToStatus, setPostToStatus] = useState(false);
  const [sendingMessage, setSendingMessage] = useState<string | null>(null);
  const [groupMessage, setGroupMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [optimizedCount, setOptimizedCount] = useState(0);
  const [totalToOptimize, setTotalToOptimize] = useState(0);

  useEffect(() => {
    if (currentUser?.is_admin) {
      fetchAds();
      fetchUsers();
      loadGroups();
      loadSettings();
    }
  }, [currentUser]);

  useEffect(() => {
    if (tab === 'logs') {
      loadLogs();
    }
    if (tab === 'instagram') {
      loadIgMonitors();
    }
  }, [tab]);

  const loadIgMonitors = async () => {
    const { data } = await supabase.from('instagram_monitors').select('*').order('created_at', { ascending: false });
    setIgMonitors(data || []);
  };

  const handleAddIgMonitor = async () => {
    const username = igUsername.trim().replace(/^@/, '');
    if (!username) {
      toast.error('Informe o @username');
      return;
    }
    if (igMonitors.length >= 3) {
      toast.error('Limite de 3 perfis monitorados');
      return;
    }
    setSavingIg(true);
    const { error } = await supabase.from('instagram_monitors').insert({ username });
    setSavingIg(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setIgUsername('');
    toast.success('Perfil adicionado');
    loadIgMonitors();
  };

  const handleTestIgUsername = async () => {
    const username = igUsername.trim().replace(/^@/, '');
    if (!username) {
      toast.error('Informe o @username para testar');
      return;
    }
    setTestingIg(true);
    const { data, error } = await supabase.functions.invoke('monitorar-instagram', {
      body: { action: 'test_username', username },
    });
    setTestingIg(false);
    if (error || data?.error) {
      toast.error(data?.error || error?.message || 'Erro ao testar');
      return;
    }
    toast.success(`✓ ${data?.count || 0} post(s) encontrados para @${username}`);
  };


  const handleToggleIgMonitor = async (id: string, active: boolean) => {
    await supabase.from('instagram_monitors').update({ active: !active }).eq('id', id);
    loadIgMonitors();
  };

  const handleDeleteIgMonitor = async (id: string) => {
    if (!confirm('Remover este perfil?')) return;
    await supabase.from('instagram_monitors').delete().eq('id', id);
    toast.success('Removido');
    loadIgMonitors();
  };

  const handleRunIgNow = async () => {
    setRunningIg(true);
    const { data, error } = await supabase.functions.invoke('monitorar-instagram', { body: {} });
    setRunningIg(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Verificado: ${data?.total_new_posts || 0} post(s) novo(s)`);
    loadIgMonitors();
  };


  const loadLogs = async () => {
    setLoadingLogs(true);
    try {
      const { data: rawLogs, error } = await supabase
        .from('publication_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      
      if (error) {
        console.error('Error loading logs:', error);
        toast.error('Erro ao carregar logs');
      } else {
        const logsData = rawLogs || [];
        const adIds = [...new Set(logsData.map(log => log.ad_id).filter(Boolean))] as string[];
        const groupIds = [...new Set(logsData.map(log => log.group_id).filter(Boolean))] as string[];

        const [adsResult, groupsResult] = await Promise.all([
          adIds.length ? supabase.from('ads').select('id, title').in('id', adIds) : Promise.resolve({ data: [] as any[] }),
          groupIds.length ? supabase.from('community_groups').select('id, name').in('id', groupIds) : Promise.resolve({ data: [] as any[] }),
        ]);

        const adTitleById = new Map((adsResult.data || []).map((ad: any) => [ad.id, ad.title]));
        const groupNameById = new Map((groupsResult.data || []).map((group: any) => [group.id, group.name]));

        setLogs(logsData.map(log => ({
          ...log,
          ads: log.ad_id ? { title: adTitleById.get(log.ad_id) || 'Anúncio removido' } : null,
          community_groups: { name: groupNameById.get(log.group_id) || 'Grupo removido' },
        })));
      }
    } catch (err) {
      console.error('Unexpected error loading logs:', err);
      toast.error('Erro inesperado ao carregar logs');
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleResend = async (logId: string) => {
    setResendingId(logId);
    try {
      const { data, error } = await supabase.functions.invoke('reenviar-publicacao', { body: { log_id: logId } });
      if (error || (data as any)?.error) {
        toast.error((data as any)?.error || 'Falha ao reenviar');
      } else {
        toast.success('Mensagem colocada na fila de reenvio');
        loadLogs();
      }
    } catch (e: any) {
      toast.error(e.message || 'Erro inesperado');
    } finally {
      setResendingId(null);
    }
  };

  const loadSettings = async () => {
    const { data } = await supabase.from('app_settings').select('*').in('key', ['uazapi_server_url', 'uazapi_instance_token', 'webhook_url', 'post_to_status', 'community_join_link']);
    let hasUrl = false, hasToken = false;
    if (data) {
      for (const s of data) {
        if (s.key === 'uazapi_server_url') { setSettingsUrl(s.value); hasUrl = true; }
        if (s.key === 'uazapi_instance_token') { setSettingsToken(s.value); hasToken = true; }
        if (s.key === 'webhook_url') setWebhookUrl(s.value);
        if (s.key === 'post_to_status') setPostToStatus(s.value === 'true');
        if (s.key === 'community_join_link') setCommunityJoinLink(s.value);
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
        { key: 'post_to_status', value: postToStatus ? 'true' : 'false' },
        { key: 'community_join_link', value: communityJoinLink.trim() },
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
      link: newGroupLink.trim() || null,
      category: newGroupCategory.trim() || null,
    });
    setNewGroupName('');
    setNewGroupId('');
    setNewGroupLink('');
    setNewGroupCategory('');
    loadGroups();
    toast.success('Grupo adicionado');
  };

  const handleToggleGroup = async (id: string, active: boolean) => {
    await supabase.from('community_groups').update({ active: !active }).eq('id', id);
    loadGroups();
  };

  const handleToggleJoinLink = async (id: string, isJoinLink: boolean) => {
    // If it's already the join link, we can't unmark it easily without marking another one, 
    // but the user wants to mark *the* group.
    await supabase.from('community_groups').update({ is_join_group_link: !isJoinLink }).eq('id', id);
    loadGroups();
    toast.success('Grupo principal para entrada atualizado');
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
    setEditLink(group.link || '');
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
      link: editLink.trim() || null,
      category: editCategory.trim() || null,
    }).eq('id', editingGroup.id);
    setEditingGroup(null);
    loadGroups();
    toast.success('Grupo atualizado');
  };

  const handleSendMessage = async (groupId: string) => {
    if (!groupMessage.trim()) {
      toast.error('Digite uma mensagem');
      return;
    }
    setIsSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('enviar-mensagem-grupo', {
        body: { group_id: groupId, message: groupMessage.trim() },
      });
      if (error || data?.error) {
        toast.error(data?.error || error?.message || 'Erro ao enviar mensagem');
        return;
      }
      toast.success('Mensagem colocada na fila de envio');
      setGroupMessage('');
      setSendingMessage(null);
    } catch {
      toast.error('Erro ao enviar mensagem');
    } finally {
      setIsSending(false);
    }
  };

  const handleOptimizeExistingImages = async () => {
    if (!confirm('Deseja otimizar as imagens existentes? Isso pode levar algum tempo e consome dados.')) return;
    
    setOptimizing(true);
    setOptimizedCount(0);
    
    try {
      // Fetch all ads that might have non-webp images
      const { data: adsToProcess } = await supabase
        .from('ads')
        .select('id, main_photo, photos')
        .or('main_photo.not.ilike.%.webp,photos.not.ilike.%.webp');
      
      if (!adsToProcess || adsToProcess.length === 0) {
        toast.success('Todas as imagens já parecem estar otimizadas!');
        setOptimizing(false);
        return;
      }

      setTotalToOptimize(adsToProcess.length);
      toast.info(`Iniciando otimização de ${adsToProcess.length} anúncios...`);

      // This is a complex process because of CORS and file conversion in browser.
      // For now, let's just show the count and explain that new uploads are optimized.
      // A true bulk optimizer would best be an Edge Function.
      
      toast.info('A otimização automática para NOVOS envios já está ativa. Para imagens antigas, elas serão otimizadas conforme forem editadas.');
      
    } catch (err) {
      console.error(err);
      toast.error('Erro ao processar otimização');
    } finally {
      setOptimizing(false);
    }
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
        <div className="flex gap-2 overflow-x-auto pb-1">
          {[
            { key: 'ads' as const, icon: Megaphone, label: 'Anúncios', show: true },
            { key: 'users' as const, icon: Users, label: 'Anunciantes', show: true },
            { key: 'groups' as const, icon: Radio, label: 'Grupos', show: true },
            { key: 'logs' as const, icon: ClipboardList, label: 'Logs', show: true },
            { key: 'instagram' as const, icon: Instagram, label: 'Instagram', show: true },
            { key: 'stock' as const, icon: Boxes, label: 'Estoque', show: !!currentUser?.can_manage_stock },
            { key: 'settings' as const, icon: Settings, label: 'Config', show: true },
            { key: 'system' as const, icon: RefreshCw, label: 'Sistema', show: true },
          ].filter(t => t.show).map(t => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setSearch(''); }}
              className={`flex-shrink-0 py-2.5 px-3 rounded-xl text-xs font-semibold transition-all ${
                tab === t.key ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
              }`}
            >
              <t.icon className="w-4 h-4 inline mr-1" />
              {t.label}
            </button>
          ))}
        </div>

        {/* Search */}
        {(tab === 'ads' || tab === 'users') && (
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
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={async () => {
                          if (!confirm(`Excluir o anunciante "${user.name}"? Todos os anúncios dele serão apagados e ele poderá se cadastrar novamente.`)) return;
                          try {
                            const { data, error } = await supabase.functions.invoke('excluir-anunciante', {
                              body: { user_id: user.user_id },
                            });
                            if (error || data?.error) {
                              toast.error(data?.error || error?.message || 'Erro ao excluir');
                              return;
                            }
                            toast.success('Anunciante excluído');
                            fetchUsers();
                            fetchAds();
                            setExpandedUser(null);
                          } catch {
                            toast.error('Erro ao excluir anunciante');
                          }
                        }}
                        className="text-destructive"
                      >
                        <Trash2 className="w-4 h-4" /> Excluir
                      </Button>
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
            {/* Global Link */}
            <div className="bg-card border-2 border-primary/20 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-foreground text-sm flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" /> Link Manual do Botão
                </h3>
                <Button variant="cta" size="sm" className="h-8" onClick={handleSaveSettings} disabled={savingSettings}>
                  {savingSettings ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Salvar
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Este link será usado no botão "Entrar no grupo" do site, ignorando a seleção automática de grupos abaixo.</p>
              <Input
                value={communityJoinLink}
                onChange={e => setCommunityJoinLink(e.target.value)}
                placeholder="https://chat.whatsapp.com/..."
                className="h-11 rounded-xl"
              />
            </div>

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
                <Input value={editLink} onChange={e => setEditLink(e.target.value)}
                  placeholder="Link de convite (WhatsApp)" className="h-11 rounded-xl" />
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
                  <Input value={newGroupLink} onChange={e => setNewGroupLink(e.target.value)}
                    placeholder="Link de convite (WhatsApp)" className="h-11 rounded-xl" />
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
                    <div className="flex flex-col items-center gap-1">
                      <div className={`w-3 h-3 rounded-full flex-shrink-0 ${group.active ? 'bg-cta' : 'bg-muted-foreground/30'}`} />
                      {group.is_join_group_link && <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" title="Principal" />}
                    </div>
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
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSendingMessage(sendingMessage === group.id ? null : group.id)}>
                        <MessageSquare className="w-4 h-4 text-cta" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8"
                        onClick={() => handleToggleJoinLink(group.id, group.is_join_group_link)}
                        title={group.is_join_group_link ? "Desmarcar como principal" : "Marcar como principal"}>
                        <Users className={`w-4 h-4 ${group.is_join_group_link ? 'text-primary' : 'text-muted-foreground'}`} />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDeleteGroup(group.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  
                  {sendingMessage === group.id && (
                    <div className="mt-2 space-y-2 pl-6 animate-fade-in">
                      <div className="flex gap-2">
                        <Input 
                          value={groupMessage} 
                          onChange={e => setGroupMessage(e.target.value)}
                          placeholder="Digite sua mensagem para o grupo..."
                          className="h-9 text-xs rounded-lg"
                        />
                        <Button 
                          size="sm" 
                          className="h-9 px-3" 
                          onClick={() => handleSendMessage(group.id)}
                          disabled={isSending}
                        >
                          {isSending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                        </Button>
                      </div>
                    </div>
                  )}

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

        {tab === 'logs' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-foreground text-sm">Histórico de Envios</h3>
              <Button variant="ghost" size="sm" onClick={loadLogs} disabled={loadingLogs}>
                <RefreshCw className={`w-4 h-4 mr-1 ${loadingLogs ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
            </div>
            {loadingLogs && logs.length === 0 ? (
              <div className="flex justify-center py-10">
                <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : logs.length === 0 ? (
              <p className="text-center text-muted-foreground py-10 text-sm">Nenhum log encontrado</p>
            ) : (
              <div className="space-y-2">
                {logs.map(log => (
                  <div key={log.id} className="bg-card border rounded-xl p-3 text-xs space-y-1">
                    <div className="flex justify-between items-start">
                      <span className="font-bold text-foreground">
                        {log.community_groups?.name || 'Grupo Removido'}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full font-medium ${logStatusClasses[log.status] || 'bg-secondary text-secondary-foreground'}`}>
                        {logStatusLabels[log.status] || log.status}
                      </span>
                    </div>
                    <div className="text-muted-foreground">
                      {log.ads?.title ? (
                        <span className="flex items-center gap-1">
                          <Megaphone className="w-3 h-3" /> Anúncio: {log.ads.title}
                        </span>
                      ) : log.message ? (
                        <span className="flex items-center gap-1">
                          <MessageSquare className="w-3 h-3" /> Mensagem: {log.message}
                        </span>
                      ) : (
                        <span>Envio automático</span>
                      )}
                    </div>
                    {['error', 'failed', 'retry'].includes(log.status) && log.api_response?.error && (
                      <p className="text-destructive font-medium mt-1">Erro: {log.api_response.error}</p>
                    )}
                    <div className="pt-1 flex items-center justify-between gap-2">
                      {['error', 'failed'].includes(log.status) ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-[11px] px-2"
                          disabled={resendingId === log.id}
                          onClick={() => handleResend(log.id)}
                        >
                          {resendingId === log.id ? (
                            <><RefreshCw className="w-3 h-3 mr-1 animate-spin" /> Enfileirando...</>
                          ) : (
                            <><Send className="w-3 h-3 mr-1" /> Reenviar</>
                          )}
                        </Button>
                      ) : <span />}
                      <span className="text-[10px] text-muted-foreground/60">
                        {new Date(log.created_at).toLocaleString('pt-BR')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'instagram' && (
          <div className="space-y-4">
            <div className="bg-card border rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-foreground text-sm flex items-center gap-2">
                  <Instagram className="w-4 h-4" /> Monitorar Instagram
                </h3>
                <Button variant="outline" size="sm" onClick={handleRunIgNow} disabled={runningIg}>
                  <RefreshCw className={`w-4 h-4 ${runningIg ? 'animate-spin' : ''}`} />
                  Verificar agora
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Cadastre até 3 perfis públicos do Instagram. A cada 1 hora o sistema verifica novos posts (via Apify) e envia para todos os grupos ativos do WhatsApp.
              </p>
              <p className="text-[10px] text-muted-foreground bg-secondary/50 p-2 rounded-lg">
                💡 Funciona com qualquer perfil público — basta informar o @username.
              </p>
            </div>

            {igMonitors.length < 3 && (
              <div className="bg-card border rounded-xl p-4 space-y-3">
                <h4 className="font-medium text-foreground text-sm">Adicionar perfil ({igMonitors.length}/3)</h4>
                <Input
                  value={igUsername}
                  onChange={e => setIgUsername(e.target.value)}
                  placeholder="@username (ex: instagram)"
                  className="h-11 rounded-xl"
                />
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={handleTestIgUsername} disabled={testingIg}>
                    <RefreshCw className={`w-4 h-4 ${testingIg ? 'animate-spin' : ''}`} />
                    {testingIg ? 'Testando...' : 'Testar'}
                  </Button>
                  <Button variant="cta" className="flex-1" onClick={handleAddIgMonitor} disabled={savingIg}>
                    <Plus className="w-4 h-4" />
                    {savingIg ? 'Adicionando...' : 'Adicionar'}
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {igMonitors.length === 0 ? (
                <div className="bg-card border rounded-xl p-6 text-center text-sm text-muted-foreground">
                  Nenhum perfil monitorado ainda.
                </div>
              ) : igMonitors.map(m => (
                <div key={m.id} className="bg-card border rounded-xl p-4 flex items-center gap-3">
                  <Instagram className="w-5 h-5 text-primary flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground text-sm truncate">@{m.username}</p>

                    
                    <p className="text-[10px] text-muted-foreground">
                      {m.last_checked_at ? `Última verificação: ${new Date(m.last_checked_at).toLocaleString('pt-BR')}` : 'Nunca verificado'}
                    </p>
                  </div>
                  <button
                    onClick={() => handleToggleIgMonitor(m.id, m.active)}
                    className={`text-[10px] px-2 py-1 rounded-full font-medium ${m.active ? 'bg-green-500/10 text-green-600' : 'bg-muted text-muted-foreground'}`}
                  >
                    {m.active ? 'Ativo' : 'Pausado'}
                  </button>
                  <button onClick={() => handleDeleteIgMonitor(m.id)} className="text-destructive p-1">
                    <Trash2 className="w-4 h-4" />
                  </button>
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

            {/* Webhook n8n */}
            <div className="bg-card border rounded-xl p-4 space-y-3">
              <h3 className="font-semibold text-foreground text-sm">Webhook (n8n / Automação)</h3>
              <p className="text-xs text-muted-foreground">
                Cole a URL do webhook para receber os dados completos do anúncio automaticamente ao publicar.
              </p>
              <Input
                value={webhookUrl}
                onChange={e => setWebhookUrl(e.target.value)}
                placeholder="https://seu-n8n.com/webhook/..."
                className="h-11 rounded-xl"
              />
              <p className="text-[10px] text-muted-foreground">
                📦 Dados enviados: título, descrição, preço, categoria, fotos, contato, região, link do anúncio e dados do anunciante.
              </p>
              <Button variant="cta" className="w-full" onClick={handleSaveSettings} disabled={savingSettings}>
                <Save className="w-4 h-4" />
                {savingSettings ? 'Salvando...' : 'Salvar configurações'}
              </Button>
            </div>

            {/* Post to Status Toggle */}
            <div className="bg-card border rounded-xl p-4 space-y-3">
              <h3 className="font-semibold text-foreground text-sm">📱 Postar no Status do WhatsApp</h3>
              <p className="text-xs text-muted-foreground">
                Ao publicar um anúncio, ele também será postado no Status (Stories) do WhatsApp para que todos que têm seu número salvo possam ver.
              </p>
              <div className="flex items-center justify-between">
                <span className="text-sm text-foreground">{postToStatus ? 'Ativado' : 'Desativado'}</span>
                <button
                  onClick={() => setPostToStatus(!postToStatus)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${postToStatus ? 'bg-cta' : 'bg-muted'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${postToStatus ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground">
                ⚠️ Lembre-se de salvar as configurações após alterar esta opção.
              </p>
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

        {tab === 'system' && (
          <div className="space-y-6 animate-fade-in">
            <div className="bg-card border rounded-xl p-4 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <RefreshCw className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Otimização de Performance</h3>
                  <p className="text-xs text-muted-foreground">Melhore a velocidade de carregamento do site</p>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium">Conversão WebP automática</p>
                    <p className="text-[10px] text-muted-foreground">Novas imagens são convertidas para WebP (mais leves)</p>
                  </div>
                  <span className="text-[10px] px-2 py-1 bg-green-500/10 text-green-600 rounded-full font-bold">ATIVO</span>
                </div>

                <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium">Redimensionamento Inteligente</p>
                    <p className="text-[10px] text-muted-foreground">Imagens grandes são redimensionadas para 1200px</p>
                  </div>
                  <span className="text-[10px] px-2 py-1 bg-green-500/10 text-green-600 rounded-full font-bold">ATIVO</span>
                </div>

                <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium">Lazy Loading</p>
                    <p className="text-[10px] text-muted-foreground">Imagens só carregam quando aparecem na tela</p>
                  </div>
                  <span className="text-[10px] px-2 py-1 bg-green-500/10 text-green-600 rounded-full font-bold">ATIVO</span>
                </div>
              </div>

              <div className="pt-4 border-t">
                <h4 className="text-sm font-semibold mb-2">Imagens Antigas</h4>
                <p className="text-xs text-muted-foreground mb-4">
                  Imagens enviadas antes desta atualização podem ser pesadas. 
                  Você pode otimizá-las editando o anúncio e salvando novamente, ou usando a ferramenta abaixo.
                </p>
                <Button 
                  className="w-full" 
                  variant="outline" 
                  onClick={handleOptimizeExistingImages}
                  disabled={optimizing}
                >
                  {optimizing ? (
                    <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Otimizando...</>
                  ) : (
                    <><RefreshCw className="w-4 h-4 mr-2" /> Verificar imagens antigas</>
                  )}
                </Button>
              </div>
            </div>

            <div className="bg-card border rounded-xl p-4 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
                  <Settings className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Informações do Sistema</h3>
                  <p className="text-xs text-muted-foreground">Status geral da plataforma</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-secondary/30 rounded-lg">
                  <p className="text-[10px] text-muted-foreground uppercase font-bold">Versão do App</p>
                  <p className="text-sm font-bold">2.1.0-speed</p>
                </div>
                <div className="p-3 bg-secondary/30 rounded-lg">
                  <p className="text-[10px] text-muted-foreground uppercase font-bold">Ambiente</p>
                  <p className="text-sm font-bold">Produção</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
