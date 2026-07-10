import { useEffect, useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Users, ExternalLink, Check, Loader2 } from 'lucide-react';

/**
 * Após cadastro/login, obriga o usuário a entrar no grupo do WhatsApp
 * antes de continuar usando a plataforma.
 * A confirmação é salva em localStorage por usuário.
 */
export function JoinGroupGate() {
  const { currentUser } = useApp();
  const [groupLink, setGroupLink] = useState<string | null>(null);
  const [opened, setOpened] = useState(false);
  const [loading, setLoading] = useState(true);
  const [confirmed, setConfirmed] = useState(true);

  const storageKey = currentUser ? `joined_group_${currentUser.user_id}` : null;

  useEffect(() => {
    if (!currentUser || currentUser.is_admin) {
      setConfirmed(true);
      return;
    }
    const already = storageKey ? localStorage.getItem(storageKey) : null;
    if (already === '1') {
      setConfirmed(true);
      return;
    }
    setConfirmed(false);
    setLoading(true);

    (async () => {
      const { data: manual } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'community_join_link')
        .maybeSingle();
      if (manual?.value) {
        setGroupLink(manual.value);
        setLoading(false);
        return;
      }
      const { data: joinLink } = await supabase
        .from('community_groups')
        .select('link')
        .eq('active', true)
        .eq('is_join_group_link', true)
        .maybeSingle();
      if (joinLink?.link) {
        setGroupLink(joinLink.link);
      } else {
        const { data } = await supabase
          .from('community_groups')
          .select('link')
          .eq('active', true)
          .order('created_at', { ascending: true })
          .limit(1);
        if (data && data.length > 0) setGroupLink(data[0].link);
      }
      setLoading(false);
    })();
  }, [currentUser, storageKey]);

  if (confirmed || !currentUser) return null;

  const handleOpen = () => {
    if (groupLink) {
      window.open(groupLink, '_blank');
      setOpened(true);
    }
  };

  const handleConfirm = () => {
    if (storageKey) localStorage.setItem(storageKey, '1');
    setConfirmed(true);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-card w-full max-w-md rounded-2xl p-6 shadow-2xl animate-scale-in space-y-5 text-center">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-cta/10 flex items-center justify-center">
          <Users className="w-8 h-8 text-cta" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-foreground">
            Falta 1 passo! Entre no grupo
          </h2>
          <p className="text-sm text-muted-foreground">
            Para usar a plataforma você precisa entrar no grupo da comunidade no WhatsApp. É lá que os anúncios são publicados.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="w-6 h-6 text-cta animate-spin" />
          </div>
        ) : !groupLink ? (
          <p className="text-sm text-destructive">
            Link do grupo indisponível no momento. Fale com o administrador.
          </p>
        ) : (
          <div className="space-y-3">
            <Button
              variant="cta"
              size="lg"
              className="w-full"
              onClick={handleOpen}
            >
              <ExternalLink className="w-5 h-5" /> Entrar no grupo do WhatsApp
            </Button>
            <Button
              variant={opened ? 'cta' : 'outline'}
              size="lg"
              className="w-full"
              onClick={handleConfirm}
              disabled={!opened}
            >
              <Check className="w-5 h-5" /> Já entrei no grupo
            </Button>
            {!opened && (
              <p className="text-xs text-muted-foreground">
                Clique em "Entrar no grupo" primeiro para liberar a confirmação.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
