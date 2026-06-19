import { create } from "zustand";

interface InboxState {
  category: string;
  search: string;
  page: number;
  setCategory: (category: string) => void;
  setSearch: (search: string) => void;
  setPage: (page: number) => void;
  reset: () => void;
}

export const useInboxStore = create<InboxState>((set) => ({
  category: "",
  search: "",
  page: 1,
  setCategory: (category) => set({ category, page: 1 }),
  setSearch: (search) => set({ search, page: 1 }),
  setPage: (page) => set({ page }),
  reset: () => set({ category: "", search: "", page: 1 }),
}));
