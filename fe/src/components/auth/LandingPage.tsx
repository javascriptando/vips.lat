import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  DollarSign,
  Shield,
  Users,
  Zap,
  Heart,
  TrendingUp,
  CheckCircle2,
  Play,
  Star,
  MessageCircle,
  Lock,
  CreditCard,
  Sparkles,
  ChevronRight,
  Instagram,
  Twitter,
} from 'lucide-react';
import { LoginForm } from './LoginForm';
import { RegisterForm } from './RegisterForm';

type AuthMode = 'landing' | 'login' | 'register';

// Animated counter hook
function useCountUp(end: number, duration: number = 2000, start: number = 0) {
  const [count, setCount] = useState(start);
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.1 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible) return;

    let startTime: number;
    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const progress = Math.min((currentTime - startTime) / duration, 1);
      setCount(Math.floor(progress * (end - start) + start));
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    requestAnimationFrame(animate);
  }, [isVisible, end, duration, start]);

  return { count, ref };
}

// Floating shapes component
function FloatingShapes() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="absolute top-20 left-10 w-72 h-72 bg-brand-500/20 rounded-full blur-3xl animate-pulse" />
      <div className="absolute top-40 right-20 w-96 h-96 bg-purple-500/15 rounded-full blur-3xl animate-pulse delay-1000" />
      <div className="absolute bottom-20 left-1/3 w-80 h-80 bg-pink-500/10 rounded-full blur-3xl animate-pulse delay-500" />
    </div>
  );
}

