import { useState } from 'react';
import { ArrowRight, DollarSign, Shield, Users } from 'lucide-react';
import { LoginForm } from './LoginForm';
import { RegisterForm } from './RegisterForm';

type AuthMode = 'landing' | 'login' | 'register';

export function LandingPage() {
  const [authMode, setAuthMode] = useState<AuthMode>('landing');

  if (authMode === 'login') {
    return <LoginForm onBack={() => setAuthMode('landing')} onSwitchToRegister={() => setAuthMode('register')} />;
  }

  if (authMode === 'register') {
    return <RegisterForm onBack={() => setAuthMode('landing')} onSwitchToLogin={() => setAuthMode('login')} />;
  }

  return (
    <div className="min-h-screen bg-dark-900 text-white flex flex-col">
      <nav className="p-6 flex items-center justify-between max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center font-bold text-white shadow-lg shadow-brand-500/20">
            V
          </div>
          <span className="text-xl font-bold tracking-tight text-white">
            VIPS<span className="text-brand-500">.lat</span>
          </span>
        </div>
        <div className="flex gap-4">
          <button
            onClick={() => setAuthMode('login')}
            className="px-4 py-2 text-gray-300 hover:text-white font-medium transition-colors"
          >
            Entrar
          </button>
          <button
            onClick={() => setAuthMode('register')}
            className="px-4 py-2 bg-white text-black font-bold rounded-lg hover:bg-gray-200 transition-colors"
          >
            Criar Conta
          </button>
        </div>
      </nav>

      <div className="flex-1 flex items-center justify-center px-4">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-tight">
            Monetize sua{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-500 to-purple-500">
              influência
            </span>{' '}
            com liberdade total.
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            A plataforma definitiva para criadores de conteúdo. Receba via PIX instantaneamente, gerencie assinantes e
            cresça sua comunidade sem burocracia.
          </p>
          <div className="flex flex-col md:flex-row items-center justify-center gap-4 pt-4">
            <button
              onClick={() => setAuthMode('register')}
              className="px-8 py-4 bg-brand-600 hover:bg-brand-500 text-white text-lg font-bold rounded-full transition-all shadow-xl shadow-brand-900/30 flex items-center gap-2"
            >
              Começar Agora <ArrowRight size={20} />
            </button>
            <button className="px-8 py-4 bg-dark-800 hover:bg-dark-700 text-white text-lg font-medium rounded-full border border-dark-700 transition-all">
              Saber mais
            </button>
          </div>
        </div>
      </div>

      <div className="border-t border-dark-800 bg-dark-950 py-12">
        <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="p-6 bg-dark-900 rounded-2xl border border-dark-800">
            <div className="w-12 h-12 bg-green-500/10 rounded-xl flex items-center justify-center text-green-500 mb-4">
              <DollarSign size={24} />
            </div>
            <h3 className="text-xl font-bold mb-2">Pagamentos via PIX</h3>
            <p className="text-gray-400">
              Receba seus ganhos diretamente em sua conta bancária com a velocidade do PIX. Sem esperar 30 dias.
            </p>
          </div>
          <div className="p-6 bg-dark-900 rounded-2xl border border-dark-800">
            <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-500 mb-4">
              <Shield size={24} />
            </div>
            <h3 className="text-xl font-bold mb-2">Segurança Total</h3>
            <p className="text-gray-400">
              Seu conteúdo protegido. Seus dados criptografados. Fique tranquilo para focar na criação.
            </p>
          </div>
          <div className="p-6 bg-dark-900 rounded-2xl border border-dark-800">
            <div className="w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center text-purple-500 mb-4">
              <Users size={24} />
            </div>
            <h3 className="text-xl font-bold mb-2">Comunidade Fiel</h3>
            <p className="text-gray-400">
              Ferramentas engajadoras para manter seus fãs próximos e dispostos a apoiar seu trabalho.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
