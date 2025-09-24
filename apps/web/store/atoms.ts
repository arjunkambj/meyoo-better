import { getLocalTimeZone, today } from "@internationalized/date";
import { atom } from "jotai";
import { atomFamily, atomWithStorage } from "jotai/utils";

// Analytics date range interface
export interface AnalyticsDateRange {
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

// Global analytics date range atoms scoped by key (e.g. route pathname)
export const analyticsDateRangeFamily = atomFamily(
  (_scope?: string) => atom<AnalyticsDateRange>(getDefaultDateRange()),
);

// Default analytics date range atom (legacy/global consumers)
export const analyticsDateRangeAtom = analyticsDateRangeFamily("default");

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
