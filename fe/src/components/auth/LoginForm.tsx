import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button, Input } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Senha é obrigatória'),
});

type LoginFormData = z.infer<typeof loginSchema>;

interface LoginFormProps {
  onBack: () => void;
  onSwitchToRegister: () => void;
}

export function LoginForm({ onBack, onSwitchToRegister }: LoginFormProps) {
  const { login } = useAuth();
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    setError('');
    setIsLoading(true);
    try {
      await login(data.email, data.password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao fazer login');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-900 p-4 animate-fade-in">
      <div className="w-full max-w-md bg-dark-800 border border-dark-700 rounded-2xl p-8 shadow-2xl">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <img src="/logo.png" alt="VIPS.lat" className="h-10" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Bem-vindo de volta</h2>
          <p className="text-gray-400">Entre para acessar sua conta</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">{error}</div>
          )}

          <Input label="Email" type="email" placeholder="seu@email.com" error={errors.email?.message} {...register('email')} />

          <Input
            label="Senha"
            type="password"
            placeholder="••••••••"
            error={errors.password?.message}
            {...register('password')}
          />

          <Button type="submit" className="w-full" isLoading={isLoading}>
            Entrar
          </Button>

          <div className="text-center text-sm text-gray-400 mt-4">
            Não tem uma conta?{' '}
            <button type="button" onClick={onSwitchToRegister} className="text-brand-500 hover:underline">
              Criar conta
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
