import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getStoredUser, logout } from '../services/authService';

interface AuthStore {
  isLoggedIn: boolean | null;
  user: any | null;
  init: () => Promise<void>;
  signIn: (user?: any) => void;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>((set) => ({
  isLoggedIn: null,
  user: null,

  init: async () => {
    const user = await getStoredUser();
    set({ isLoggedIn: !!user, user: user ?? null });
  },

  signIn: (user?: any) => set({ isLoggedIn: true, user: user ?? null }),

  signOut: async () => {
    await logout();
    await AsyncStorage.removeItem('userProfile');
    // lazy import to avoid circular dep at module level
    const { useAppStore } = require('./appStore');
    useAppStore.getState().reset();
    set({ isLoggedIn: false, user: null });
  },
}));
