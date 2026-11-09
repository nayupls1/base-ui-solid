import { createEffect, omit, untrack } from 'solid-js';
import { useBaseUiId } from '../../internals/useBaseUiId';
import type { StateAttributesMapping } from '../../internals/getStateAttributesProps';
import { transitionStatusMapping } from '../../internals/stateAttributesMapping';
import { useOpenChangeComplete } from '../../internals/useOpenChangeComplete';
import { useTransitionStatus } from '../../internals/useTransitionStatus';
import type { TransitionStatus } from '../../internals/useTransitionStatus';
import { useRenderElement } from '../../internals/useRenderElement';
import type { BaseUIComponentProps } from '../../internals/types';
import { useCompositeListItem } from '../../internals/composite/list/useCompositeListItem';
import { tabsStateAttributesMapping } from '../root/stateAttributesMapping';
import { useTabsRootContext } from '../root/TabsRootContext';
import type { TabsRootState } from '../root/TabsRoot';
import type { TabsTab } from '../tab/TabsTab';
import * as TabsPanelDataAttributes from './TabsPanelDataAttributes';

const stateAttributesMapping: StateAttributesMapping<TabsPanelState> = {
  ...tabsStateAttributesMapping,
  ...transitionStatusMapping,
};

/**
 * A panel displayed when the corresponding tab is active.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Tabs](https://base-ui.com/react/components/tabs)
 */
export function TabsPanel(componentProps: TabsPanel.Props) {
  const elementProps = omit(
    componentProps,
    'class',
    'value',
    'render',
    'keepMounted',
    'style',
    'children',
    'ref',
  );

  const rootContext = useTabsRootContext();

  const id = useBaseUiId();

  const { ref: listItemRef, index } = useCompositeListItem();

  const open = () => componentProps.value === rootContext.value;
  const { mounted, transitionStatus, setMounted } = useTransitionStatus(open);
  const hidden = () => !mounted();
  const keepMounted = () => componentProps.keepMounted ?? false;

  const state = (): TabsPanelState => ({
    hidden: hidden(),
    orientation: rootContext.orientation,
    tabActivationDirection: rootContext.tabActivationDirection,
    transitionStatus: transitionStatus(),
  });

  let panelElement: HTMLDivElement | null = null;

  useOpenChangeComplete({
    get open() {
      return open();
    },
    ref: () => panelElement,
    onComplete() {
      if (!open()) {
        setMounted(false);
      }
    },
  });

  createEffect(
    () => [hidden(), keepMounted(), componentProps.value, id()] as const,
    ([isHidden, isKeepMounted, value, currentId]) => {
      if (currentId == null || (isHidden && !isKeepMounted)) {
        return undefined;
      }

      return rootContext.registerMountedTabPanel(value, currentId);
    },
  );

  return untrack(() =>
    useRenderElement('div', componentProps, {
      enabled: () => keepMounted() || mounted(),
      state,
      ref: [
        listItemRef,
        (el: HTMLDivElement | null) => {
          panelElement = el;
        },
      ],
      props: [
        {
          get 'aria-labelledby'() {
            return rootContext.getTabIdByPanelValue(componentProps.value);
          },
          get hidden() {
            return hidden();
          },
          get id() {
            return id();
          },
          role: 'tabpanel',
          get tabindex() {
            return open() ? 0 : -1;
          },
          get inert() {
            return !open();
          },
          get [TabsPanelDataAttributes.index]() {
            return index();
          },
        },
        elementProps,
      ],
      stateAttributesMapping,
    }),
  );
}

export interface TabsPanelMetadata {
  id?: string | undefined;
  value: TabsTab.Value;
}

export interface TabsPanelState extends TabsRootState {
  /**
   * Whether the component is hidden.
   */
  hidden: boolean;
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
}

export interface TabsPanelProps extends BaseUIComponentProps<'div', TabsPanelState> {
  /**
   * The value of the TabPanel. It will be shown when the Tab with the corresponding value is active.
   */
  value: TabsTab.Value;
  /**
   * Whether to keep the HTML element in the DOM while the panel is hidden.
   * @default false
   */
  keepMounted?: boolean | undefined;
}

export namespace TabsPanel {
  export type Metadata = TabsPanelMetadata;
  export type State = TabsPanelState;
  export type Props = TabsPanelProps;
}
