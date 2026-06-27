import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AdminRow { user_id: string; name: string; can_manage_stock: boolean; is_admin: boolean; }

export function StockPermissions({ currentUserId }: { currentUserId: string }) {
  const [rows, setRows] = useState<AdminRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any).rpc('list_admin_users');
    if (error) toast.error(error.message);
    setRows((data || []) as AdminRow[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const toggle = async (userId: string, current: boolean) => {
    const { error } = await (supabase as any).rpc('set_stock_permission', { _target_user: userId, _can: !current });
    if (error) return toast.error(error.message);
    toast.success('Permissão atualizada');
    load();
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">Apenas administradores podem receber acesso à Gestão de Estoque.</p>
        <Button variant="outline" size="sm" onClick={load}><RefreshCw className="w-4 h-4" /></Button>
      </div>
      {loading ? (
        <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.user_id} className="bg-card border rounded-xl p-3 flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">{r.name}</p>
                <p className="text-xs text-muted-foreground">
                  {r.user_id === currentUserId ? 'Você' : 'Administrador'}
                </p>
              </div>
              <Switch
                checked={r.can_manage_stock}
                onCheckedChange={() => toggle(r.user_id, r.can_manage_stock)}
                disabled={r.user_id === currentUserId}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
