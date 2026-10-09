// App-wide state: the anonymous local profile, persisted through the storage layer,
// plus a small toast queue.

import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { setSoundEnabled } from '../media/sound';
import { normalizeProfile, Profile, Settings, Stats, unlockAchievements, newProfile } from '../stats/profile';
import { LocalStorageAdapter, StorageAdapter } from '../storage/storage';

const PROFILE_KEY = 'profile';

export interface Toast {
  id: number;
  text: string;
  kind: 'info' | 'success' | 'achievement';
}

interface Store {
  profile: Profile;
  updateProfile: (fn: (p: Profile) => Profile) => void;
  updateStats: (fn: (s: Stats) => Stats) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  resetProgress: () => void;
  toasts: Toast[];
  toast: (text: string, kind?: Toast['kind']) => void;
  dismissToast: (id: number) => void;
}

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children, storage }: { children: ReactNode; storage?: StorageAdapter }) {
  const adapter = useMemo(() => storage ?? new LocalStorageAdapter(), [storage]);
  const [profile, setProfile] = useState<Profile>(() => normalizeProfile(adapter.load<Profile>(PROFILE_KEY)));
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastSeq = useRef(0);

  useEffect(() => {
    adapter.save(PROFILE_KEY, profile);
  }, [adapter, profile]);

  useEffect(() => {
    setSoundEnabled(profile.settings.sound);
    document.documentElement.dataset.motion = profile.settings.animations;
  }, [profile.settings.sound, profile.settings.animations]);

  const dismissToast = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const toast = useCallback(
    (text: string, kind: Toast['kind'] = 'info') => {
      const id = ++toastSeq.current;
      setToasts((t) => [...t.slice(-3), { id, text, kind }]);
      window.setTimeout(() => dismissToast(id), kind === 'achievement' ? 5000 : 3200);
    },
    [dismissToast],
  );

  const updateProfile = useCallback((fn: (p: Profile) => Profile) => setProfile((p) => fn(p)), []);

  const updateStats = useCallback(
    (fn: (s: Stats) => Stats) => {
      setProfile((p) => {
        const { stats, unlocked } = unlockAchievements(fn(p.stats));
        // Defer the toast so it is not triggered during a state updater.
        if (unlocked.length) queueMicrotask(() => unlocked.forEach((a) => toast(`${a.icon} הישג חדש: ${a.title}`, 'achievement')));
        return { ...p, stats };
      });
    },
    [toast],
  );

  const updateSettings = useCallback(
    (patch: Partial<Settings>) => setProfile((p) => ({ ...p, settings: { ...p.settings, ...patch } })),
    [],
  );

  const resetProgress = useCallback(() => {
    const fresh = newProfile();
    setProfile((p) => ({ ...fresh, settings: p.settings, level: p.level }));
  }, []);

  const value = useMemo(
    () => ({ profile, updateProfile, updateStats, updateSettings, resetProgress, toasts, toast, dismissToast }),
    [profile, updateProfile, updateStats, updateSettings, resetProgress, toasts, toast, dismissToast],
  );
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const s = useContext(StoreContext);
  if (!s) throw new Error('StoreProvider missing');
  return s;
}
