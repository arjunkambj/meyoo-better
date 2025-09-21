import { atom } from "jotai";

// Sidebar state
export const sidebarOpenAtom = atom(true);

// Theme state
export const themeAtom = atom<"light" | "dark">("light");

// User preferences
export const userPreferencesAtom = atom({
  compactMode: false,
  showNotifications: true,
});