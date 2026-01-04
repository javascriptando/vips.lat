import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { WebSocketProvider } from '@/providers/WebSocketProvider';
import { LandingPage } from '@/components/auth';
import { MainLayout } from '@/components/layout';
import { queryClient } from '@/lib/queryClient';
import {
  Dashboard,
  Feed,
  Explore,
  Earnings,
  Settings,
  CreatorProfile,
  ContentManager,
  SubscribersList,
  CollectionView,
  UserSubscriptionsView,
  UserProfileView,
  MessagesView,
  PostView,
  PackView,
  Admin,
  TermsOfUse,
  PrivacyPolicy,
} from '@/pages';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-dark-900 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, isAdmin } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-dark-900 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated || !isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  const { isAuthenticated, isLoading, isCreator, isAdmin, checkAuth } = useAuth();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-dark-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <img src="/logo.png" alt="VIPS.lat" className="h-10 animate-pulse" />
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <Routes>
      {/* Public Routes - Redireciona baseado no tipo de usuário */}
      <Route path="/" element={
        isAuthenticated
          ? <Navigate to={isAdmin ? "/admin" : isCreator ? "/dashboard" : "/feed"} replace />
          : <LandingPage />
      } />

      {/* Public Creator Profile - accessible without login */}
      <Route path="/creator/:username" element={<MainLayout />}>
        <Route index element={<CreatorProfile />} />
      </Route>

      {/* Public Explore - accessible without login */}
      <Route path="/explore" element={<MainLayout />}>
        <Route index element={<Explore />} />
      </Route>

      {/* Public Pack View - accessible without login (but purchase requires auth) */}
      <Route path="/pack/:id" element={<MainLayout />}>
        <Route index element={<PackView />} />
      </Route>

      {/* Legal Pages - Public */}
      <Route path="/termos" element={<TermsOfUse />} />
      <Route path="/privacidade" element={<PrivacyPolicy />} />

      {/* Protected Routes */}
      <Route
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        {/* Subscriber Routes */}
        <Route path="/feed" element={<Feed />} />
        <Route path="/collection" element={<CollectionView />} />
        <Route path="/subscriptions" element={<UserSubscriptionsView />} />
        <Route path="/profile" element={<UserProfileView />} />
        <Route path="/messages" element={<MessagesView />} />
        <Route path="/post/:id" element={<PostView />} />

        {/* Creator Routes */}
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/content" element={<ContentManager />} />
        <Route path="/earnings" element={<Earnings />} />
        <Route path="/subscribers" element={<SubscribersList />} />
        <Route path="/settings" element={<Settings />} />
      </Route>

      {/* Admin Routes */}
      <Route
        path="/admin"
        element={
          <AdminRoute>
            <MainLayout />
          </AdminRoute>
        }
      >
        <Route index element={<Admin />} />
      </Route>

      {/* Catch all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WebSocketProvider>
        <BrowserRouter>
          <AppRoutes />
          <Toaster
            position="top-right"
            theme="dark"
            toastOptions={{
              style: {
                background: '#18181b',
                border: '1px solid #27272a',
                color: '#fff',
              },
            }}
          />
        </BrowserRouter>
      </WebSocketProvider>
    </QueryClientProvider>
  );
}
