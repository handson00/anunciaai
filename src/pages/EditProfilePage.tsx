import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/contexts/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Save } from 'lucide-react';
import { toast } from 'sonner';

export default function EditProfilePage() {
  const { currentUser, updateUser } = useApp();
  const navigate = useNavigate();
  const [name, setName] = useState(currentUser?.name || '');

  const handleSave = () => {
    if (!name.trim()) { toast.error('Digite seu nome'); return; }
    updateUser(currentUser!.id, { name: name.trim() });
    toast.success('Dados atualizados!');
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b sticky top-0 z-10">
        <div className="container max-w-lg mx-auto flex items-center gap-3 px-4 py-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-bold text-foreground">Editar cadastro</h1>
        </div>
      </header>

      <div className="container max-w-lg mx-auto px-4 py-6 space-y-5 animate-fade-in-up">
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
        <Button variant="cta" size="lg" className="w-full" onClick={handleSave}>
          <Save className="w-5 h-5" />
          Salvar alterações
        </Button>
      </div>
    </div>
  );
}
