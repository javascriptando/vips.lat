import { Outlet, useLocation } from 'react-router-dom';
import { BottomNav } from './BottomNav';
import { useAuth } from '@/hooks/useAuth';

export function MainLayout() {
  const location = useLocation();
  const { isAuthenticated } = useAuth();

  // Pages that should be full-screen without bottom nav
  const isFullscreenPage = location.pathname.startsWith('/creator/');

  // Pages that need full height without top padding (like messages)
  const isFullHeightPage = location.pathname === '/messages';

  // Pages that need wide layout (dashboard, content manager, etc)
  const isWideLayout = ['/dashboard', '/content', '/earnings', '/subscribers', '/settings', '/explore', '/saved', '/profile', '/purchased', '/messages'].some(
    path => location.pathname.startsWith(path)
  );

  // Height for bottom nav (h-16 = 64px + safe area)
  const hasBottomNav = !isFullscreenPage && isAuthenticated;

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
