import { create } from "zustand";
import { toast } from "sonner";
import { User } from "../types/types";

interface UserStore {
  users: User[];
  currentUser: User | null;
  loading: boolean;
  error: string | null;

  fetchUsers: (userId?: string) => Promise<void>;
  setCurrentUser: (user: User | null) => void;
  getCurrentUserId: () => string | null;
  initializeCurrentUser: () => void;
}

export const useUserStore = create<UserStore>((set, get) => ({
  users: [],
  currentUser: null,
  loading: false,
  error: null,

  // 🧠 Fetch users from API
 fetchUsers: async (userId?: string) => {
  set({ loading: true });
  try {
    const query = userId ? `?userId=${userId}` : "";
    const res = await fetch(`/api/auth/user${query}`);
    if (!res.ok) throw new Error("Failed to fetch users");

    const data = await res.json();
    // Handle both array and {success, users} response formats
    const usersList = Array.isArray(data) ? data : (data.success ? data.users : []);
    const activeUsers = usersList.filter((user: any) => user.status === "Active");

    set({ users: activeUsers, loading: false });
  } catch (err: any) {
    console.error("fetchUsers error:", err);
    toast.error("Failed to load users");
    set({ error: err.message, loading: false });
  }
},


  // 👤 Initialize current user from localStorage or API
  initializeCurrentUser: async () => {
    const storedUserId = localStorage.getItem('currentUserId');
    const { users } = get();

    if (storedUserId && users.length > 0) {
      const user = users.find(u => u.id === storedUserId);
      if (user) {
        set({ currentUser: user });
        return;
      }
    }

    // If no stored ID or no matching user, fetch current user from API
    try {
      const res = await fetch('/api/auth/user');
      if (res.ok) {
        const data = await res.json();
        const usersList = Array.isArray(data) ? data : (data.success ? data.users : []);
        const activeUsers = usersList.filter((u: any) => u.status === "Active");
        if (activeUsers.length > 0 && storedUserId) {
          const currentUser = activeUsers.find((u: any) => u.id === storedUserId);
          if (currentUser) {
            set({ currentUser, users: activeUsers });
            localStorage.setItem('currentUserId', currentUser.id);
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch current user:', err);
    }
  },

  // 👤 Set current user and store in localStorage
  setCurrentUser: (user: User | null) => {
    if (user) {
      localStorage.setItem('currentUserId', user.id);
    } else {
      localStorage.removeItem('currentUserId');
    }
    set({ currentUser: user });
  },

  // 👥 Select user as current (helper method)
  selectAsCurrentUser: (userId: string) => {
    const { users } = get();
    const user = users.find(u => u.id === userId);
    if (user) {
      get().setCurrentUser(user);
    }
  },

  // Get current user ID
  getCurrentUserId: () => {
    const { currentUser } = get();
    return currentUser ? currentUser.id : null;
  },
}));