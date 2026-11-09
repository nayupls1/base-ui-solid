import { createEffect, omit } from 'solid-js';
import { EMPTY_ARRAY } from '@base-ui-solid/utils/empty';
import { createSyncSignal } from '@base-ui-solid/utils/createSyncSignal';
import type { BaseUIComponentProps, HTMLProps } from '../../internals/types';
import type { TabsRootState } from '../root/TabsRoot';
import { CompositeRoot } from '../../internals/composite/root/CompositeRoot';
import { tabsStateAttributesMapping } from '../root/stateAttributesMapping';
import { useTabsRootContext } from '../root/TabsRootContext';
import { TabsListContext } from './TabsListContext';

/**
 * Groups the individual tab buttons.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Tabs](https://base-ui.com/react/components/tabs)
 */
export function TabsList(componentProps: TabsList.Props) {
  const elementProps = omit(
    componentProps,
    'activateOnFocus',
    'class',
    'loopFocus',
    'render',
    'style',
    'children',
    'ref',
  );

  const rootContext = useTabsRootContext();

  const [highlightedTabIndex, setHighlightedTabIndex] = createSyncSignal(0);
  const [tabsListElement, setTabsListElement] = createSyncSignal<HTMLElement | null>(null);

  const indicatorUpdateListeners = new Set<() => void>();
  const tabResizeObserverElements = new Set<HTMLElement>();
  let resizeObserver: ResizeObserver | null = null;

  createEffect(tabsListElement, (element) => {
    if (typeof ResizeObserver === 'undefined') {
      return undefined;
    }

    const observer = new ResizeObserver(() => {
      indicatorUpdateListeners.forEach((listener) => {
        listener();
      });
    });

    resizeObserver = observer;

    if (element) {
      observer.observe(element);
    }

    tabResizeObserverElements.forEach((tabElement) => {
      observer.observe(tabElement);
    });

    return () => {
      observer.disconnect();
      resizeObserver = null;
    };
  });

  const registerIndicatorUpdateListener = (listener: () => void) => {
    indicatorUpdateListeners.add(listener);
    return () => {
      indicatorUpdateListeners.delete(listener);
    };
  };

  const registerTabResizeObserverElement = (element: HTMLElement) => {
    tabResizeObserverElements.add(element);
    resizeObserver?.observe(element);
    return () => {
      tabResizeObserverElements.delete(element);
      resizeObserver?.unobserve(element);
    };
  };

  const state = (): TabsListState => ({
    orientation: rootContext.orientation,
    tabActivationDirection: rootContext.tabActivationDirection,
  });

  const defaultProps: HTMLProps = {
    get 'aria-orientation'() {
      return rootContext.orientation === 'vertical' ? 'vertical' : undefined;
    },
    role: 'tablist',
  };

  const tabsListContextValue: TabsListContext = {
    get activateOnFocus() {
      return componentProps.activateOnFocus ?? false;
    },
    registerIndicatorUpdateListener,
    registerTabResizeObserverElement,
    get tabsListElement() {
      return tabsListElement();
    },
  };

  return (
    <TabsListContext value={tabsListContextValue}>
      <CompositeRoot
        render={componentProps.render}
        class={componentProps.class}
        style={componentProps.style}
        state={state()}
        refs={[
          componentProps.ref,
          (el: HTMLElement | null) => {
            setTabsListElement(el);
          },
        ]}
        props={[defaultProps, elementProps]}
        stateAttributesMapping={tabsStateAttributesMapping}
        highlightedIndex={highlightedTabIndex()}
        enableHomeAndEndKeys
        loopFocus={componentProps.loopFocus ?? true}
        orientation={rootContext.orientation}
        onHighlightedIndexChange={(index: number) => {
          setHighlightedTabIndex(index);
        }}
        onMapChange={rootContext.setTabMap as any}
        disabledIndices={EMPTY_ARRAY}
      >
        {componentProps.children}
      </CompositeRoot>
    </TabsListContext>
  );
}

type TabsListContext = import('./TabsListContext').TabsListContext;

export interface TabsListState extends TabsRootState {}

export interface TabsListProps extends BaseUIComponentProps<'div', TabsListState> {
  /**
   * Whether to automatically change the active tab on arrow key focus.
   * Otherwise, tabs will be activated using <kbd>Enter</kbd> or <kbd>Space</kbd> key press.
   * @default false
   */
  activateOnFocus?: boolean | undefined;
  /**
   * Whether to loop keyboard focus back to the first item
   * when the end of the list is reached while using the arrow keys.
   * @default true
   */
  loopFocus?: boolean | undefined;
}

export namespace TabsList {
  export type State = TabsListState;
  export type Props = TabsListProps;
}
