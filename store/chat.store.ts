import { create } from "zustand";

interface ChatState {
  sessionId: string | null;
  setSessionId: (id: string | null) => void;
  reset: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  sessionId: null,
  setSessionId: (sessionId) => set({ sessionId }),
  reset: () => set({ sessionId: null }),
}));
