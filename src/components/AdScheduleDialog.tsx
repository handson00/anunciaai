import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, X, Clock, Loader2 } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  adId: string;
  adTitle: string;
  userId: string;
}

interface Schedule {
  id?: string;
  times: string[];
  active: boolean;
}

export function AdScheduleDialog({ open, onOpenChange, adId, adTitle, userId }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [schedule, setSchedule] = useState<Schedule>({ times: [], active: true });
  const [newTime, setNewTime] = useState('09:00');
  const [runs, setRuns] = useState<any[]>([]);

  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('ad_schedules')
        .select('id, times, active')
        .eq('ad_id', adId)
        .maybeSingle();
      if (data) setSchedule({ id: data.id, times: data.times || [], active: !!data.active });
      else setSchedule({ times: [], active: true });

      const { data: runData } = await supabase
        .from('ad_schedule_runs')
        .select('run_date, slot, status, detail, ran_at')
        .in('schedule_id', data?.id ? [data.id] : ['00000000-0000-0000-0000-000000000000'])
        .order('ran_at', { ascending: false })
        .limit(10);
      setRuns(runData || []);
      setLoading(false);
    })();
  }, [open, adId]);

  const addTime = () => {
    if (!/^\d{2}:\d{2}$/.test(newTime)) return;
    if (schedule.times.includes(newTime)) return;
    const updated = [...schedule.times, newTime].sort();
    setSchedule(s => ({ ...s, times: updated }));
  };

  const removeTime = (t: string) =>
    setSchedule(s => ({ ...s, times: s.times.filter(x => x !== t) }));

  const save = async () => {
    setSaving(true);
    try {
      if (schedule.times.length === 0 && !schedule.id) {
        toast.error('Adicione ao menos um horário');
        setSaving(false);
        return;
      }
      if (schedule.id) {
        const { error } = await supabase.from('ad_schedules').update({
          times: schedule.times, active: schedule.active,
        }).eq('id', schedule.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('ad_schedules').insert({
          ad_id: adId, user_id: userId, times: schedule.times, active: schedule.active,
        });
        if (error) throw error;
      }
      toast.success('Agendamento salvo');
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const disable = async () => {
    if (!schedule.id) { onOpenChange(false); return; }
    if (!confirm('Desativar agendamento deste anúncio?')) return;
    setSaving(true);
    const { error } = await supabase.from('ad_schedules').delete().eq('id', schedule.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success('Agendamento removido');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" /> Agendar repostagem
          </DialogTitle>
          <p className="text-xs text-muted-foreground truncate">{adTitle}</p>
        </DialogHeader>

        {loading ? (
          <div className="py-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin" /></div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="sched-active">Agendamento ativo</Label>
              <Switch id="sched-active" checked={schedule.active}
                onCheckedChange={v => setSchedule(s => ({ ...s, active: v }))} />
            </div>

            <div>
              <Label className="text-sm">Horários diários (fuso BRT)</Label>
              <div className="flex gap-2 mt-2">
                <Input type="time" value={newTime} onChange={e => setNewTime(e.target.value)} />
                <Button onClick={addTime} variant="outline" size="icon"><Plus className="w-4 h-4" /></Button>
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                {schedule.times.length === 0 && (
                  <p className="text-xs text-muted-foreground">Nenhum horário adicionado.</p>
                )}
                {schedule.times.map(t => (
                  <span key={t} className="flex items-center gap-1 bg-accent text-accent-foreground text-xs px-2 py-1 rounded-full">
                    {t}
                    <button onClick={() => removeTime(t)} className="hover:text-destructive">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground mt-2">
                O anúncio será reenviado a todos os grupos ativos em cada horário.
              </p>
            </div>

            {runs.length > 0 && (
              <div>
                <Label className="text-sm">Últimas execuções</Label>
                <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                  {runs.map((r, i) => (
                    <div key={i} className="text-xs flex justify-between border-b py-1">
                      <span>{r.run_date} • {r.slot}</span>
                      <span className={r.status === 'ok' ? 'text-green-600' : 'text-destructive'}>
                        {r.status === 'ok' ? '✓' : '✕'} {r.detail || ''}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          {schedule.id && (
            <Button variant="ghost" className="text-destructive" onClick={disable} disabled={saving}>
              Remover
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button variant="cta" onClick={save} disabled={saving || loading}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
