import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdCategory } from '@/contexts/AppContext';
import { CategorySelect } from '@/components/CategorySelect';
import { AdForm } from '@/components/AdForm';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function CreateAdPage() {
  const [category, setCategory] = useState<AdCategory | null>(null);
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b sticky top-0 z-10">
        <div className="container max-w-lg mx-auto flex items-center gap-3 px-4 py-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => category ? setCategory(null) : navigate('/dashboard')}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-bold text-foreground">Novo anúncio</h1>
        </div>
      </header>

      <div className="container max-w-lg mx-auto px-4 py-6">
        {!category ? (
          <CategorySelect onSelect={setCategory} />
        ) : (
          <AdForm category={category} onBack={() => setCategory(null)} />
        )}
      </div>
    </div>
  );
}
