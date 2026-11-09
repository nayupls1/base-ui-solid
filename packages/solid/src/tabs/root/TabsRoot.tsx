import { createEffect, createMemo, omit, untrack } from 'solid-js';
import { useControlled } from '@base-ui-solid/utils/useControlled';
import { createSyncSignal } from '@base-ui-solid/utils/createSyncSignal';
import type { BaseUIComponentProps, Orientation as BaseOrientation } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { CompositeList } from '../../internals/composite/list/CompositeList';
import type { CompositeMetadata } from '../../internals/composite/list/CompositeList';
import { TabsRootContext } from './TabsRootContext';
import { tabsStateAttributesMapping } from './stateAttributesMapping';
import type { TabsTab } from '../tab/TabsTab';
import type { TabsPanel } from '../panel/TabsPanel';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import type { BaseUIChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import { ownedProps } from '../../internals/ownedProps';

/**
 * Groups the tabs and the corresponding panels.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Tabs](https://base-ui.com/react/components/tabs)
 */
export function TabsRoot(componentProps: TabsRoot.Props) {
  componentProps = ownedProps(componentProps);
  const elementProps = omit(
    componentProps,
    'class',
    'defaultValue',
    'onValueChange',
    'orientation',
    'render',
    'value',
    'style',
    'children',
    'ref',
  );

  const orientation = () => componentProps.orientation ?? 'horizontal';
  const hasExplicitDefaultValueProp = untrack(() => componentProps.defaultValue !== undefined);
  const defaultValueProp = untrack(() => componentProps.defaultValue ?? 0);

  const tabPanelRefs = { current: [] as (HTMLElement | null)[] };
  const [mountedTabPanels, setMountedTabPanels] = createSyncSignal(
    new Map<TabsTab.Value, string>(),
  );

  const [value, setValue] = useControlled<TabsTab.Value>({
    controlled: () => componentProps.value,
    default: defaultValueProp,
    name: 'Tabs',
    state: 'value',
  });

  const isControlled = untrack(() => componentProps.value !== undefined);

  const [tabMap, setTabMap] = createSyncSignal(
    new Map<Node, CompositeMetadata<TabsTab.Metadata>>(),
  );
  let lastKnownTabElement: Node | undefined;

  const getTabElementBySelectedValue = (selectedValue: TabsTab.Value): HTMLElement | null =>
    findTabElement(tabMap(), selectedValue);

  const [activationDirectionState, setActivationDirectionState] = createSyncSignal({
    previousValue: untrack(value),
    tabActivationDirection: 'none' as TabsTab.ActivationDirection,
  });

  const activation = createMemo(() => {
    const { previousValue, tabActivationDirection: committedTabActivationDirection } =
      activationDirectionState();
    const currentValue = value();

    let tabActivationDirection = committedTabActivationDirection;
    let directionComputationIncomplete = false;

    if (previousValue !== currentValue) {
      tabActivationDirection = untrack(() =>
        computeActivationDirection(previousValue, currentValue, orientation(), tabMap()),
      );

      directionComputationIncomplete =
        previousValue != null &&
        currentValue != null &&
        untrack(() => getTabElementBySelectedValue(currentValue)) == null;
    }

    const nextPreviousValue = directionComputationIncomplete ? previousValue : currentValue;
    const shouldSync =
      previousValue !== nextPreviousValue ||
      committedTabActivationDirection !== tabActivationDirection;

    return { tabActivationDirection, nextPreviousValue, shouldSync };
  });

  const tabActivationDirection = () => activation().tabActivationDirection;

  createEffect(activation, ({ shouldSync, nextPreviousValue, tabActivationDirection: dir }) => {
    if (!shouldSync) {
      return;
    }

    setActivationDirectionState({
      previousValue: nextPreviousValue,
      tabActivationDirection: dir,
    });
  });

  const onValueChange = (newValue: TabsTab.Value, eventDetails: TabsRoot.ChangeEventDetails) => {
    const activationDirection = computeActivationDirection(
      value(),
      newValue,
      orientation(),
      tabMap(),
    );

    eventDetails.activationDirection = activationDirection;

    componentProps.onValueChange?.(newValue, eventDetails);

    if (eventDetails.isCanceled) {
      return;
    }

    setValue(() => newValue);
  };

  const notifyAutomaticValueChange = (
    nextValue: TabsTab.Value,
    reason: TabsRoot.ChangeEventReason,
  ) => {
    componentProps.onValueChange?.(
      nextValue,
      createChangeEventDetails(reason, undefined, undefined, {
        activationDirection: 'none',
      }) as TabsRoot.ChangeEventDetails,
    );
  };

  const registerMountedTabPanel = (panelValue: TabsTab.Value, panelId: string) => {
    setMountedTabPanels((prev) => {
      const next = new Map(prev);
      next.set(panelValue, panelId);
      return next;
    });

    return () => {
      setMountedTabPanels((prev) => {
        if (prev.get(panelValue) !== panelId) {
          return prev;
        }

        const next = new Map(prev);
        next.delete(panelValue);
        return next;
      });
    };
  };

  const getTabPanelIdByValue = (tabValue: TabsTab.Value) => mountedTabPanels().get(tabValue);

  const getTabIdByPanelValue = (tabPanelValue: TabsTab.Value) => {
    for (const tabMetadata of tabMap().values()) {
      if (tabPanelValue === tabMetadata.value) {
        return tabMetadata.id;
      }
    }
    return undefined;
  };

  const tabsContextValue: TabsRootContext = {
    getTabElementBySelectedValue,
    getTabIdByPanelValue,
    getTabPanelIdByValue,
    onValueChange,
    get orientation() {
      return orientation();
    },
    registerMountedTabPanel,
    setTabMap: (map) => {
      setTabMap(map);
    },
    get tabActivationDirection() {
      return tabActivationDirection();
    },
    get value() {
      return value();
    },
  };

  const selectedTabMetadata = createMemo(() => {
    const currentValue = value();
    for (const tabMetadata of tabMap().values()) {
      if (tabMetadata.value === currentValue) {
        return tabMetadata;
      }
    }
    return undefined;
  });

  const firstEnabledTabValue = createMemo(() => {
    for (const tabMetadata of tabMap().values()) {
      if (!tabMetadata.disabled) {
        return tabMetadata.value;
      }
    }
    return undefined;
  });

  let shouldNotifyInitialValueChange = !hasExplicitDefaultValueProp;
  const initialDefaultValue = defaultValueProp;
  let shouldHonorDisabledDefaultValue = hasExplicitDefaultValueProp;
  let didRegisterTabs = false;

  createEffect(
    () => [firstEnabledTabValue(), selectedTabMetadata(), tabMap(), value()] as const,
    ([firstEnabled, selectedMetadata, currentTabMap, currentValue]) => {
      if (isControlled) {
        return;
      }

      function commitAutomaticValueChange(
        fallbackValue: TabsTab.Value,
        fallbackReason: TabsRoot.ChangeEventReason,
      ) {
        setValue(() => fallbackValue);
        setActivationDirectionState({
          previousValue: fallbackValue,
          tabActivationDirection: 'none',
        });
        notifyAutomaticValueChange(fallbackValue, fallbackReason);
        shouldNotifyInitialValueChange = false;
      }

      if (currentTabMap.size === 0) {
        if (didRegisterTabs && currentValue !== null && !lastKnownTabElement?.isConnected) {
          commitAutomaticValueChange(null, REASONS.missing);
        }
        return;
      }

      didRegisterTabs = true;
      lastKnownTabElement = currentTabMap.keys().next().value;

      const selectionIsDisabled = selectedMetadata?.disabled;
      const selectionIsMissing = selectedMetadata == null && currentValue !== null;

      if (!selectionIsDisabled && currentValue === initialDefaultValue) {
        shouldHonorDisabledDefaultValue = false;
      }

      if (
        shouldHonorDisabledDefaultValue &&
        selectionIsDisabled &&
        currentValue === initialDefaultValue
      ) {
        return;
      }

      if (selectionIsDisabled || selectionIsMissing) {
        const fallbackValue = firstEnabled ?? null;

        if (currentValue === fallbackValue) {
          shouldNotifyInitialValueChange = false;
          return;
        }

        let fallbackReason: TabsRoot.ChangeEventReason = REASONS.missing;

        if (shouldNotifyInitialValueChange) {
          fallbackReason = REASONS.initial;
        } else if (selectionIsDisabled) {
          fallbackReason = REASONS.disabled;
        }

        commitAutomaticValueChange(fallbackValue, fallbackReason);
        return;
      }

      if (shouldNotifyInitialValueChange && selectedMetadata != null) {
        notifyAutomaticValueChange(currentValue, REASONS.initial);
        shouldNotifyInitialValueChange = false;
      }
    },
  );

  const state = (): TabsRootState => ({
    orientation: orientation(),
    tabActivationDirection: tabActivationDirection(),
  });

  return (
    <TabsRootContext value={tabsContextValue}>
      <CompositeList<TabsPanel.Metadata> elementsRef={tabPanelRefs}>
        {untrack(() =>
          useRenderElement('div', componentProps, {
            state,
            props: elementProps,
            stateAttributesMapping: tabsStateAttributesMapping,
          }),
        )}
      </CompositeList>
    </TabsRootContext>
  );
}

type TabsRootContext = import('./TabsRootContext').TabsRootContext;

function findTabElement(
  tabMap: Map<Node, CompositeMetadata<TabsTab.Metadata>>,
  value: TabsTab.Value,
): HTMLElement | null {
  for (const [tabElement, tabMetadata] of tabMap.entries()) {
    if (value === tabMetadata.value) {
      return tabElement as HTMLElement;
    }
  }

  return null;
}

function computeActivationDirection(
  oldValue: TabsTab.Value | null,
  newValue: TabsTab.Value | null,
  orientation: 'horizontal' | 'vertical',
  tabMap: Map<Node, CompositeMetadata<TabsTab.Metadata>>,
): TabsTab.ActivationDirection {
  if (oldValue == null || newValue == null) {
    return 'none';
  }

  const [positionProp, backward, forward] =
    orientation === 'horizontal'
      ? (['left', 'left', 'right'] as const)
      : (['top', 'up', 'down'] as const);

  const oldTab = findTabElement(tabMap, oldValue);
  const newTab = findTabElement(tabMap, newValue);

  if (oldTab == null || newTab == null) {
    if (
      oldTab !== newTab &&
      (typeof oldValue === 'number' || typeof oldValue === 'string') &&
      typeof oldValue === typeof newValue
    ) {
      return newValue > oldValue ? forward : backward;
    }
    return 'none';
  }

  const oldPosition = oldTab.getBoundingClientRect()[positionProp];
  const newPosition = newTab.getBoundingClientRect()[positionProp];

  if (newPosition < oldPosition) {
    return backward;
  }
  if (newPosition > oldPosition) {
    return forward;
  }

  return 'none';
}

export type TabsRootOrientation = BaseOrientation;

export interface TabsRootState {
  /**
   * The component orientation.
   */
  orientation: TabsRoot.Orientation;
  /**
   * The direction used for tab activation.
   */
  tabActivationDirection: TabsTab.ActivationDirection;
}

export interface TabsRootProps extends BaseUIComponentProps<'div', TabsRootState> {
  /**
   * The value of the currently active `Tab`. Use when the component is controlled.
   * When the value is `null`, no Tab will be active.
   */
  value?: TabsTab.Value | undefined;
  /**
   * The default value. Use when the component is not controlled.
   * When the value is `null`, no Tab will be active.
   * @default 0
   */
  defaultValue?: TabsTab.Value | undefined;
  /**
   * The component orientation (layout flow direction).
   * @default 'horizontal'
   */
  orientation?: TabsRoot.Orientation | undefined;
  /**
   * Callback invoked when new value is being set.
   *
   * The event `reason` is `'none'` for user-initiated changes, such as a click
   * or keyboard navigation; `'initial'` for the first automatic selection or
   * fallback in uncontrolled roots when `defaultValue` is omitted or
   * `undefined`, including when the implicit initial value is disabled or
   * missing; `'disabled'` for automatic fallback when the selected tab becomes
   * disabled in uncontrolled roots; or `'missing'` for automatic fallback when
   * the selected tab is removed, or when an explicit `defaultValue` never
   * matches a mounted tab in uncontrolled roots.
   *
   * For automatic changes, the selected value can be `null` when no enabled Tab
   * is available as a fallback.
   *
   * Automatic changes cannot be canceled; calling `eventDetails.cancel()` for
   * `'initial'`, `'disabled'`, or `'missing'` has no effect.
   */
  onValueChange?:
    ((value: TabsTab.Value, eventDetails: TabsRoot.ChangeEventDetails) => void) | undefined;
}

export type TabsRootChangeEventReason =
  typeof REASONS.none | typeof REASONS.disabled | typeof REASONS.missing | typeof REASONS.initial;
export type TabsRootChangeEventDetails = BaseUIChangeEventDetails<
  TabsRoot.ChangeEventReason,
  { activationDirection: TabsTab.ActivationDirection }
>;

export namespace TabsRoot {
  export type State = TabsRootState;
  export type Props = TabsRootProps;
  export type Orientation = TabsRootOrientation;
  export type ChangeEventReason = TabsRootChangeEventReason;
  export type ChangeEventDetails = TabsRootChangeEventDetails;
}
