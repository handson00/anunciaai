import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Trash2, Play, Pause, Plus, X, ChevronDown, ChevronUp, RefreshCw, CheckCircle2, AlertCircle, Clock } from 'lucide-react';

interface Group { id: string; name: string; }

interface Scheduled {
  id: string;
  title: string | null;
  group_ids: string[];
  message_type: string;
  text: string | null;
  media_url: string | null;
  file_name: string | null;
  poll_options: any;
  buttons: any;
  scheduled_at: string;
  recurrence: string;
  next_run_at: string;
  status: string;
  last_run_at: string | null;
  last_error: string | null;
}

const TYPES = [
  { value: 'text', label: 'Texto' },
  { value: 'image', label: 'Imagem' },
  { value: 'video', label: 'Vídeo' },
  { value: 'audio', label: 'Áudio' },
  { value: 'document', label: 'Documento' },
  { value: 'poll', label: 'Enquete' },
  { value: 'buttons', label: 'Botões' },
];

const RECURRENCES = [
  { value: 'none', label: 'Único' },
  { value: 'daily', label: 'Diário' },
  { value: 'weekly', label: 'Semanal' },
  { value: 'monthly', label: 'Mensal' },
];

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendente', running: 'Enviando', sent: 'Enviado', cancelled: 'Cancelado', error: 'Erro',
};

