import { getLocalTimeZone, today } from "@internationalized/date";
import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";

// Analytics date range interface
interface AnalyticsDateRange {
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD
  preset?: string;
}

// Helper to get default date range (today only)
function getDefaultDateRange(): AnalyticsDateRange {
  const todayDate = today(getLocalTimeZone());
  const formatted = `${todayDate.year}-${String(todayDate.month).padStart(2, "0")}-${String(todayDate.day).padStart(2, "0")}`;

  return {
    start: formatted,
    end: formatted,
    preset: "today",
  };
}

// Global analytics date range atom
export const analyticsDateRangeAtom = atom<AnalyticsDateRange>(
  getDefaultDateRange(),
);

// UI State atoms
export const sidebarOpenAtom = atomWithStorage("sidebar-open", true);
export const agentSidebarOpenAtom = atomWithStorage("agent-sidebar-open", false);
export const devToolsVisibleAtom = atomWithStorage("dev-tools-visible", false);

// Global pending overlay for Settings to prevent double actions
export const settingsPendingAtom = atom<boolean>(false);
export const setSettingsPendingAtom = atom(
  null,
  (_get, set, pending: boolean) => {
    set(settingsPendingAtom, pending);
  }
);
