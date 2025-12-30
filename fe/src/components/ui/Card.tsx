import { cn } from '@/lib/utils';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export function Card({ children, className, padding = 'md' }: CardProps) {
  const paddings = {
    none: '',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  };

  return (
    <div className={cn('bg-dark-800 border border-dark-700 rounded-2xl', paddings[padding], className)}>
      {children}
    </div>
  );
}

interface CardHeaderProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function CardHeader({ icon, title, description, action }: CardHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-6 pb-4 border-b border-dark-700">
      <div className="flex items-center gap-3">
        {icon && <div className="text-brand-500">{icon}</div>}
        <div>
          <h3 className="font-bold text-white">{title}</h3>
          {description && <p className="text-sm text-gray-400">{description}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}
