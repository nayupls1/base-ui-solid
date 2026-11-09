import { createContext, useContext } from 'solid-js';

/** Reactive values are getters. */
export interface TabsListContext {
  readonly activateOnFocus: boolean;
  registerIndicatorUpdateListener: (listener: () => void) => () => void;
  registerTabResizeObserverElement: (element: HTMLElement) => () => void;
  readonly tabsListElement: HTMLElement | null;
}

export const TabsListContext = createContext<TabsListContext | null>(null);

export function useTabsListContext() {
  const context = useContext(TabsListContext);
  if (context == null) {
    throw new Error(
      'Base UI: TabsListContext is missing. TabsList parts must be placed within <Tabs.List>.',
    );
  }

  return context;
}
