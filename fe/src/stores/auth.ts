import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, Creator } from '@/types';
import { api } from '@/lib/api';

interface BecomeCreatorInput {
  displayName: string;
  subscriptionPrice: number;
  bio?: string;
}

interface AuthState {
  user: User | null;
  creator: Creator | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  // Actions
  setUser: (user: User | null) => void;
  setCreator: (creator: Creator | null) => void;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string, username?: string) => Promise<void>;
  becomeCreator: (data: BecomeCreatorInput) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  loadCreatorProfile: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      creator: null,
      isLoading: true,
      isAuthenticated: false,

      setUser: (user) => set({ user, isAuthenticated: !!user }),

      setCreator: (creator) => set({ creator }),

      login: async (email, password) => {
        const { user } = await api.login({ email, password });
        set({ user, isAuthenticated: true });

        // Load creator profile if user is a creator
        if (user.isCreator) {
          const { loadCreatorProfile } = get();
          await loadCreatorProfile();
        }
      },

      register: async (email, password, name, username) => {
        const { user } = await api.register({ email, password, name, username });
        set({ user, isAuthenticated: true });
      },

      becomeCreator: async (data) => {
        const creator = await api.becomeCreator(data);
        // Update user to reflect isCreator status
        const { user } = get();
        if (user) {
          set({ user: { ...user, isCreator: true }, creator });
        }
      },

      logout: async () => {
        await api.logout();
        set({ user: null, creator: null, isAuthenticated: false });
      },

      checkAuth: async () => {
        set({ isLoading: true });
        try {
          const user = await api.getMe();
          set({ user, isAuthenticated: !!user, isLoading: false });

          // Load creator profile if user is a creator
          if (user?.isCreator) {
            const { loadCreatorProfile } = get();
            await loadCreatorProfile();
          } else {
            // Clear stale creator data if user is no longer a creator
            set({ creator: null });
          }
        } catch {
          set({ user: null, creator: null, isAuthenticated: false, isLoading: false });
        }
      },

      loadCreatorProfile: async () => {
        try {
          const creator = await api.getMyCreatorProfile();
          set({ creator });
        } catch {
          set({ creator: null });
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        // Only persist user info and creator profile, not loading states
        user: state.user,
        creator: state.creator,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
