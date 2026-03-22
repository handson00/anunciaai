import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useApp } from '@/contexts/AppContext';
import { supabase } from '@/integrations/supabase/client';
import { ArrowRight, UserPlus, Loader2, KeyRound } from 'lucide-react';
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
  const [step, setStep] = useState<'phone' | 'pin' | 'register' | 'recover-send' | 'recover-code' | 'recover-newpin'>('phone');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [name, setName] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const digits = phone.replace(/\D/g, '');

  const handlePhoneContinue = async () => {
    if (digits.length < 10) {
      setError('Digite um número válido');
      return;
    }
    setSubmitting(true);
    setError('');
    setPin('');

    try {
      const { data } = await supabase.functions.invoke('verificar-telefone', {
        body: { phone: digits },
      });
      setSubmitting(false);
      if (data?.exists) {
        setStep('pin');
      } else {
        setStep('register');
      }
    } catch {
      setSubmitting(false);
      setStep('register');
    }
  };

  const handlePinLogin = async () => {
    if (pin.length < 4) {
      setError('Digite os 4 dígitos do PIN');
      return;
    }
    setSubmitting(true);
    setError('');
    const result = await login(digits, pin);
    setSubmitting(false);

    if (result.success) return;
    if (result.error === 'not_found' || result.error === 'wrong_pin') {
      setError('PIN incorreto. Tente novamente.');
      return;
    }
    if (result.error === 'blocked') {
      setError('Conta bloqueada. Contate o administrador.');
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
    const result = await register(digits, name.trim(), pin);
    setSubmitting(false);

    if (!result.success) {
      setError(result.error || 'Erro ao cadastrar');
    }
  };

  const handleSendRecoveryCode = async () => {
    setSubmitting(true);
    setError('');
    try {
      const { data } = await supabase.functions.invoke('recuperar-pin', {
        body: { phone: digits },
      });
      setSubmitting(false);
      if (data?.success) {
        setStep('recover-code');
        setSuccess('Código enviado para seu WhatsApp!');
      } else {
        setError(data?.error || 'Erro ao enviar código');
      }
    } catch {
      setSubmitting(false);
      setError('Erro ao enviar código');
    }
  };

  const handleVerifyAndResetPin = async () => {
    if (recoveryCode.length < 6) {
      setError('Digite o código de 6 dígitos');
      return;
    }
    if (pin.length < 4) {
      setError('Crie um novo PIN de 4 dígitos');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const { data } = await supabase.functions.invoke('redefinir-pin', {
        body: { phone: digits, code: recoveryCode, newPin: pin },
      });
      setSubmitting(false);
      if (data?.success) {
        setPin('');
        setRecoveryCode('');
        setSuccess('PIN redefinido com sucesso!');
        setStep('pin');
      } else {
        setError(data?.error || 'Erro ao redefinir PIN');
      }
    } catch {
      setSubmitting(false);
      setError('Erro ao redefinir PIN');
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
              {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Continuar <ArrowRight className="w-5 h-5" /></>}
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

            {success && <p className="text-green-600 text-sm text-center font-medium">{success}</p>}

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
              <Button variant="outline" size="lg" onClick={() => { setStep('phone'); setError(''); setPin(''); setSuccess(''); }} className="flex-1">
                Voltar
              </Button>
              <Button variant="cta" size="lg" className="flex-1" onClick={handlePinLogin} disabled={submitting || pin.length < 4}>
                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Entrar <ArrowRight className="w-5 h-5" /></>}
              </Button>
            </div>

            <button
              type="button"
              className="w-full text-sm text-cta hover:underline text-center"
              onClick={() => { setError(''); setSuccess(''); setStep('recover-send'); }}
            >
              Esqueci meu PIN
            </button>
          </div>
        ) : step === 'recover-send' ? (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <div className="mx-auto w-14 h-14 rounded-2xl bg-accent flex items-center justify-center mb-4">
                <KeyRound className="w-7 h-7 text-accent-foreground" />
              </div>
              <h2 className="text-xl font-bold text-foreground">Recuperar PIN</h2>
              <p className="text-muted-foreground text-sm">
                Vamos enviar um código de verificação para seu WhatsApp
              </p>
              <div className="bg-muted rounded-xl px-4 py-2 text-sm text-muted-foreground inline-block">
                📱 {phone}
              </div>
            </div>

            {error && <p className="text-destructive text-sm text-center">{error}</p>}

            <div className="flex gap-3">
              <Button variant="outline" size="lg" onClick={() => { setStep('pin'); setError(''); }} className="flex-1">
                Voltar
              </Button>
              <Button variant="cta" size="lg" className="flex-1" onClick={handleSendRecoveryCode} disabled={submitting}>
                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Enviar código'}
              </Button>
            </div>
          </div>
        ) : step === 'recover-code' ? (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <div className="mx-auto w-14 h-14 rounded-2xl bg-accent flex items-center justify-center mb-4">
                <KeyRound className="w-7 h-7 text-accent-foreground" />
              </div>
              <h2 className="text-xl font-bold text-foreground">Novo PIN</h2>
              <p className="text-muted-foreground text-sm">
                Digite o código recebido no WhatsApp e crie um novo PIN
              </p>
              {success && <p className="text-green-600 text-sm font-medium">{success}</p>}
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block text-center">Código de verificação</label>
                <div className="flex justify-center">
                  <InputOTP
                    maxLength={6}
                    value={recoveryCode}
                    onChange={(value) => { setRecoveryCode(value); setError(''); }}
                  >
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-foreground mb-2 block text-center">Novo PIN de 4 dígitos</label>
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
              <Button variant="outline" size="lg" onClick={() => { setStep('recover-send'); setError(''); setSuccess(''); setRecoveryCode(''); setPin(''); }} className="flex-1">
                Voltar
              </Button>
              <Button variant="cta" size="lg" className="flex-1" onClick={handleVerifyAndResetPin} disabled={submitting || recoveryCode.length < 6 || pin.length < 4}>
                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Redefinir PIN'}
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
