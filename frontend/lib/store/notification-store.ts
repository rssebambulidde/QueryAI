import { create } from 'zustand';
import { notificationApi, type UserNotification } from '@/lib/api';

interface NotificationState {
  notifications: UserNotification[];
  unreadCount: number;
  loading: boolean;
  /** Whether the dropdown panel is open */
  isOpen: boolean;

  // Actions
  fetchNotifications: () => Promise<void>;
  fetchUnreadCount: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  setOpen: (open: boolean) => void;
  toggle: () => void;
}

export const useNotificationStore = create<NotificationState>()((set, get) => ({
  notifications: [],
  unreadCount: 0,
  loading: false,
  isOpen: false,

  fetchNotifications: async () => {
    set({ loading: true });
    try {
      const res = await notificationApi.getAll({ limit: 30 });
      if (res.success && res.data) {
        set({ notifications: res.data });
      }
    } catch {
      // silently ignore — bell will just show stale data
    } finally {
      set({ loading: false });
    }
  },

  fetchUnreadCount: async () => {
    try {
      const res = await notificationApi.getUnreadCount();
      if (res.success && res.data) {
        set({ unreadCount: res.data.count });
      }
    } catch {
      // ignore
    }
  },

  markRead: async (id: string) => {
    // Optimistic update
    set((s) => ({
      notifications: s.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      ),
      unreadCount: Math.max(0, s.unreadCount - 1),
    }));
    try {
      await notificationApi.markRead(id);
    } catch {
      // Revert on failure
      get().fetchNotifications();
      get().fetchUnreadCount();
    }
  },

  markAllRead: async () => {
    const prev = get().notifications;
    // Optimistic
    set((s) => ({
      notifications: s.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    }));
    try {
      await notificationApi.markAllRead();
    } catch {
      set({ notifications: prev });
      get().fetchUnreadCount();
    }
  },

  setOpen: (open: boolean) => set({ isOpen: open }),
  toggle: () => set((s) => ({ isOpen: !s.isOpen })),
}));
