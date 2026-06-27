import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/contexts/AppContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Save, Loader2, Camera } from 'lucide-react';
import { toast } from 'sonner';
import { optimizeImage } from '@/utils/image-optimization';
import { DesktopShell } from '@/components/DesktopShell';

export default function EditProfilePage() {
  const { currentUser, authUser, updateProfile } = useApp();
  const navigate = useNavigate();
  const [name, setName] = useState(currentUser?.name || '');
  const [storeName, setStoreName] = useState(currentUser?.store_name || '');
  const [avatarUrl, setAvatarUrl] = useState(currentUser?.avatar_url || '');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !authUser) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Selecione uma imagem válida');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Imagem deve ter no máximo 2MB');
      return;
    }

    setUploading(true);
    
    let fileToUpload = file;
    try {
      fileToUpload = await optimizeImage(file, { maxWidth: 400, maxHeight: 400, quality: 0.8 });
    } catch (err) {
      console.error('Erro ao otimizar avatar:', err);
    }

    const ext = 'webp';
    const path = `${authUser.id}/avatar.${ext}`;

    const { error } = await supabase.storage
      .from('avatars')
      .upload(path, fileToUpload, { upsert: true });

    if (error) {
      toast.error('Erro ao enviar foto');
      setUploading(false);
      return;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(path);

    // Add cache-bust param
    const url = `${publicUrl}?t=${Date.now()}`;
    setAvatarUrl(url);
    setUploading(false);
    toast.success('Foto atualizada!');
  };

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Digite seu nome'); return; }
    setSaving(true);
    await updateProfile({
      name: name.trim(),
      avatar_url: avatarUrl || undefined,
      store_name: storeName.trim() || undefined,
    });
    setSaving(false);
    toast.success('Dados atualizados!');
    navigate('/dashboard');
  };

  const initials = (currentUser?.name || 'U').slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b sticky top-0 z-10">
        <div className="container max-w-lg mx-auto flex items-center gap-3 px-4 py-3">
          <Button variant="ghost" size="icon" aria-label="Voltar" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-bold text-foreground">Editar cadastro</h1>
        </div>
      </header>

      <div className="container max-w-lg mx-auto px-4 py-6 space-y-5 animate-fade-in-up">
        {/* Avatar */}
        <div className="flex flex-col items-center gap-3">
          <button
            onClick={() => fileRef.current?.click()}
            className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-border bg-muted group active:scale-95 transition-transform"
            disabled={uploading}
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="Foto de perfil do usuário" className="w-full h-full object-cover" />
            ) : (
              <span className="flex items-center justify-center w-full h-full text-2xl font-bold text-muted-foreground">
                {initials}
              </span>
            )}
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              {uploading ? (
                <Loader2 className="w-6 h-6 text-white animate-spin" />
              ) : (
                <Camera className="w-6 h-6 text-white" />
              )}
            </div>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarUpload}
          />
          <p className="text-xs text-muted-foreground">Toque para alterar a foto</p>
        </div>

        <div>
          <label className="text-sm font-medium text-foreground mb-1.5 block">Telefone</label>
          <Input value={currentUser?.phone || ''} disabled className="h-12 rounded-xl bg-muted" />
        </div>
        <div>
          <label className="text-sm font-medium text-foreground mb-1.5 block">Nome</label>
          <Input
            value={name}
            onChange={e => setName(e.target.value)}
            className="h-12 rounded-xl"
            autoFocus
          />
        </div>
        <div>
          <label className="text-sm font-medium text-foreground mb-1.5 block">
            Nome do vendedor / loja <span className="text-muted-foreground font-normal">(opcional)</span>
          </label>
          <Input
            value={storeName}
            onChange={e => setStoreName(e.target.value)}
            placeholder="Ex: Loja do João"
            className="h-12 rounded-xl"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Aparece como anunciante nos seus anúncios. Se vazio, mostra seu nome.
          </p>
        </div>
        <Button variant="cta" size="lg" className="w-full" onClick={handleSave} disabled={saving || uploading}>
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Save className="w-5 h-5" /> Salvar alterações</>}
        </Button>
      </div>
    </div>
  );
}
