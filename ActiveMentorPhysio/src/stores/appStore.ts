import { create } from 'zustand';
import { getPhysiologists, getMySessions } from '../services/sessionService';
import { getMyPrescriptions } from '../services/prescriptionService';
import api from '../config/api';

interface AppStore {
  physios: any[];
  prescriptions: any[];
  sessions: any[];
  progress: any[];
  loading: { physios: boolean; prescriptions: boolean; sessions: boolean; progress: boolean };
  fetchPhysios: () => Promise<void>;
  fetchPrescriptions: () => Promise<void>;
  fetchSessions: () => Promise<void>;
  fetchProgress: () => Promise<void>;
  reset: () => void;
}

const IDLE = { physios: false, prescriptions: false, sessions: false, progress: false };

export const useAppStore = create<AppStore>((set) => ({
  physios: [],
  prescriptions: [],
  sessions: [],
  progress: [],
  loading: { ...IDLE },

  fetchPhysios: async () => {
    set(s => ({ loading: { ...s.loading, physios: true } }));
    try { set({ physios: await getPhysiologists() }); } catch {}
    set(s => ({ loading: { ...s.loading, physios: false } }));
  },

  fetchPrescriptions: async () => {
    set(s => ({ loading: { ...s.loading, prescriptions: true } }));
    try { set({ prescriptions: await getMyPrescriptions() }); } catch {}
    set(s => ({ loading: { ...s.loading, prescriptions: false } }));
  },

  fetchSessions: async () => {
    set(s => ({ loading: { ...s.loading, sessions: true } }));
    try { set({ sessions: await getMySessions() }); } catch {}
    set(s => ({ loading: { ...s.loading, sessions: false } }));
  },

  fetchProgress: async () => {
    set(s => ({ loading: { ...s.loading, progress: true } }));
    try {
      const { data } = await api.get('/patients/progress');
      set({ progress: data });
    } catch {}
    set(s => ({ loading: { ...s.loading, progress: false } }));
  },

  reset: () => set({ physios: [], prescriptions: [], sessions: [], progress: [], loading: { ...IDLE } }),
}));