export function ScheduledMessages({ groups }: { groups: Group[] }) {
  const [items, setItems] = useState<Scheduled[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [messageType, setMessageType] = useState('text');
  const [text, setText] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [fileName, setFileName] = useState('');
  const [pollOptions, setPollOptions] = useState<string[]>(['', '']);
  const [buttons, setButtons] = useState<{ id: string; label: string; url?: string }[]>([{ id: '1', label: '' }]);
  const [scheduledAt, setScheduledAt] = useState('');
  const [recurrence, setRecurrence] = useState('none');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('scheduled_messages')
      .select('*')
      .order('next_run_at', { ascending: true });
    setItems((data || []) as any);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const reset = () => {
    setTitle(''); setSelectedGroups([]); setMessageType('text'); setText('');
    setMediaUrl(''); setFileName(''); setPollOptions(['', '']);
    setButtons([{ id: '1', label: '' }]);
    setScheduledAt(''); setRecurrence('none');
  };

  const save = async () => {
    if (!selectedGroups.length) return toast.error('Selecione ao menos 1 grupo');
    if (!scheduledAt) return toast.error('Defina a data/hora');
    if (messageType === 'text' && !text.trim()) return toast.error('Digite o texto');
    if (['image','video','audio','document'].includes(messageType) && !mediaUrl.trim()) return toast.error('Informe a URL da mídia');
    if (messageType === 'poll' && pollOptions.filter(o => o.trim()).length < 2) return toast.error('Mínimo 2 opções na enquete');
    if (messageType === 'buttons' && buttons.filter(b => b.label.trim()).length < 1) return toast.error('Adicione ao menos 1 botão');

    setSaving(true);
    const payload: any = {
      title: title || null,
      group_ids: selectedGroups,
      message_type: messageType,
      text: text || null,
      media_url: ['image','video','audio','document'].includes(messageType) ? mediaUrl : null,
      file_name: messageType === 'document' ? (fileName || null) : null,
      poll_options: messageType === 'poll' ? pollOptions.filter(o => o.trim()) : null,
      buttons: messageType === 'buttons' ? buttons.filter(b => b.label.trim()) : null,
      scheduled_at: new Date(scheduledAt).toISOString(),
      next_run_at: new Date(scheduledAt).toISOString(),
      recurrence,
      status: 'pending',
      created_by: (await supabase.auth.getUser()).data.user?.id,
    };
    const { error } = await supabase.from('scheduled_messages').insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success('Agendamento criado');
    reset();
    setShowForm(false);
    load();
  };

  const cancel = async (id: string) => {
    await supabase.from('scheduled_messages').update({ status: 'cancelled' }).eq('id', id);
    load();
  };
  const reactivate = async (id: string, next: string) => {
    await supabase.from('scheduled_messages').update({ status: 'pending', next_run_at: next }).eq('id', id);
    load();
  };
  const remove = async (id: string) => {
    if (!confirm('Excluir este agendamento?')) return;
    await supabase.from('scheduled_messages').delete().eq('id', id);
    load();
  };
  const runNow = async () => {
    toast.info('Executando worker...');
    const { error } = await supabase.functions.invoke('processar-mensagens-agendadas');
    if (error) return toast.error(error.message);
    toast.success('Worker executado');
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button onClick={() => setShowForm(s => !s)} className="flex-1">
          <Plus className="w-4 h-4 mr-1" /> Novo agendamento
        </Button>
        <Button variant="outline" onClick={runNow}>
          <Play className="w-4 h-4 mr-1" /> Executar agora
        </Button>
      </div>

      {showForm && (
        <div className="border rounded-xl p-4 space-y-3 bg-card">
          <Input placeholder="Título (opcional)" value={title} onChange={e => setTitle(e.target.value)} />

          <div>
            <p className="text-sm font-semibold mb-1">Grupos</p>
            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto border rounded-lg p-2">
              {groups.map(g => {
                const sel = selectedGroups.includes(g.id);
                return (
                  <button key={g.id} type="button" onClick={() => setSelectedGroups(s => sel ? s.filter(x => x !== g.id) : [...s, g.id])}
                    className={`text-xs px-2 py-1 rounded-full border ${sel ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary'}`}>
                    {g.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <select className="border rounded-lg p-2 text-sm bg-background" value={messageType} onChange={e => setMessageType(e.target.value)}>
              {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <select className="border rounded-lg p-2 text-sm bg-background" value={recurrence} onChange={e => setRecurrence(e.target.value)}>
              {RECURRENCES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>

          <textarea className="w-full border rounded-lg p-2 text-sm min-h-[80px] bg-background"
            placeholder={messageType === 'poll' || messageType === 'buttons' ? 'Texto/pergunta' : 'Mensagem'}
            value={text} onChange={e => setText(e.target.value)} />

          {['image','video','audio','document'].includes(messageType) && (
            <>
              <Input placeholder="URL da mídia (https://...)" value={mediaUrl} onChange={e => setMediaUrl(e.target.value)} />
              {messageType === 'document' && (
                <Input placeholder="Nome do arquivo (ex: catalogo.pdf)" value={fileName} onChange={e => setFileName(e.target.value)} />
              )}
            </>
          )}

          {messageType === 'poll' && (
            <div className="space-y-2">
              <p className="text-sm font-semibold">Opções da enquete</p>
              {pollOptions.map((opt, i) => (
                <div key={i} className="flex gap-2">
                  <Input placeholder={`Opção ${i + 1}`} value={opt}
                    onChange={e => setPollOptions(o => o.map((v, idx) => idx === i ? e.target.value : v))} />
                  {pollOptions.length > 2 && (
                    <Button type="button" variant="ghost" size="icon" onClick={() => setPollOptions(o => o.filter((_, idx) => idx !== i))}>
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => setPollOptions(o => [...o, ''])}>
                <Plus className="w-4 h-4 mr-1" /> Opção
              </Button>
            </div>
          )}

          {messageType === 'buttons' && (
            <div className="space-y-2">
              <p className="text-sm font-semibold">Botões (deixe URL vazia para botão de resposta)</p>
              {buttons.map((b, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                  <Input placeholder="Texto do botão" value={b.label}
                    onChange={e => setButtons(arr => arr.map((x, idx) => idx === i ? { ...x, label: e.target.value } : x))} />
                  <Input placeholder="URL (opcional)" value={b.url || ''}
                    onChange={e => setButtons(arr => arr.map((x, idx) => idx === i ? { ...x, url: e.target.value } : x))} />
                  {buttons.length > 1 && (
                    <Button type="button" variant="ghost" size="icon" onClick={() => setButtons(arr => arr.filter((_, idx) => idx !== i))}>
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
              <Button type="button" variant="outline" size="sm"
                onClick={() => setButtons(arr => [...arr, { id: String(arr.length + 1), label: '' }])}>
                <Plus className="w-4 h-4 mr-1" /> Botão
              </Button>
            </div>
          )}

          <div>
            <p className="text-sm font-semibold mb-1">Data e hora</p>
            <Input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} />
          </div>

          <div className="flex gap-2">
            <Button onClick={save} disabled={saving} className="flex-1">{saving ? 'Salvando...' : 'Agendar'}</Button>
            <Button variant="outline" onClick={() => { reset(); setShowForm(false); }}>Cancelar</Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {loading && <p className="text-sm text-muted-foreground">Carregando...</p>}
        {!loading && items.length === 0 && <p className="text-sm text-muted-foreground">Nenhum agendamento ainda.</p>}
        {items.map(it => (
          <div key={it.id} className="border rounded-xl p-3 bg-card text-sm space-y-1">
            <div className="flex items-center justify-between gap-2">
              <div className="font-semibold truncate">{it.title || `[${it.message_type}]`}</div>
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                it.status === 'sent' ? 'bg-accent text-accent-foreground' :
                it.status === 'error' ? 'bg-destructive/10 text-destructive' :
                it.status === 'cancelled' ? 'bg-muted text-muted-foreground' :
                'bg-secondary text-secondary-foreground'
              }`}>{STATUS_LABELS[it.status]}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Próximo envio: {new Date(it.next_run_at).toLocaleString('pt-BR')} · {RECURRENCES.find(r => r.value === it.recurrence)?.label}
            </p>
            <p className="text-xs text-muted-foreground">
              {it.group_ids.length} grupo(s) · Tipo: {TYPES.find(t => t.value === it.message_type)?.label}
            </p>
            {it.text && <p className="text-xs line-clamp-2">{it.text}</p>}
            {it.last_error && <p className="text-xs text-destructive">Último erro: {it.last_error}</p>}
            <div className="flex gap-2 pt-1">
              {it.status === 'pending' || it.status === 'running' ? (
                <Button size="sm" variant="outline" onClick={() => cancel(it.id)}>
                  <Pause className="w-3 h-3 mr-1" /> Cancelar
                </Button>
              ) : (
                <Button size="sm" variant="outline" onClick={() => reactivate(it.id, it.next_run_at)}>
                  <Play className="w-3 h-3 mr-1" /> Reativar
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => remove(it.id)}>
                <Trash2 className="w-3 h-3 text-destructive" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
