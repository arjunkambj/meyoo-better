import { atom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';
import type { AnalyticsDateRange } from '@repo/types';

export const sidebarOpenAtom = atomWithStorage('sidebar-open', true);
export const agentSidebarOpenAtom = atomWithStorage('agent-sidebar-open', false);
export const devToolsVisibleAtom = atomWithStorage('dev-tools-visible', false);

export type AnalyticsDateRangeState = Record<string, AnalyticsDateRange>;
export const analyticsDateRangesAtom = atom<AnalyticsDateRangeState>({});

export const settingsPendingAtom = atom<boolean>(false);
export const setSettingsPendingAtom = atom(
  null,
  (_get, set, pending: boolean) => {
    set(settingsPendingAtom, pending);
  },
);
