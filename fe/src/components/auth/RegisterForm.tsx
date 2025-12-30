import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button, Input } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';

type AccountType = 'subscriber' | 'creator';

const registerSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  username: z.string().min(3, 'Username deve ter pelo menos 3 caracteres').regex(/^[a-zA-Z0-9_]+$/, 'Apenas letras, números e _'),
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'Senha deve ter pelo menos 8 caracteres'),
});

type RegisterFormData = z.infer<typeof registerSchema>;

interface RegisterFormProps {
  onBack: () => void;
  onSwitchToLogin: () => void;
}

export function RegisterForm({ onBack, onSwitchToLogin }: RegisterFormProps) {
  const { register: registerUser, becomeCreator } = useAuth();
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [accountType, setAccountType] = useState<AccountType>('subscriber');

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterFormData) => {
    setError('');
    setIsLoading(true);
    try {
      // Register the user with username
      await registerUser(data.email, data.password, data.name, data.username);

      // If creator, call becomeCreator API with default price (can be changed later)
      if (accountType === 'creator') {
        await becomeCreator({
          displayName: data.name,
          subscriptionPrice: 2990, // R$ 29,90 default - can change in settings
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar conta');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-900 p-4 animate-fade-in">
      <div className="w-full max-w-md bg-dark-800 border border-dark-700 rounded-2xl p-8 shadow-2xl">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center font-bold text-white shadow-lg">
              V
            </div>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Crie sua conta</h2>
          <p className="text-gray-400">Comece a lucrar ou apoiar criadores</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">{error}</div>
          )}

          <Input
            label="Nome Completo"
            type="text"
            placeholder="Seu Nome"
            error={errors.name?.message}
            {...register('name')}
          />

          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-400 block">Username</label>
            <div className="relative">
              <span className="absolute left-4 top-3 text-gray-500">@</span>
              <input
                type="text"
                placeholder="seu_username"
                className="w-full bg-dark-900 border border-dark-700 rounded-xl pl-9 pr-4 py-3 text-white focus:outline-none focus:border-brand-500 transition-all"
                {...register('username')}
              />
            </div>
            {errors.username?.message && (
              <p className="text-xs text-red-400">{errors.username.message}</p>
            )}
          </div>

          <Input label="Email" type="email" placeholder="seu@email.com" error={errors.email?.message} {...register('email')} />

          <Input
            label="Senha"
            type="password"
            placeholder="••••••••"
            error={errors.password?.message}
            {...register('password')}
          />

          {/* Account Type Selection */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-400 block">Tipo de Conta</label>
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => setAccountType('creator')}
                className={`flex-1 py-2 border rounded-lg text-sm font-medium transition-all ${
                  accountType === 'creator'
                    ? 'bg-brand-500/10 border-brand-500 text-brand-500'
                    : 'bg-dark-700 border-dark-600 text-gray-300 hover:bg-dark-600 hover:text-white'
                }`}
              >
                Sou Criador
              </button>
              <button
                type="button"
                onClick={() => setAccountType('subscriber')}
                className={`flex-1 py-2 border rounded-lg text-sm font-medium transition-all ${
                  accountType === 'subscriber'
                    ? 'bg-brand-500/10 border-brand-500 text-brand-500'
                    : 'bg-dark-700 border-dark-600 text-gray-300 hover:bg-dark-600 hover:text-white'
                }`}
              >
                Sou Assinante
              </button>
            </div>
          </div>

          <Button type="submit" className="w-full" isLoading={isLoading}>
            {accountType === 'creator' ? 'Criar Conta de Criador' : 'Cadastrar Gratuitamente'}
          </Button>

          <div className="text-center text-sm text-gray-400 mt-4">
            Já tem uma conta?{' '}
            <button type="button" onClick={onSwitchToLogin} className="text-brand-500 hover:underline">
              Fazer login
            </button>
          </div>

          <div className="text-center mt-6">
            <button type="button" onClick={onBack} className="text-gray-500 hover:text-white text-sm">
              Voltar ao início
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
