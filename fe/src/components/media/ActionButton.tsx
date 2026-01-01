import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

interface ActionButtonProps {
  icon: LucideIcon;
  label?: string | number;
  isActive?: boolean;
  activeColor?: 'red' | 'brand' | 'green' | 'blue';
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'solid' | 'ghost';
}

const colorClasses = {
  red: {
    active: 'bg-red-500/30 text-red-500',
    icon: 'fill-current',
  },
  brand: {
    active: 'bg-brand-500/30 text-brand-500',
    icon: 'fill-current',
  },
  green: {
    active: 'bg-green-500/30 text-green-500',
    icon: '',
  },
  blue: {
    active: 'bg-blue-500/30 text-blue-500',
    icon: 'fill-current',
  },
};

const sizeClasses = {
  sm: {
    button: 'p-2',
    icon: 16,
    label: 'text-[10px]',
  },
  md: {
    button: 'p-2.5',
    icon: 20,
    label: 'text-[11px]',
  },
  lg: {
    button: 'p-3',
    icon: 24,
    label: 'text-xs',
  },
};

export function ActionButton({
  icon: Icon,
  label,
  isActive = false,
  activeColor = 'red',
  onClick,
  disabled = false,
  className = '',
  size = 'md',
  variant = 'solid',
}: ActionButtonProps) {
  const sizeClass = sizeClasses[size];
  const colorClass = colorClasses[activeColor];

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex flex-col items-center transition-all',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      <div
        className={cn(
          'rounded-full backdrop-blur-sm transition-all',
          sizeClass.button,
          variant === 'solid' && 'bg-black/50',
          variant === 'ghost' && 'bg-transparent',
          isActive ? colorClass.active : 'text-white hover:bg-black/70'
        )}
      >
        <Icon
          size={sizeClass.icon}
          className={cn(isActive && colorClass.icon)}
        />
      </div>
      {label !== undefined && (
        <span
          className={cn(
            'font-medium -mt-0.5',
            sizeClass.label,
            isActive ? `text-${activeColor}-500` : 'text-white'
          )}
        >
          {label}
        </span>
      )}
    </button>
  );
}

export default ActionButton;