// Feature card with hover effect - Mobile optimized
function FeatureCard({
  icon: Icon,
  title,
  description,
  gradient,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  gradient: string;
}) {
  return (
    <div className="group relative p-5 md:p-8 bg-dark-800/50 backdrop-blur-sm rounded-2xl md:rounded-3xl border border-dark-700/50 hover:border-brand-500/50 transition-all duration-500 hover:-translate-y-2 h-full">
      <div className="absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-10 transition-opacity duration-500 rounded-2xl md:rounded-3xl" style={{ backgroundImage: gradient }} />
      <div className={`w-11 h-11 md:w-14 md:h-14 rounded-xl md:rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center mb-4 md:mb-6 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
        <Icon size={22} className="text-white md:w-7 md:h-7" />
      </div>
      <h3 className="text-lg md:text-xl font-bold text-white mb-2 md:mb-3 group-hover:text-brand-400 transition-colors">{title}</h3>
      <p className="text-gray-400 text-sm md:text-base leading-relaxed">{description}</p>
    </div>
  );
}

// Step component for How It Works - Mobile optimized
function Step({ number, title, description }: { number: number; title: string; description: string }) {
  return (
    <div className="relative flex gap-4 md:gap-6 group">
      <div className="flex flex-col items-center">
        <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center text-white font-bold text-base md:text-lg shadow-lg shadow-brand-500/30 group-hover:scale-110 transition-transform">
          {number}
        </div>
        {number < 4 && <div className="w-0.5 h-full bg-gradient-to-b from-brand-500/50 to-transparent mt-3 md:mt-4" />}
      </div>
      <div className="pb-8 md:pb-12">
        <h3 className="text-base md:text-xl font-bold text-white mb-1 md:mb-2 group-hover:text-brand-400 transition-colors">{title}</h3>
        <p className="text-gray-400 text-sm md:text-base">{description}</p>
      </div>
    </div>
  );
}

// Testimonial card - Mobile optimized
function TestimonialCard({
  name,
  username,
  text,
  avatar,
  earnings,
}: {
  name: string;
  username: string;
  text: string;
  avatar: string;
  earnings: string;
}) {
  return (
    <div className="p-4 md:p-6 bg-dark-800/50 backdrop-blur-sm rounded-xl md:rounded-2xl border border-dark-700/50 hover:border-brand-500/30 transition-all h-full">
      <div className="flex items-start gap-3 md:gap-4 mb-3 md:mb-4">
        <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center text-white font-bold text-base md:text-lg flex-shrink-0">
          {avatar}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 md:gap-2">
            <span className="font-bold text-white text-sm md:text-base truncate">{name}</span>
            <CheckCircle2 size={14} className="text-blue-500 flex-shrink-0" />
          </div>
          <span className="text-gray-500 text-xs md:text-sm">@{username}</span>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-green-400 font-bold text-sm md:text-base">{earnings}</div>
          <div className="text-gray-500 text-[10px] md:text-xs">este mês</div>
        </div>
      </div>
      <p className="text-gray-300 text-sm md:text-base leading-relaxed">{text}</p>
      <div className="flex gap-0.5 md:gap-1 mt-3 md:mt-4">
        {[...Array(5)].map((_, i) => (
          <Star key={i} size={14} className="text-yellow-500 fill-yellow-500 md:w-4 md:h-4" />
        ))}
      </div>
    </div>
  );
}

export function LandingPage() {
  const [authMode, setAuthMode] = useState<AuthMode>('landing');

  // Stats with count-up animation
  const creators = useCountUp(2500, 2000);
  const earnings = useCountUp(850, 2000);
  const subscribers = useCountUp(45, 2000);

  if (authMode === 'login') {
    return <LoginForm onBack={() => setAuthMode('landing')} onSwitchToRegister={() => setAuthMode('register')} />;
  }

  if (authMode === 'register') {
    return <RegisterForm onBack={() => setAuthMode('landing')} onSwitchToLogin={() => setAuthMode('login')} />;
  }

  return (
    <div className="min-h-screen bg-dark-900 text-white overflow-x-hidden">
      {/* Navbar - Mobile Optimized */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-dark-900/90 backdrop-blur-xl border-b border-dark-800/50">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 md:py-4 flex items-center justify-between">
          <img src="/logo.png" alt="VIPS.lat" className="h-6 md:h-8" />
          <div className="hidden lg:flex items-center gap-8">
            <a href="#features" className="text-gray-400 hover:text-white transition-colors font-medium">Recursos</a>
            <a href="#how-it-works" className="text-gray-400 hover:text-white transition-colors font-medium">Como funciona</a>
            <a href="#testimonials" className="text-gray-400 hover:text-white transition-colors font-medium">Depoimentos</a>
          </div>
          <div className="flex items-center gap-2 md:gap-3">
            <button
              onClick={() => setAuthMode('login')}
              className="px-3 md:px-5 py-2 md:py-2.5 text-sm md:text-base text-gray-300 hover:text-white font-medium transition-colors"
            >
              Entrar
            </button>
            <button
              onClick={() => setAuthMode('register')}
              className="px-3 md:px-5 py-2 md:py-2.5 text-sm md:text-base bg-gradient-to-r from-brand-500 to-purple-600 text-white font-bold rounded-full hover:shadow-lg hover:shadow-brand-500/30 transition-all hover:-translate-y-0.5"
            >
              Criar
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section - Mobile Optimized */}
      <section className="relative min-h-[85vh] md:min-h-screen flex items-center justify-center pt-16 md:pt-20">
        <FloatingShapes />
        <div className="relative z-10 md:max-w-6xl max-w-sm mx-auto px-4 md:px-6 py-8 md:py-20 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-1.5 md:gap-2 px-3 md:px-4 py-1.5 md:py-2 bg-brand-500/10 border border-brand-500/20 rounded-full text-brand-400 text-xs md:text-sm font-medium mb-5 md:mb-8 animate-fade-in">
            <Sparkles size={14} className="md:w-4 md:h-4" />
            <span>A plataforma #1 para criadores</span>
          </div>

          {/* Main headline */}
          <h1 className="text-4xl sm:text-5xl md:text-7xl lg:text-8xl font-black tracking-tight leading-[0.95] mb-5 md:mb-8">
            <span className="block">Transforme sua</span>
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-brand-400 via-purple-400 to-pink-400 animate-gradient">
              influência em renda
            </span>
          </h1>

          {/* Subheadline */}
          <p className="text-base md:text-xl lg:text-2xl text-gray-400 max-w-3xl mx-auto mb-8 md:mb-12 leading-relaxed px-2">
            Crie conteúdo exclusivo, receba via <span className="text-green-400 font-semibold">PIX instantâneo</span> e construa sua comunidade.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 md:gap-4 mb-8 md:mb-16">
            <button
              onClick={() => setAuthMode('register')}
              className="group w-full sm:w-auto px-6 md:px-8 py-3.5 md:py-4 bg-gradient-to-r from-brand-500 to-purple-600 text-white text-base md:text-lg font-bold rounded-full transition-all shadow-xl shadow-brand-500/30 hover:shadow-2xl hover:shadow-brand-500/40 hover:-translate-y-1 flex items-center justify-center gap-2 md:gap-3"
            >
              Começar Grátis
              <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </button>
            <button className="w-full sm:w-auto px-6 md:px-8 py-3.5 md:py-4 bg-dark-800 hover:bg-dark-700 text-white text-base md:text-lg font-medium rounded-full border border-dark-700 hover:border-dark-600 transition-all flex items-center justify-center gap-2">
              <Play size={18} className="text-brand-400" />
              Como funciona
            </button>
          </div>

          {/* Trust badges - Horizontal scroll on mobile */}
          <div className="flex md:flex-wrap items-center justify-start md:justify-center gap-4 md:gap-8 overflow-x-auto pb-2 md:pb-0 px-2 md:px-0 scrollbar-hide text-gray-500 text-xs md:text-sm">
            <div className="flex items-center gap-1.5 md:gap-2 flex-shrink-0">
              <Shield size={16} className="text-green-500" />
              <span className="whitespace-nowrap">Pagamentos seguros</span>
            </div>
            <div className="flex items-center gap-1.5 md:gap-2 flex-shrink-0">
              <Zap size={16} className="text-yellow-500" />
              <span className="whitespace-nowrap">PIX instantâneo</span>
            </div>
            <div className="flex items-center gap-1.5 md:gap-2 flex-shrink-0">
              <Lock size={16} className="text-blue-500" />
              <span className="whitespace-nowrap">Conteúdo protegido</span>
            </div>
          </div>
        </div>

        {/* Scroll indicator - Hidden on mobile */}
        <div className="hidden md:block absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <div className="w-6 h-10 border-2 border-gray-600 rounded-full flex justify-center pt-2">
            <div className="w-1.5 h-3 bg-gray-500 rounded-full animate-pulse" />
          </div>
        </div>
      </section>

      {/* Stats Section - Compact on mobile */}
      <section className="py-10 md:py-20 border-y border-dark-800 bg-dark-950/50">
        <div className="md:max-w-6xl mx-auto px-4 md:px-6">
          <div className="flex md:grid md:grid-cols-3 gap-6 md:gap-8 overflow-x-auto pb-2 md:pb-0 snap-x snap-mandatory scrollbar-hide">
            <div ref={creators.ref} className="text-center flex-shrink-0 w-[140px] md:w-auto snap-center">
              <div className="text-3xl md:text-5xl lg:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-brand-400 to-purple-400 mb-1">
                {creators.count.toLocaleString()}+
              </div>
              <div className="text-gray-400 text-sm md:text-base font-medium">Criadores</div>
            </div>
            <div ref={earnings.ref} className="text-center flex-shrink-0 w-[140px] md:w-auto snap-center">
              <div className="text-3xl md:text-5xl lg:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-400 mb-1">
                R${earnings.count}K+
              </div>
              <div className="text-gray-400 text-sm md:text-base font-medium">Pagos</div>
            </div>
            <div ref={subscribers.ref} className="text-center flex-shrink-0 w-[140px] md:w-auto snap-center">
              <div className="text-3xl md:text-5xl lg:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-rose-400 mb-1">
                {subscribers.count}K+
              </div>
              <div className="text-gray-400 text-sm md:text-base font-medium">Assinantes</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section - Carousel on mobile */}
      <section id="features" className="py-12 md:py-24 relative">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8 md:mb-16 px-4 md:px-6">
            <span className="text-brand-400 font-semibold text-xs md:text-sm uppercase tracking-wider">Recursos</span>
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black mt-3 md:mt-4 mb-3 md:mb-6">
              Tudo para{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-400 to-purple-400">
                crescer
              </span>
            </h2>
            <p className="text-gray-400 text-sm md:text-lg max-w-2xl mx-auto">
              Ferramentas poderosas para monetizar sua audiência.
            </p>
          </div>

          {/* Mobile: Horizontal scroll / Desktop: Grid */}
          <div className="flex md:grid md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 overflow-x-auto pb-4 md:pb-0 px-4 md:px-6 snap-x snap-mandatory scrollbar-hide">
            <div className="flex-shrink-0 w-[280px] md:w-auto snap-center">
              <FeatureCard
                icon={DollarSign}
                title="PIX Instantâneo"
                description="Receba direto na conta em segundos. Sem esperar 30 dias."
                gradient="from-green-500 to-emerald-600"
              />
            </div>
            <div className="flex-shrink-0 w-[280px] md:w-auto snap-center">
              <FeatureCard
                icon={Shield}
                title="Conteúdo Protegido"
                description="Anti-pirataria com marca d'água e bloqueio de screenshot."
                gradient="from-blue-500 to-cyan-600"
              />
            </div>
            <div className="flex-shrink-0 w-[280px] md:w-auto snap-center">
              <FeatureCard
                icon={Heart}
                title="Engajamento Real"
                description="Mensagens, gorjetas e notificações para fãs conectados."
                gradient="from-pink-500 to-rose-600"
              />
            </div>
            <div className="flex-shrink-0 w-[280px] md:w-auto snap-center">
              <FeatureCard
                icon={TrendingUp}
                title="Analytics Avançado"
                description="Métricas detalhadas de visualizações e crescimento."
                gradient="from-purple-500 to-violet-600"
              />
            </div>
            <div className="flex-shrink-0 w-[280px] md:w-auto snap-center">
              <FeatureCard
                icon={CreditCard}
                title="Múltiplas Formas"
                description="Assinaturas, PPV, gorjetas e pacotes de mídia."
                gradient="from-orange-500 to-amber-600"
              />
            </div>
            <div className="flex-shrink-0 w-[280px] md:w-auto snap-center">
              <FeatureCard
                icon={Users}
                title="Comunidade Fiel"
                description="Chat e conteúdo exclusivo para seus fãs."
                gradient="from-brand-500 to-purple-600"
              />
            </div>
          </div>
        </div>
      </section>

      {/* How It Works - Compact on mobile */}
      <section id="how-it-works" className="py-12 md:py-24 bg-dark-950/50">
        <div className="md:max-w-6xl max-w-sm mx-auto px-4 md:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-16 items-center">
            <div>
              <span className="text-brand-400 font-semibold text-xs md:text-sm uppercase tracking-wider">Como funciona</span>
              <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black mt-3 md:mt-4 mb-4 md:mb-6">
                Comece em{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-400 to-purple-400">
                  minutos
                </span>
              </h2>
              <p className="text-gray-400 text-sm md:text-lg mb-6 md:mb-12">
                Processo simples para monetizar seu conteúdo.
              </p>

              <div className="space-y-1 md:space-y-2">
                <Step
                  number={1}
                  title="Crie sua conta"
                  description="Cadastro rápido em menos de 1 minuto."
                />
                <Step
                  number={2}
                  title="Configure seu perfil"
                  description="Foto, bio e preço da assinatura."
                />
                <Step
                  number={3}
                  title="Publique conteúdo"
                  description="Upload de fotos e vídeos exclusivos."
                />
                <Step
                  number={4}
                  title="Receba via PIX"
                  description="Ganhos direto na sua conta."
                />
              </div>
            </div>

            {/* Phone mockup - Hidden on mobile */}
            <div className="relative hidden lg:block">
              <div className="absolute inset-0 bg-gradient-to-br from-brand-500/20 to-purple-500/20 blur-3xl" />
              <div className="relative bg-dark-800 rounded-[3rem] p-3 border border-dark-700 shadow-2xl">
                <div className="bg-dark-900 rounded-[2.5rem] overflow-hidden">
                  {/* Status bar */}
                  <div className="bg-dark-800 px-6 py-3 flex items-center justify-between">
                    <span className="text-xs text-gray-400">9:41</span>
                    <div className="w-24 h-6 bg-dark-700 rounded-full" />
                    <div className="flex gap-1">
                      <div className="w-4 h-4 bg-gray-600 rounded-sm" />
                      <div className="w-4 h-4 bg-gray-600 rounded-sm" />
                    </div>
                  </div>
                  {/* App content mockup */}
                  <div className="p-4 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-brand-500 to-purple-600" />
                      <div>
                        <div className="h-4 w-24 bg-dark-700 rounded" />
                        <div className="h-3 w-16 bg-dark-800 rounded mt-1" />
                      </div>
                    </div>
                    <div className="aspect-square bg-gradient-to-br from-dark-700 to-dark-800 rounded-2xl flex items-center justify-center">
                      <Play size={48} className="text-white/50" />
                    </div>
                    <div className="flex gap-4">
                      <Heart className="text-red-500" />
                      <MessageCircle className="text-gray-500" />
                      <DollarSign className="text-green-500" />
                    </div>
                    <div className="h-3 w-full bg-dark-800 rounded" />
                    <div className="h-3 w-3/4 bg-dark-800 rounded" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials - Carousel on mobile */}
      <section id="testimonials" className="py-12 md:py-24">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8 md:mb-16 px-4 md:px-6">
            <span className="text-brand-400 font-semibold text-xs md:text-sm uppercase tracking-wider">Depoimentos</span>
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black mt-3 md:mt-4 mb-3 md:mb-6">
              Criadores que{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-400 to-purple-400">
                amam
              </span>{' '}
              a VIPS
            </h2>
          </div>

          {/* Mobile: Horizontal scroll / Desktop: Grid */}
          <div className="flex md:grid md:grid-cols-3 gap-4 md:gap-6 overflow-x-auto pb-4 md:pb-0 px-4 md:px-6 snap-x snap-mandatory scrollbar-hide">
            <div className="flex-shrink-0 w-[300px] md:w-auto snap-center">
              <TestimonialCard
                name="Camila Santos"
                username="camilasantos"
                avatar="C"
                earnings="R$ 12.450"
                text="Migrei de outra plataforma e não me arrependo. O PIX instantâneo mudou minha vida!"
              />
            </div>
            <div className="flex-shrink-0 w-[300px] md:w-auto snap-center">
              <TestimonialCard
                name="Rafael Lima"
                username="rafalima"
                avatar="R"
                earnings="R$ 8.920"
                text="Interface linda e suporte super rápido. Ferramentas de engajamento incríveis."
              />
            </div>
            <div className="flex-shrink-0 w-[300px] md:w-auto snap-center">
              <TestimonialCard
                name="Julia Mendes"
                username="juliamendes"
                avatar="J"
                earnings="R$ 24.780"
                text="Em 3 meses virou minha renda principal. Simples de usar e taxas justas."
              />
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section - Compact on mobile */}
      <section className="py-12 md:py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-600/20 via-purple-600/20 to-pink-600/20" />
        <div className="absolute inset-0">
          <div className="absolute top-0 left-1/4 w-48 md:w-96 h-48 md:h-96 bg-brand-500/30 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-48 md:w-96 h-48 md:h-96 bg-purple-500/30 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto px-4 md:px-6 text-center">
          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-6xl font-black mb-4 md:mb-6">
            Pronto para{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-400 to-purple-400">
              ganhar
            </span>
            ?
          </h2>
          <p className="text-base md:text-xl text-gray-400 mb-6 md:mb-10 max-w-2xl mx-auto">
            Junte-se a milhares de criadores na VIPS.
          </p>
          <button
            onClick={() => setAuthMode('register')}
            className="group w-full sm:w-auto px-6 md:px-10 py-3.5 md:py-5 bg-white text-dark-900 text-base md:text-xl font-bold rounded-full transition-all shadow-2xl hover:shadow-white/20 hover:-translate-y-1 inline-flex items-center justify-center gap-2 md:gap-3"
          >
            Criar Conta Grátis
            <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />
          </button>
          <p className="text-gray-500 text-xs md:text-sm mt-4 md:mt-6">
            Sem taxas. Comece hoje.
          </p>
        </div>
      </section>

      {/* Footer - Centered on mobile */}
      <footer className="border-t border-dark-800 bg-dark-950 py-10 md:py-16">
        <div className="max-w-6xl mx-auto px-4 md:px-6">
          {/* Mobile: Centered / Desktop: Grid */}
          <div className="flex flex-col md:grid md:grid-cols-4 gap-8 md:gap-12 mb-8 md:mb-12 text-center md:text-left">
            {/* Brand */}
            <div className="md:col-span-2 flex flex-col items-center md:items-start">
              <img src="/logo.png" alt="VIPS.lat" className="h-6 md:h-8 mb-3 md:mb-4" />
              <p className="text-gray-500 text-sm md:text-base max-w-sm mb-4 md:mb-6">
                Plataforma brasileira para criadores monetizarem sua influência.
              </p>
              <div className="flex gap-3 md:gap-4 justify-center md:justify-start">
                <a href="#" className="w-9 h-9 md:w-10 md:h-10 bg-dark-800 rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-dark-700 transition-colors">
                  <Instagram size={18} />
                </a>
                <a href="#" className="w-9 h-9 md:w-10 md:h-10 bg-dark-800 rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-dark-700 transition-colors">
                  <Twitter size={18} />
                </a>
              </div>
            </div>

            {/* Links - Inline on mobile */}
            <div className="flex md:flex-col gap-4 md:gap-0 justify-center md:justify-start">
              <h4 className="hidden md:block font-bold text-white mb-4">Plataforma</h4>
              <a href="#features" className="text-gray-500 hover:text-white transition-colors text-sm md:text-base md:mb-3">Recursos</a>
              <a href="#how-it-works" className="text-gray-500 hover:text-white transition-colors text-sm md:text-base md:mb-3">Como funciona</a>
              <a href="#testimonials" className="text-gray-500 hover:text-white transition-colors text-sm md:text-base">Depoimentos</a>
            </div>

            <div className="flex md:flex-col gap-4 md:gap-0 justify-center md:justify-start">
              <h4 className="hidden md:block font-bold text-white mb-4">Legal</h4>
              <Link to="/termos" className="text-gray-500 hover:text-white transition-colors text-sm md:text-base md:mb-3">Termos</Link>
              <Link to="/privacidade" className="text-gray-500 hover:text-white transition-colors text-sm md:text-base md:mb-3">Privacidade</Link>
              <a href="mailto:suporte@vips.lat" className="text-gray-500 hover:text-white transition-colors text-sm md:text-base">Contato</a>
            </div>
          </div>

          <div className="border-t border-dark-800 pt-6 md:pt-8 flex flex-col md:flex-row items-center justify-center md:justify-between gap-2 md:gap-4 text-center">
            <p className="text-gray-600 text-xs md:text-sm">
              &copy; {new Date().getFullYear()} VIPS.lat
            </p>
            <p className="text-gray-600 text-xs md:text-sm">
              Feito com <Heart size={12} className="inline text-red-500" /> no Brasil
            </p>
          </div>
        </div>
      </footer>

      {/* CSS for gradient animation and utilities */}
      <style>{`
        @keyframes gradient {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        .animate-gradient {
          background-size: 200% 200%;
          animation: gradient 5s ease infinite;
        }
        .animate-fade-in {
          animation: fadeIn 0.6s ease-out forwards;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .delay-500 { animation-delay: 0.5s; }
        .delay-1000 { animation-delay: 1s; }
        /* Hide scrollbar but keep functionality */
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}
