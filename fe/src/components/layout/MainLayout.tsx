import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LogOut, Shield } from 'lucide-react';
import { BottomNav } from './BottomNav';
import { useAuth } from '@/hooks/useAuth';

export function MainLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, isAdmin, logout } = useAuth();

  // Admin has a completely different layout
  const isAdminPage = location.pathname.startsWith('/admin');

  if (isAdmin && isAdminPage) {
    const handleLogout = async () => {
      await logout();
      navigate('/');
    };

    return (
      <div className="min-h-dvh bg-dark-900 text-gray-100 font-sans selection:bg-brand-500/30">
        {/* Admin Header */}
        <header className="sticky top-0 z-40 bg-dark-900/95 backdrop-blur-md border-b border-dark-700">
          <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="text-brand-500" size={24} />
              <span className="font-bold text-white">VIPS Admin</span>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-400 hover:text-white hover:bg-dark-800 rounded-lg transition-colors"
            >
              <LogOut size={16} />
              Sair
            </button>
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-4 py-6">
          <Outlet />
        </main>
      </div>
    );
  }

  // Pages that should be full-screen without bottom nav
  const isFullscreenPage = location.pathname.startsWith('/creator/');

  // Pages that need full height without top padding (like messages)
  const isFullHeightPage = location.pathname === '/messages';

  // Pages that need wide layout (dashboard, content manager, etc)
  const isWideLayout = ['/dashboard', '/content', '/earnings', '/subscribers', '/settings', '/explore', '/collection', '/profile', '/purchased', '/messages', '/feed', '/subscriptions'].some(
    path => location.pathname.startsWith(path)
  );

  // Height for bottom nav (h-16 = 64px + safe area)
  const hasBottomNav = !isFullscreenPage && isAuthenticated && !isAdmin;

  return (
    <div className="min-h-dvh bg-dark-900 text-gray-100 font-sans selection:bg-brand-500/30">
      <main className={`min-h-dvh ${hasBottomNav ? 'pb-20' : ''}`}>
        <div className={
          isFullscreenPage
            ? 'h-full'
            : isFullHeightPage
              ? `${hasBottomNav ? 'h-[calc(100dvh-80px)]' : 'h-dvh'} max-w-6xl mx-auto`
              : isWideLayout
                ? 'max-w-6xl mx-auto px-4 pt-6'
                : 'max-w-xl mx-auto px-4 pt-6 lg:max-w-6xl lg:grid lg:grid-cols-[1fr_320px] lg:gap-8'
        }>
          <Outlet />
        </div>
      </main>

      {hasBottomNav && <BottomNav />}
    </div>
  );
}
