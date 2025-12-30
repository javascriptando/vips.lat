import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { LandingPage } from '@/components/auth';
import { MainLayout } from '@/components/layout';
import {
  Dashboard,
  Feed,
  Explore,
  Earnings,
  Settings,
  CreatorProfile,
  ContentManager,
  SubscribersList,
  PurchasedView,
  SavedPostsView,
  UserSubscriptionsView,
  UserProfileView,
  MessagesView,
  PostView,
} from '@/pages';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});

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

function AppRoutes() {
  const { isAuthenticated, isLoading, isCreator, checkAuth } = useAuth();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-dark-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center font-bold text-white shadow-lg animate-pulse">
            V
          </div>
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <Routes>
      {/* Public Routes - Redireciona para dashboard se creator, senão para feed */}
      <Route path="/" element={isAuthenticated ? <Navigate to={isCreator ? "/dashboard" : "/feed"} replace /> : <LandingPage />} />

      {/* Public Creator Profile - accessible without login */}
      <Route path="/creator/:username" element={<MainLayout />}>
        <Route index element={<CreatorProfile />} />
      </Route>

      {/* Public Explore - accessible without login */}
      <Route path="/explore" element={<MainLayout />}>
        <Route index element={<Explore />} />
      </Route>

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
        <Route path="/purchased" element={<PurchasedView />} />
        <Route path="/saved" element={<SavedPostsView />} />
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

      {/* Catch all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
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
    </QueryClientProvider>
  );
}
