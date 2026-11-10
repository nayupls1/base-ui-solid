import { createEffect, createMemo, omit, untrack } from 'solid-js';
import { ownerDocument } from 'base-ui-solidjs-utils/owner';
import { activeElement, contains } from 'base-ui-solidjs-utils/shadowDom';
import { useBaseUiId } from '../../internals/useBaseUiId';
import { useRenderElement } from '../../internals/useRenderElement';
import type { BaseUIComponentProps, NativeButtonProps } from '../../internals/types';
import { useButton } from '../../internals/use-button';
import { ACTIVE_COMPOSITE_ITEM } from '../../internals/composite/constants';
import { useCompositeItem } from '../../internals/composite/item/useCompositeItem';
import { useCompositeRootContext } from '../../internals/composite/root/CompositeRootContext';
import type { TabsRoot } from '../root/TabsRoot';
import { useTabsRootContext } from '../root/TabsRootContext';
import { tabsStateAttributesMapping } from '../root/stateAttributesMapping';
import { useTabsListContext } from '../list/TabsListContext';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import { ownedProps } from '../../internals/ownedProps';

/**
 * An individual interactive tab button that toggles the corresponding panel.
 * Renders a `<button>` element.
 *
 * Documentation: [Base UI Tabs](https://base-ui.com/react/components/tabs)
 */
export function TabsTab(componentProps: TabsTab.Props) {
  componentProps = ownedProps(componentProps);
  const elementProps = omit(
    componentProps,
    'class',
    'disabled',
    'render',
    'value',
    'id',
    'nativeButton',
    'style',
    'children',
    'ref',
  );

  const rootContext = useTabsRootContext();
  const listContext = useTabsListContext();
  const compositeContext = useCompositeRootContext();

  const disabled = () => componentProps.disabled ?? false;
  const id = useBaseUiId(() => componentProps.id);

  const tabMetadata = createMemo(() => ({
    disabled: disabled(),
    id: id(),
    value: componentProps.value,
  }));

  const { compositeProps, compositeRef, index } = useCompositeItem<TabsTab.Metadata>({
    get metadata() {
      return tabMetadata();
    },
  });

  const active = () => componentProps.value === rootContext.value;

  let isNavigating = false;
  let unobserveTabElement: (() => void) | null = null;

  const observeTabElement = (element: HTMLElement | null) => {
    unobserveTabElement?.();
    unobserveTabElement = element ? listContext.registerTabResizeObserverElement(element) : null;
  };

  createEffect(
    () =>
      [
        active(),
        index(),
        compositeContext.highlightedIndex,
        disabled(),
        listContext.tabsListElement,
      ] as const,
    ([isActive, currentIndex, highlightedIndex, isDisabled, listElement]) => {
      if (isNavigating) {
        isNavigating = false;
        return;
      }

      if (!(isActive && currentIndex > -1 && highlightedIndex !== currentIndex)) {
        return;
      }

      if (listElement != null) {
        const activeEl = activeElement(ownerDocument(listElement));
        if (activeEl && contains(listElement, activeEl)) {
          return;
        }
      }

      if (!isDisabled) {
        compositeContext.onHighlightedIndexChange(currentIndex);
      }
    },
  );

  const { getButtonProps, buttonRef } = useButton({
    get disabled() {
      return disabled();
    },
    get native() {
      return componentProps.nativeButton ?? true;
    },
    focusableWhenDisabled: true,
  });

  let isPressing = false;
  let isMainButton = false;

  function activate(event: Event) {
    rootContext.onValueChange(
      componentProps.value,
      createChangeEventDetails(REASONS.none, event, undefined, {
        activationDirection: 'none',
      }) as TabsRoot.ChangeEventDetails,
    );
  }

  function onClick(event: MouseEvent) {
    if (active() || disabled()) {
      return;
    }

    activate(event);
  }

  function onFocus(event: FocusEvent) {
    if (active() || disabled()) {
      return;
    }

    if (
      listContext.activateOnFocus &&
      (!isPressing || // keyboard or touch focus
        isMainButton) // main mouse button focus
    ) {
      activate(event);
    }
  }

  function onPointerDown(event: PointerEvent) {
    if (active() || disabled()) {
      return;
    }

    isPressing = true;
    isMainButton = event.button === 0;

    const doc = ownerDocument(event.currentTarget as Element);

    function handlePointerEnd() {
      isPressing = false;
      isMainButton = false;
      doc.removeEventListener('pointerup', handlePointerEnd);
      doc.removeEventListener('pointercancel', handlePointerEnd);
    }

    doc.addEventListener('pointerup', handlePointerEnd);
    doc.addEventListener('pointercancel', handlePointerEnd);
  }

  const state = (): TabsTabState => ({
    disabled: disabled(),
    active: active(),
    orientation: rootContext.orientation,
    tabActivationDirection: rootContext.tabActivationDirection,
  });

  const captureRef = (element: HTMLElement | null) => {
    element?.addEventListener(
      'keydown',
      () => {
        isNavigating = true;
      },
      true,
    );
  };

  return untrack(() =>
    useRenderElement('button', componentProps, {
      state,
      ref: [buttonRef, compositeRef, observeTabElement, captureRef],
      props: [
        compositeProps,
        {
          role: 'tab',
          get 'aria-controls'() {
            return rootContext.getTabPanelIdByValue(componentProps.value);
          },
          get 'aria-selected'() {
            return active();
          },
          get id() {
            return id();
          },
          onClick,
          onFocus,
          onPointerDown,
          get [ACTIVE_COMPOSITE_ITEM]() {
            return active() ? '' : undefined;
          },
        },
        elementProps,
        getButtonProps,
      ],
      stateAttributesMapping: tabsStateAttributesMapping,
    }),
  );
}

export type TabsTabValue = any | null;

export type TabsTabActivationDirection = 'left' | 'right' | 'up' | 'down' | 'none';

export interface TabsTabPosition {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface TabsTabSize {
  width: number;
  height: number;
}

export interface TabsTabMetadata {
  disabled: boolean;
  id: string | undefined;
  value: TabsTab.Value | undefined;
}

export interface TabsTabState {
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
  /**
   * Whether the component is active.
   */
  active: boolean;
  /**
   * The component orientation.
   */
  orientation: TabsRoot.Orientation;
  /**
   * The direction used for tab activation.
   */
  tabActivationDirection: TabsTab.ActivationDirection;
}

export interface TabsTabProps
  extends NativeButtonProps, BaseUIComponentProps<'button', TabsTabState> {
  /**
   * The value of the Tab.
   */
  value: TabsTab.Value;
  /**
   * Whether the Tab is disabled.
   *
   * If a first Tab on a `<Tabs.List>` is disabled, it won't initially be selected.
   * Instead, the next enabled Tab will be selected.
   * However, it does not work like this during server-side rendering, as it is not known
   * during pre-rendering which Tabs are disabled.
   * To work around it, ensure that `defaultValue` or `value` on `<Tabs.Root>` is set to an enabled Tab's value.
   */
  disabled?: boolean | undefined;
}

export namespace TabsTab {
  export type Value = TabsTabValue;
  export type ActivationDirection = TabsTabActivationDirection;
  export type Position = TabsTabPosition;
  export type Size = TabsTabSize;
  export type Metadata = TabsTabMetadata;
  export type State = TabsTabState;
  export type Props = TabsTabProps;
}
