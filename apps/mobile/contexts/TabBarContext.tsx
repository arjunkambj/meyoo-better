import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

interface TabBarContextType {
  isTabBarVisible: boolean;
  hideTabBar: () => void;
  showTabBar: () => void;
}

const TabBarContext = createContext<TabBarContextType>({
  isTabBarVisible: true,
  hideTabBar: () => {},
  showTabBar: () => {},
});

export const useTabBar = () => useContext(TabBarContext);

export function TabBarProvider({ children }: { children: ReactNode }) {
  const [isTabBarVisible, setIsTabBarVisible] = useState(true);

  const hideTabBar = useCallback(() => setIsTabBarVisible(false), []);
  const showTabBar = useCallback(() => setIsTabBarVisible(true), []);

  const value = useMemo<TabBarContextType>(
    () => ({
      isTabBarVisible,
      hideTabBar,
      showTabBar,
    }),
    [isTabBarVisible, hideTabBar, showTabBar],
  );

  return (
    <TabBarContext.Provider value={value}>
      {children}
    </TabBarContext.Provider>
  );
}
