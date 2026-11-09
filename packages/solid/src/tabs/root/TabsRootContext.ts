import { createContext, useContext } from 'solid-js';
import type { CompositeMetadata } from '../../internals/composite/list/CompositeList';
import type { TabsTab } from '../tab/TabsTab';
import type { TabsRoot } from './TabsRoot';

/** Reactive values are getters. */
export interface TabsRootContext {
  /**
   * The currently active tab's value.
   */
  readonly value: TabsTab.Value;
  /**
   * Callback for setting new value.
   */
  onValueChange: (value: TabsTab.Value, eventDetails: TabsRoot.ChangeEventDetails) => void;
  /**
   * The component orientation (layout flow direction).
   */
  readonly orientation: 'horizontal' | 'vertical';
  /**
   * Gets the element of the Tab with the given value.
   */
  getTabElementBySelectedValue: (selectedValue: TabsTab.Value) => HTMLElement | null;
  /**
   * Gets the `id` attribute of the Tab that corresponds to the given TabPanel value.
   */
  getTabIdByPanelValue: (panelValue: TabsTab.Value) => string | undefined;
  /**
   * Gets the `id` attribute of the TabPanel that corresponds to the given Tab value.
   */
  getTabPanelIdByValue: (tabValue: TabsTab.Value) => string | undefined;
  registerMountedTabPanel: (panelValue: TabsTab.Value, panelId: string) => () => void;
  setTabMap: (map: Map<Node, CompositeMetadata<TabsTab.Metadata>>) => void;
  /**
   * The position of the active tab relative to the previously active tab.
   */
  readonly tabActivationDirection: TabsTab.ActivationDirection;
}

/**
 * @internal
 */
export const TabsRootContext = createContext<TabsRootContext | null>(null);

export function useTabsRootContext() {
  const context = useContext(TabsRootContext);
  if (context == null) {
    throw new Error(
      'Base UI: TabsRootContext is missing. Tabs parts must be placed within <Tabs.Root>.',
    );
  }

  return context;
}
