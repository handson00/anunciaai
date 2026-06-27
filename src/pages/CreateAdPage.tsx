import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdCategory } from '@/contexts/AppContext';
import { CategorySelect } from '@/components/CategorySelect';
import { AdForm } from '@/components/AdForm';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { DesktopShell } from '@/components/DesktopShell';

export default function CreateAdPage() {
  const [category, setCategory] = useState<AdCategory | null>(null);
  const navigate = useNavigate();

  return (
    <DesktopShell>
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b sticky top-0 z-10 md:hidden">
        <div className="container max-w-lg mx-auto flex items-center gap-3 px-4 py-3">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Voltar"
            onClick={() => category ? setCategory(null) : navigate('/dashboard')}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-bold text-foreground">Novo anúncio</h1>
        </div>
      </header>

      <div className="container max-w-lg md:max-w-3xl mx-auto px-4 md:px-8 py-6 md:py-10">
        <div className="hidden md:flex items-center gap-3 mb-6">
          {category && (
            <Button variant="ghost" size="icon" onClick={() => setCategory(null)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
          )}
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Catálogo</p>
            <h1 className="text-2xl font-bold mt-1">Novo anúncio</h1>
          </div>
        </div>
        {!category ? (
          <CategorySelect onSelect={setCategory} />
        ) : (
          <AdForm category={category} onBack={() => setCategory(null)} />
        )}
      </div>
    </div>
    </DesktopShell>
  );
}
