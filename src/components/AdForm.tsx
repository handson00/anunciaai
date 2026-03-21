import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdCategory, useApp } from '@/contexts/AppContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Camera, Plus, X, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  category: AdCategory;
  onBack: () => void;
}

const categoryLabels: Record<AdCategory, string> = {
  automobile: 'Automóvel',
  product: 'Produto',
  property: 'Imóvel',
  service: 'Serviço',
};

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export function AdForm({ category, onBack }: Props) {
  const { createAd, currentUser } = useApp();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [condition, setCondition] = useState<'new' | 'used' | ''>('');
  const [brand, setBrand] = useState('');
  const [region, setRegion] = useState('');
  const [contactPhone, setContactPhone] = useState(
    currentUser ? formatPhone(currentUser.phone) : ''
  );
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const showCondition = category === 'automobile' || category === 'product';
  const showBrand = category === 'product';

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach(file => {
      setPhotoFiles(prev => [...prev, file]);
      const reader = new FileReader();
      reader.onload = (ev) => {
        setPhotoPreviews(prev => [...prev, ev.target?.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removePhoto = (index: number) => {
    setPhotoFiles(prev => prev.filter((_, i) => i !== index));
    setPhotoPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const uploadPhotos = async (): Promise<string[]> => {
    if (!currentUser) return [];
    const urls: string[] = [];
    for (const file of photoFiles) {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `${currentUser.user_id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from('ad-photos').upload(path, file);
      if (error) {
        console.error('Upload error:', error);
        throw error;
      }
      const { data: urlData } = supabase.storage.from('ad-photos').getPublicUrl(path);
      urls.push(urlData.publicUrl);
    }
    return urls;
  };

  const handleSubmit = async () => {
    if (!title.trim()) { toast.error('Digite o nome do anúncio'); return; }
    if (!description.trim()) { toast.error('Digite uma descrição'); return; }
    if (!price.trim()) { toast.error('Digite o valor'); return; }
    if (photoPreviews.length === 0) { toast.error('Adicione pelo menos uma foto'); return; }
    if (!contactPhone.trim()) { toast.error('Digite o telefone de contato'); return; }
    if (showCondition && !condition) { toast.error('Selecione a condição'); return; }

    const priceNum = parseFloat(price.replace(/\D/g, '')) / 100;

    setSubmitting(true);
    try {
      const uploadedUrls = await uploadPhotos();
      const ad = await createAd({
        category,
        title: title.trim(),
        description: description.trim(),
        price: priceNum,
        condition: condition || undefined,
        brand: brand.trim() || undefined,
        region: region.trim() || undefined,
        main_photo: uploadedUrls[0],
        photos: uploadedUrls.slice(1),
        contact_phone: contactPhone.replace(/\D/g, ''),
      });
      setSubmitting(false);

      if (ad) {
        toast.success('Anúncio criado com sucesso!');
        navigate(`/ad/${ad.slug}`);
      } else {
        toast.error('Erro ao criar anúncio');
      }
    } catch {
      setSubmitting(false);
      toast.error('Erro ao enviar fotos');
    }
  };

  const formatPrice = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (!digits) return '';
    const num = parseInt(digits) / 100;
    return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  return (
    <div className="space-y-5 animate-fade-in-up">
      <div className="text-center space-y-1">
        <h2 className="text-xl font-bold text-foreground">
          Novo anúncio — {categoryLabels[category]}
        </h2>
        <p className="text-sm text-muted-foreground">Preencha os dados do seu anúncio</p>
      </div>

      {/* Photos */}
      <div>
        <label className="text-sm font-medium text-foreground mb-2 block">
          Fotos <span className="text-destructive">*</span>
        </label>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {photoPreviews.map((photo, i) => (
            <div key={i} className="relative flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden border-2 border-border">
              <img src={photo} alt="" className="w-full h-full object-cover" />
              <button
                onClick={() => removePhoto(i)}
                className="absolute top-0.5 right-0.5 w-5 h-5 bg-foreground/70 rounded-full flex items-center justify-center"
              >
                <X className="w-3 h-3 text-card" />
              </button>
              {i === 0 && (
                <span className="absolute bottom-0 left-0 right-0 bg-primary/80 text-primary-foreground text-[10px] text-center py-0.5">
                  Principal
                </span>
              )}
            </div>
          ))}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex-shrink-0 w-20 h-20 rounded-xl border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors active:scale-95"
          >
            <Camera className="w-5 h-5" />
            <span className="text-[10px]">Adicionar</span>
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handlePhotoUpload}
          className="hidden"
        />
      </div>

      {/* Title */}
      <div>
        <label className="text-sm font-medium text-foreground mb-1.5 block">
          {category === 'service' ? 'Nome do serviço' :
           category === 'property' ? 'Título do anúncio' :
           category === 'automobile' ? 'Nome do veículo' : 'Nome do produto'}
          <span className="text-destructive"> *</span>
        </label>
        <Input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Ex: Geladeira Consul 340L"
          className="h-12 rounded-xl"
        />
      </div>

      {/* Brand */}
      {showBrand && (
        <div>
          <label className="text-sm font-medium text-foreground mb-1.5 block">Marca</label>
          <Input
            value={brand}
            onChange={e => setBrand(e.target.value)}
            placeholder="Ex: Samsung, Apple..."
            className="h-12 rounded-xl"
          />
        </div>
      )}

      {/* Condition */}
      {showCondition && (
        <div>
          <label className="text-sm font-medium text-foreground mb-2 block">
            Condição <span className="text-destructive">*</span>
          </label>
          <div className="grid grid-cols-2 gap-2">
            {(['new', 'used'] as const).map(c => (
              <button
                key={c}
                onClick={() => setCondition(c)}
                className={`h-12 rounded-xl border-2 font-medium text-sm transition-all active:scale-[0.97] ${
                  condition === c
                    ? 'border-primary bg-accent text-accent-foreground'
                    : 'border-border text-muted-foreground hover:border-primary/30'
                }`}
              >
                {condition === c && <Check className="w-4 h-4 inline mr-1" />}
                {c === 'new' ? 'Novo' : 'Usado'}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Description */}
      <div>
        <label className="text-sm font-medium text-foreground mb-1.5 block">
          Descrição <span className="text-destructive">*</span>
        </label>
        <Textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Descreva seu anúncio..."
          className="min-h-[100px] rounded-xl resize-none"
        />
      </div>

      {/* Price */}
      <div>
        <label className="text-sm font-medium text-foreground mb-1.5 block">
          Valor <span className="text-destructive">*</span>
        </label>
        <Input
          type="tel"
          value={price}
          onChange={e => setPrice(formatPrice(e.target.value))}
          placeholder="R$ 0,00"
          className="h-12 rounded-xl text-lg font-bold"
        />
      </div>

      {/* Region */}
      <div>
        <label className="text-sm font-medium text-foreground mb-1.5 block">
          Cidade
        </label>
        <Input
          value={region}
          onChange={e => setRegion(e.target.value)}
          placeholder="Ex: Centro, Bairro X..."
          className="h-12 rounded-xl"
        />
      </div>

      {/* Contact */}
      <div>
        <label className="text-sm font-medium text-foreground mb-1.5 block">
          Telefone de contato <span className="text-destructive">*</span>
        </label>
        <Input
          type="tel"
          value={contactPhone}
          onChange={e => setContactPhone(formatPhone(e.target.value))}
          placeholder="(99) 99999-9999"
          className="h-12 rounded-xl"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <Button variant="outline" size="lg" onClick={onBack} className="flex-1">
          Voltar
        </Button>
        <Button variant="cta" size="lg" className="flex-1" onClick={handleSubmit} disabled={submitting}>
          {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Plus className="w-5 h-5" /> Publicar</>}
        </Button>
      </div>
    </div>
  );
}
