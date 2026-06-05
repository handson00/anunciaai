import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Target, Eye, Heart, Sparkles, Users, Shield, Zap } from 'lucide-react';
import logo from '@/assets/logo.png';

const values = [
  {
    icon: Users,
    title: 'Comunidade',
    description: 'Acreditamos no poder da comunidade maranhense. Conectamos pessoas para que negócios locais cresçam e prosperem juntos.'
  },
  {
    icon: Shield,
    title: 'Confiança',
    description: 'Transparência e segurança em cada transação. Valorizamos a honestidade entre compradores e vendedores.'
  },
  {
    icon: Zap,
    title: 'Agilidade',
    description: 'Processos simples e rápidos. Anuncie em poucos minutos e alcance clientes de forma instantânea.'
  },
  {
    icon: Sparkles,
    title: 'Inovação',
    description: 'Usamos tecnologia para facilitar o dia a dia. Publicação automática no WhatsApp e integração inteligente.'
  }
];

export default function AboutPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card/80 backdrop-blur-md border-b sticky top-0 z-10">
        <div className="container max-w-5xl mx-auto flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" aria-label="Voltar" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <img src={logo} alt="AnunciaAI" className="w-7 h-7" />
          </div>
        </div>
      </header>

      {/* Hero */}
      <div className="bg-gradient-to-b from-cta/10 to-background py-12 px-4">
        <div className="container max-w-3xl mx-auto text-center space-y-4">
          <img src={logo} alt="AnunciaAI" className="w-16 h-16 mx-auto" />
          <h1 className="text-3xl md:text-4xl font-extrabold text-foreground">
            Quem Somos
          </h1>
          <p className="text-muted-foreground text-base md:text-lg max-w-xl mx-auto leading-relaxed">
            O <span className="text-cta font-semibold">AnunciaAI</span> é o marketplace da comunidade do Maranhão, 
            criado para conectar quem vende com quem compra de forma simples, rápida e segura.
          </p>
        </div>
      </div>

      {/* Missão, Visão e Valores */}
      <main className="container max-w-3xl mx-auto px-4 py-8 pb-16 space-y-12">
        {/* Missão */}
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-cta/10 flex items-center justify-center flex-shrink-0">
              <Target className="w-6 h-6 text-cta" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">Missão</h2>
            </div>
          </div>
          <p className="text-muted-foreground leading-relaxed text-sm md:text-base">
            Democratizar o comércio local, oferecendo uma plataforma acessível onde qualquer pessoa 
            pode anunciar e vender seus produtos, imóveis, automóveis e serviços, fortalecendo a 
            economia da nossa região e conectando pessoas de verdade.
          </p>
        </section>

        {/* Visão */}
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-cta/10 flex items-center justify-center flex-shrink-0">
              <Eye className="w-6 h-6 text-cta" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">Visão</h2>
            </div>
          </div>
          <p className="text-muted-foreground leading-relaxed text-sm md:text-base">
            Ser o principal ponto de encontro digital do Maranhão para compra e venda, 
            reconhecido pela facilidade de uso, alcance imediato via WhatsApp e pela comunidade 
            ativa que transforma a maneira como o comércio local funciona.
          </p>
        </section>

        {/* Valores */}
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-cta/10 flex items-center justify-center flex-shrink-0">
              <Heart className="w-6 h-6 text-cta" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">Valores</h2>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {values.map((value) => (
              <div
                key={value.title}
                className="bg-card rounded-2xl p-5 border hover:shadow-md transition-shadow"
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-cta/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <value.icon className="w-4 h-4 text-cta" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground text-sm">{value.title}</h3>
                    <p className="text-muted-foreground text-sm mt-1 leading-relaxed">
                      {value.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <div className="text-center pt-6">
          <Button variant="cta" size="lg" onClick={() => navigate('/')}>
            Explorar o Marketplace
          </Button>
        </div>
      </main>

      {/* Footer link */}
      <footer className="border-t py-4 px-4 text-center">
        <p className="text-xs text-muted-foreground">
          AnunciaAI - O marketplace da comunidade do Maranhão
        </p>
      </footer>
    </div>
  );
}
