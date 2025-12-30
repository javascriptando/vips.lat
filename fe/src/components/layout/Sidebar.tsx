import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Home,
  Wallet,
  Users,
  Settings,
  Search,
  ShoppingBag,
  Bookmark,
  CheckCircle2,
  User as UserIcon,
  LogOut,
  X,
  Menu,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { Avatar } from '@/components/ui';

interface SidebarProps {
  isMobileOpen: boolean;
  setIsMobileOpen: (open: boolean) => void;
}

export function Sidebar({ isMobileOpen, setIsMobileOpen }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, creator, isCreator, logout } = useAuth();

  const creatorMenuItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/content', icon: Home, label: 'Meu Conteúdo' },
    { path: '/earnings', icon: Wallet, label: 'Ganhos & PIX' },
    { path: '/subscribers', icon: Users, label: 'Assinantes' },
    { path: '/settings', icon: Settings, label: 'Configurações' },
  ];

  const subscriberMenuItems = [
    { path: '/feed', icon: Home, label: 'Feed' },
    { path: '/explore', icon: Search, label: 'Explorar' },
    { path: '/purchased', icon: ShoppingBag, label: 'Comprados' },
    { path: '/saved', icon: Bookmark, label: 'Salvos' },
    { path: '/subscriptions', icon: CheckCircle2, label: 'Assinaturas' },
    { path: '/profile', icon: UserIcon, label: 'Meu Perfil' },
  ];

  const menuItems = isCreator ? creatorMenuItems : subscriberMenuItems;

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-sm"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 z-50 h-full w-72 bg-dark-900 border-r border-dark-800',
          'transform transition-transform duration-300 ease-in-out flex flex-col',
          isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        )}
      >
        {/* Header */}
        <div className="p-6 border-b border-dark-800 flex items-center justify-between">
          <Link to={isCreator ? '/dashboard' : '/feed'} className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center font-bold text-white shadow-lg shadow-brand-500/20">
              V
            </div>
            <span className="text-xl font-bold tracking-tight text-white">
              VIPS<span className="text-brand-500">.lat</span>
            </span>
          </Link>
          <button onClick={() => setIsMobileOpen(false)} className="md:hidden text-gray-400">
            <X size={24} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsMobileOpen(false)}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group relative overflow-hidden',
                  isActive ? 'bg-brand-500/10 text-brand-500 font-medium' : 'text-gray-400 hover:bg-dark-800 hover:text-white'
                )}
              >
                {isActive && <div className="absolute left-0 top-0 bottom-0 w-1 bg-brand-500 rounded-r-full" />}
                <item.icon
                  size={20}
                  className={cn(isActive ? 'text-brand-500' : 'text-gray-500 group-hover:text-white')}
                />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-dark-800">
          <div className="bg-dark-800 rounded-xl p-4 mb-4 border border-dark-700">
            <div className="flex items-center gap-3">
              <Avatar
                src={isCreator ? creator?.avatarUrl : user?.avatarUrl}
                name={isCreator ? creator?.displayName : user?.name}
                showBorder
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {isCreator ? (creator?.displayName || user?.name) : user?.name}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  @{user?.username || 'username'} · {isCreator ? 'Criador' : 'Assinante'}
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-red-400 transition-colors hover:bg-dark-800 rounded-lg"
          >
            <LogOut size={20} />
            Sair
          </button>
        </div>
      </aside>
    </>
  );
}

export function MobileMenuButton({ onClick }: { onClick: () => void }) {
  return (
    <div className="md:hidden fixed top-4 left-4 z-30">
      <button
        onClick={onClick}
        className="p-2 bg-dark-900/90 backdrop-blur-md border border-dark-700 rounded-lg text-white shadow-lg"
      >
        <Menu size={24} />
      </button>
    </div>
  );
}
