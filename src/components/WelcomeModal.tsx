import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useApp } from '@/contexts/AppContext';
import { supabase } from '@/integrations/supabase/client';
import { ArrowRight, UserPlus, Loader2 } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { ArrowRight, UserPlus, Loader2 } from 'lucide-react';
import logo from '@/assets/logo.png';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export function WelcomeModal() {
  const { login, register } = useApp();
  const [step, setStep] = useState<'phone' | 'pin' | 'register'>('phone');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handlePhoneContinue = () => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 10) {
      setError('Digite um número válido');
      return;
    }
    setError('');
    setPin('');
    setStep('pin');
  };

  const handlePinLogin = async () => {
    if (pin.length < 4) {
      setError('Digite os 4 dígitos do PIN');
      return;
    }
    setSubmitting(true);
    setError('');
    const digits = phone.replace(/\D/g, '');
    const result = await login(digits, pin);
    setSubmitting(false);

    if (result.success) return;
    if (result.error === 'not_found') {
      setPin('');
      setStep('register');
      return;
    }
    if (result.error === 'blocked') {
      setError('Conta bloqueada. Contate o administrador.');
      return;
    }
    if (result.error === 'wrong_pin') {
      setError('PIN incorreto. Tente novamente.');
      return;
    }
    setError(result.error || 'Erro ao entrar');
  };

  const handleRegister = async () => {
    if (!name.trim()) {
      setError('Digite seu nome');
      return;
    }
    if (pin.length < 4) {
      setError('Crie um PIN de 4 dígitos');
      return;
    }
    setSubmitting(true);
    setError('');
    const digits = phone.replace(/\D/g, '');
    const result = await register(digits, name.trim(), pin);
    setSubmitting(false);

    if (!result.success) {
      setError(result.error || 'Erro ao cadastrar');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-foreground/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-card w-full max-w-md rounded-t-2xl sm:rounded-2xl p-6 pb-8 shadow-2xl animate-slide-up sm:animate-scale-in">
        {step === 'phone' ? (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <img src={logo} alt="anunciaAI" className="mx-auto w-20 h-20 mb-4" />
              <h1 className="text-2xl font-bold text-foreground leading-tight">
                Bem-vindo ao <span className="text-cta">anunci</span>AI
              </h1>
              <p className="text-muted-foreground text-sm">
                Digite seu número de celular para começar
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
            </div>

            <Button
              variant="cta"
              size="xl"
              className="w-full"
              onClick={handlePhoneContinue}
              disabled={submitting}
            >
              Continuar <ArrowRight className="w-5 h-5" />
            </Button>
          </div>
        ) : step === 'pin' ? (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <img src={logo} alt="anunciaAI" className="mx-auto w-16 h-16 mb-4" />
              <h2 className="text-xl font-bold text-foreground">Digite seu PIN</h2>
              <p className="text-muted-foreground text-sm">
                Insira seu PIN de 4 dígitos para entrar
              </p>
              <div className="bg-muted rounded-xl px-4 py-2 text-sm text-muted-foreground inline-block">
                📱 {phone}
              </div>
            </div>

            <div className="flex flex-col items-center space-y-3">
              <InputOTP
                maxLength={4}
                value={pin}
                onChange={(value) => { setPin(value); setError(''); }}
              >
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                </InputOTPGroup>
              </InputOTP>
              {error && <p className="text-destructive text-sm text-center">{error}</p>}
            </div>

            <div className="flex gap-3">
              <Button variant="outline" size="lg" onClick={() => { setStep('phone'); setError(''); setPin(''); }} className="flex-1">
                Voltar
              </Button>
              <Button variant="cta" size="lg" className="flex-1" onClick={handlePinLogin} disabled={submitting || pin.length < 4}>
                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Entrar <ArrowRight className="w-5 h-5" /></>}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <div className="mx-auto w-14 h-14 rounded-2xl bg-accent flex items-center justify-center mb-4">
                <UserPlus className="w-7 h-7 text-accent-foreground" />
              </div>
              <h2 className="text-xl font-bold text-foreground">Cadastro rápido</h2>
              <p className="text-muted-foreground text-sm">
                Preencha seus dados e crie um PIN de 4 dígitos
              </p>
              <div className="bg-cta/10 text-cta rounded-xl px-4 py-2.5 text-xs font-medium">
                🔒 Crie um PIN para proteger sua conta. Você vai usá-lo sempre que entrar no app.
              </div>
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
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block text-center">Crie seu PIN</label>
                <div className="flex justify-center">
                  <InputOTP
                    maxLength={4}
                    value={pin}
                    onChange={(value) => { setPin(value); setError(''); }}
                  >
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>
              </div>
              {error && <p className="text-destructive text-sm text-center">{error}</p>}
            </div>

            <div className="flex gap-3">
              <Button variant="outline" size="lg" onClick={() => { setStep('phone'); setError(''); setPin(''); }} className="flex-1">
                Voltar
              </Button>
              <Button variant="cta" size="lg" className="flex-1" onClick={handleRegister} disabled={submitting}>
                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Criar conta'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
