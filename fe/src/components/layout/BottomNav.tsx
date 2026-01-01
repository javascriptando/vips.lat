import { Link, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Home, Search, PlusSquare, FolderHeart, User, LayoutDashboard, DollarSign, Settings, MessageCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Avatar } from '@/components/ui';
import { api } from '@/lib/api';

export function BottomNav() {
  const location = useLocation();
  const { user, isCreator, isAuthenticated } = useAuth();

  // Fetch unread count
  const { data: unreadData } = useQuery({
    queryKey: ['unreadCount'],
    queryFn: () => api.getUnreadCount(),
    enabled: isAuthenticated,
    refetchInterval: 30000, // Poll every 30 seconds
  });

  const unreadCount = unreadData?.total || 0;

  const isActive = (path: string) => location.pathname === path;

  // Hide on landing page
  if (location.pathname === '/' && !isAuthenticated) return null;

  type NavItem = {
    path: string;
    icon: typeof Home;
    label: string;
    isCreate?: boolean;
    badge?: number;
  };

  // Creator navigation items
  const creatorNavItems: NavItem[] = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Início' },
    { path: '/messages', icon: MessageCircle, label: 'Chat', badge: unreadCount },
    { path: '/content', icon: PlusSquare, label: 'Criar', isCreate: true },
    { path: '/earnings', icon: DollarSign, label: 'Ganhos' },
    { path: '/settings', icon: Settings, label: 'Config' },
  ];

  // Subscriber navigation items
  const subscriberNavItems: NavItem[] = [
    { path: '/feed', icon: Home, label: 'Feed' },
    { path: '/explore', icon: Search, label: 'Explorar' },
    { path: '/messages', icon: MessageCircle, label: 'Chat', badge: unreadCount },
    { path: '/collection', icon: FolderHeart, label: 'Coleção' },
    { path: '/profile', icon: User, label: 'Perfil' },
  ];

  const navItems = isCreator ? creatorNavItems : subscriberNavItems;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-dark-900/95 backdrop-blur-lg border-t border-dark-800 safe-area-bottom">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);

          // Special styling for create button
          if (item.isCreate) {
            return (
              <Link
                key={item.path}
                to={item.path}
                className="relative -mt-6"
              >
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center shadow-lg shadow-brand-500/30 hover:shadow-brand-500/50 hover:scale-105 transition-all">
                  <Icon size={26} className="text-white" strokeWidth={2} />
                </div>
              </Link>
            );
          }

          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center justify-center w-16 h-full transition-colors relative ${
                active ? 'text-brand-500' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {item.path === '/profile' && user?.avatarUrl ? (
                <div className={`rounded-full p-0.5 ${active ? 'ring-2 ring-brand-500' : ''}`}>
                  <Avatar src={user.avatarUrl} name={user.name} size="sm" className="w-6 h-6" />
                </div>
              ) : (
                <div className="relative">
                  <Icon size={24} strokeWidth={active ? 2.5 : 1.5} />
                  {item.badge != null && item.badge > 0 && (
                    <span className="absolute -top-1 -right-2 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                      {item.badge > 99 ? '99+' : item.badge}
                    </span>
                  )}
                </div>
              )}
              <span className="text-[10px] mt-0.5 font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
