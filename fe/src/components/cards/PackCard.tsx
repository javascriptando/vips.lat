import { Link } from 'react-router-dom';
import { Layers } from 'lucide-react';
import { resolveMediaUrl, formatCurrency } from '@/lib/utils';

type PackCardProps = {
  pack: {
    id: string;
    name: string;
    description?: string | null;
    coverUrl?: string | null;
    price: number;
    mediaCount: number;
    salesCount?: number;
  };
  creator?: {
    displayName: string;
    avatarUrl?: string | null;
  } | null;
  hasPurchased?: boolean;
  showSales?: boolean;
  showCreator?: boolean;
  compact?: boolean;
};

export function PackCard({
  pack,
  creator,
  hasPurchased = false,
  showSales = false,
  showCreator = false,
  compact = false,
}: PackCardProps) {
  return (
    <Link
      to={`/pack/${pack.id}`}
      className="group block"
    >
      {/* Gift Box Style Card */}
      <div className={`relative ${compact ? 'aspect-square' : 'aspect-square'} rounded-2xl overflow-hidden bg-gradient-to-br from-brand-600/20 via-dark-800 to-dark-900 border-2 border-brand-500/30 hover:border-brand-500/60 transition-all shadow-lg hover:shadow-brand-500/20 hover:scale-[1.02]`}>
        {/* Gift ribbon - vertical */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-full bg-gradient-to-b from-brand-500/40 via-brand-500/20 to-brand-500/40" />
        {/* Gift ribbon - horizontal */}
        <div className="absolute top-1/3 left-0 w-full h-6 bg-gradient-to-r from-brand-500/40 via-brand-500/20 to-brand-500/40" />
        {/* Ribbon bow */}
        <div className="absolute top-[calc(33%-12px)] left-1/2 -translate-x-1/2 w-10 h-10 rounded-full bg-brand-500/30 border-2 border-brand-500/50 flex items-center justify-center">
          <Layers size={18} className="text-brand-400" />
        </div>

        {/* Content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center p-4 pt-16">
          <h3 className={`font-bold text-white text-center leading-tight line-clamp-2 mb-2 ${compact ? 'text-xs' : 'text-sm'}`}>
            {pack.name}
          </h3>
          <div className="flex items-center gap-1 text-gray-400 text-xs">
            <Layers size={12} />
            <span>{pack.mediaCount} {pack.mediaCount === 1 ? 'item' : 'itens'}</span>
          </div>
        </div>

        {/* Top badges */}
        {hasPurchased && (
          <div className="absolute top-2 left-2">
            <span className="bg-green-500/90 text-white text-[10px] px-2 py-0.5 rounded-full">
              Comprado
            </span>
          </div>
        )}

        {/* Bottom info */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3 pt-6">
          {/* Creator info */}
          {showCreator && creator && (
            <div className="flex items-center gap-2 mb-2">
              {creator.avatarUrl && (
                <img
                  src={resolveMediaUrl(creator.avatarUrl) || ''}
                  alt={creator.displayName}
                  className="w-5 h-5 rounded-full object-cover"
                />
              )}
              <span className="text-xs text-gray-400 truncate">{creator.displayName}</span>
            </div>
          )}

          {/* Price and sales */}
          <div className="flex items-center justify-between">
            {pack.price > 0 ? (
              <span className="text-brand-400 font-bold">{formatCurrency(pack.price)}</span>
            ) : (
              <span className="text-green-400 font-medium text-sm">Seu</span>
            )}
            {showSales && pack.salesCount !== undefined && (
              <span className="text-gray-400 text-xs">{pack.salesCount} vendas</span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

export default PackCard;
