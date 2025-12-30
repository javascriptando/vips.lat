import { useAuthStore } from '@/stores/auth';

export function useAuth() {
  const {
    user,
    creator,
    isLoading,
    isAuthenticated,
    login,
    register,
    becomeCreator,
    logout,
    checkAuth,
    loadCreatorProfile,
  } = useAuthStore();

  return {
    user,
    creator,
    isLoading,
    isAuthenticated,
    isCreator: user?.isCreator ?? false,
    login,
    register,
    becomeCreator,
    logout,
    checkAuth,
    loadCreatorProfile,
  };
}
