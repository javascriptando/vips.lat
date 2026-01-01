import { Link } from 'react-router-dom';
import { Gift, Lock } from 'lucide-react';
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
      className="bg-dark-800 border border-dark-700 rounded-xl overflow-hidden group hover:border-brand-500/50 transition-colors block"
    >
      {/* Cover */}
      <div className="relative aspect-video overflow-hidden">
        {pack.coverUrl ? (
          <img
            src={resolveMediaUrl(pack.coverUrl) || ''}
            alt={pack.name}
            className={`w-full h-full object-cover group-hover:scale-105 transition-transform ${!hasPurchased ? '' : ''}`}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-brand-500/20 to-purple-500/20 flex items-center justify-center">
            <Gift size={compact ? 32 : 48} className="text-brand-400" />
          </div>
        )}

        {/* Badge - Pack */}
        <div className="absolute top-2 left-2">
          <span className="bg-brand-500/90 text-white text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1">
            <Gift size={10} />
            Pacote
          </span>
        </div>

        {/* Item count badge */}
        <div className="absolute bottom-2 right-2 bg-black/60 text-white px-2 py-1 rounded text-xs backdrop-blur-sm">
          {pack.mediaCount} itens
        </div>

        {/* Lock overlay for unpurchased (optional - only show if explicitly false) */}
        {hasPurchased === false && (
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        )}

        {/* Purchased badge */}
        {hasPurchased && (
          <div className="absolute top-2 right-2">
            <span className="bg-green-500/90 text-white text-[10px] px-2 py-0.5 rounded-full">
              Comprado
            </span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className={compact ? 'p-3' : 'p-4'}>
        <h3 className={`font-semibold text-white truncate ${compact ? 'text-sm' : ''}`}>
          {pack.name}
        </h3>

        {!compact && pack.description && (
          <p className="text-sm text-gray-400 line-clamp-2 mt-1">{pack.description}</p>
        )}

        {/* Creator info */}
        {showCreator && creator && (
          <div className="flex items-center gap-2 mt-2">
            {creator.avatarUrl && (
              <img
                src={resolveMediaUrl(creator.avatarUrl) || ''}
                alt={creator.displayName}
                className="w-5 h-5 rounded-full object-cover"
              />
            )}
            <span className="text-xs text-gray-500 truncate">{creator.displayName}</span>
          </div>
        )}

        {/* Price and sales */}
        <div className={`flex items-center justify-between ${compact ? 'mt-2' : 'mt-3'}`}>
          {pack.price > 0 ? (
            <span className="text-brand-500 font-bold">{formatCurrency(pack.price)}</span>
          ) : (
            <span className="text-green-500 text-sm font-medium">Comprado</span>
          )}
          {showSales && pack.salesCount !== undefined && (
            <span className="text-xs text-gray-500">{pack.salesCount} vendas</span>
          )}
        </div>
      </div>
    </Link>
  );
}

export default PackCard;
