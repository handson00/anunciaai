import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useApp } from '@/contexts/AppContext';
import { Smartphone, ArrowRight, UserPlus } from 'lucide-react';

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export function WelcomeModal() {
  const { login, register } = useApp();
  const [step, setStep] = useState<'phone' | 'register'>('phone');
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [blocked, setBlocked] = useState(false);

  const handlePhoneSubmit = () => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 10) {
      setError('Digite um número válido');
      return;
    }
    const user = login(digits);
    if (user) return; // logged in
    if (user === null && blocked === false) {
      // Check if user exists but is blocked
      setStep('register');
    }
  };

  const handlePhoneContinue = () => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 10) {
      setError('Digite um número válido');
      return;
    }
    const result = login(digits);
    if (result) return;
    // user not found, go to register
    setStep('register');
  };

  const handleRegister = () => {
    if (!name.trim()) {
      setError('Digite seu nome');
      return;
    }
    register(phone, name.trim());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-foreground/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-card w-full max-w-md rounded-t-2xl sm:rounded-2xl p-6 pb-8 shadow-2xl animate-slide-up sm:animate-scale-in">
        {step === 'phone' ? (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <div className="mx-auto w-14 h-14 rounded-2xl bg-accent flex items-center justify-center mb-4">
                <Smartphone className="w-7 h-7 text-accent-foreground" />
              </div>
              <h1 className="text-2xl font-bold text-foreground leading-tight">
                Bem-vindo ao <span className="text-cta">anunci</span>AI
              </h1>
              <p className="text-muted-foreground text-sm">
                Digite seu número de celular para começar a anunciar
              </p>
            </div>

            <div className="space-y-3">
              <Input
                type="tel"
                placeholder="(99) 99999-9999"
                value={phone}
                onChange={(e) => {
                  setPhone(formatPhone(e.target.value));
                  setError('');
                }}
                className="h-13 text-lg text-center rounded-xl border-2 border-input focus:border-primary"
                autoFocus
              />
              {error && <p className="text-destructive text-sm text-center">{error}</p>}
              {blocked && <p className="text-destructive text-sm text-center">Conta bloqueada. Contate o administrador.</p>}
            </div>

            <Button
              variant="cta"
              size="xl"
              className="w-full"
              onClick={handlePhoneContinue}
            >
              Continuar
              <ArrowRight className="w-5 h-5" />
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <div className="mx-auto w-14 h-14 rounded-2xl bg-accent flex items-center justify-center mb-4">
                <UserPlus className="w-7 h-7 text-accent-foreground" />
              </div>
              <h2 className="text-xl font-bold text-foreground">Cadastro rápido</h2>
              <p className="text-muted-foreground text-sm">
                Só precisamos do seu nome para começar
              </p>
            </div>

            <div className="space-y-3">
              <div className="bg-muted rounded-xl px-4 py-3 text-sm text-muted-foreground">
                📱 {phone}
              </div>
              <Input
                placeholder="Seu nome ou nome da loja"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError('');
                }}
                className="h-13 text-base rounded-xl border-2 border-input focus:border-primary"
                autoFocus
              />
              {error && <p className="text-destructive text-sm text-center">{error}</p>}
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                size="lg"
                onClick={() => setStep('phone')}
                className="flex-1"
              >
                Voltar
              </Button>
              <Button
                variant="cta"
                size="lg"
                className="flex-1"
                onClick={handleRegister}
              >
                Criar conta
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
