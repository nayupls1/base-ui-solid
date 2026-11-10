import type { JSX } from '@solidjs/web';
import { createEffect, createMemo, createSignal, omit, Show, untrack } from 'solid-js';
import { useSelectRootContext, useSelectSelectionContext } from '../root/SelectRootContext';
import { CompositeList } from '../../internals/composite/list/CompositeList';
import type { BaseUIComponentProps } from '../../internals/types';
import { useAnchorPositioning } from '../../internals/useAnchorPositioning';
import type {
  Align,
  Side,
  UseAnchorPositioningSharedParameters,
} from '../../internals/useAnchorPositioning';
import { SelectPositionerContext } from './SelectPositionerContext';
import { InternalBackdrop } from '../../utils/popups/InternalBackdrop';
import { DROPDOWN_COLLISION_AVOIDANCE } from '../../internals/constants';
import { clearStyles } from '../popup/utils';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import { findItemIndex } from '../../internals/itemEquality';
import { usePositioner } from '../../utils/popups/positioning/usePositioner';
import { useAnchoredPopupScrollLock } from '../../utils/popups/useAnchoredPopupScrollLock';
import { ownedProps } from '../../internals/ownedProps';

const FIXED: JSX.CSSProperties = { position: 'fixed' };

const POSITIONER_KEYS = [
  'anchor',
  'class',
  'render',
  'positionMethod',
  'side',
  'align',
  'sideOffset',
  'alignOffset',
  'collisionBoundary',
  'collisionPadding',
  'arrowPadding',
  'sticky',
  'disableAnchorTracking',
  'alignItemWithTrigger',
  'collisionAvoidance',
  'style',
  'children',
  'ref',
] as const;

/**
 * Positions the select popup.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Select](https://base-ui.com/react/components/select)
 */
export function SelectPositioner(componentProps: SelectPositioner.Props) {
  componentProps = ownedProps(componentProps);
  const elementProps = omit(componentProps as any, ...POSITIONER_KEYS);
  const alignItemWithTrigger = () => componentProps.alignItemWithTrigger ?? true;

  const store = useSelectRootContext();
  const selection = useSelectSelectionContext();

  const open = store.useState('open');
  const mounted = store.useState('mounted');
  const modal = store.useState('modal');
  const openMethod = store.useState('openMethod');
  const positionerElement = store.useState('positionerElement');
  const triggerElement = store.useState('triggerElement');
  const transitionStatus = store.useState('transitionStatus');

  const scrollUpArrowRef = { current: null as HTMLDivElement | null };
  const scrollDownArrowRef = { current: null as HTMLDivElement | null };

  const [controlledAlignItemWithTrigger, setControlledAlignItemWithTrigger] = createSignal(
    untrack(alignItemWithTrigger),
    { ownedWrite: true },
  );

  const alignItemWithTriggerActive = createMemo(
    () => mounted() && controlledAlignItemWithTrigger() && openMethod() !== 'touch',
  );

  // Reset the internal override from the prop while the popup is unmounted.
  createEffect(
    () => [mounted(), alignItemWithTrigger()] as const,
    ([isMounted, align]) => {
      if (!isMounted && untrack(controlledAlignItemWithTrigger) !== align) {
        setControlledAlignItemWithTrigger(align);
      }
    },
  );

  createEffect(alignItemWithTriggerActive, (active) => {
    store.context.alignItemWithTriggerActiveRef.current = active;
  });

  useAnchoredPopupScrollLock(
    () => (alignItemWithTriggerActive() || modal()) && open(),
    () => openMethod() === 'touch',
    positionerElement,
    triggerElement as any,
  );

  const positioning = useAnchorPositioning({
    get anchor() {
      return componentProps.anchor;
    },
    interactionStore: store as any,
    get positionMethod() {
      return componentProps.positionMethod;
    },
    get mounted() {
      return mounted();
    },
    get side() {
      return componentProps.side;
    },
    get sideOffset() {
      return componentProps.sideOffset;
    },
    get align() {
      return componentProps.align;
    },
    get alignOffset() {
      return componentProps.alignOffset;
    },
    get arrowPadding() {
      return componentProps.arrowPadding;
    },
    get collisionBoundary() {
      return componentProps.collisionBoundary;
    },
    get collisionPadding() {
      return componentProps.collisionPadding;
    },
    get sticky() {
      return componentProps.sticky;
    },
    get disableAnchorTracking() {
      return componentProps.disableAnchorTracking ?? alignItemWithTriggerActive();
    },
    get collisionAvoidance() {
      return componentProps.collisionAvoidance ?? DROPDOWN_COLLISION_AVOIDANCE;
    },
    keepMounted: true,
  } as any);

  const renderedSide = () => (alignItemWithTriggerActive() ? 'none' : positioning.side);

  const state = createMemo<SelectPositionerState>(() => ({
    open: open(),
    side: renderedSide(),
    align: positioning.align,
    anchorHidden: positioning.anchorHidden,
  }));

  createEffect(
    () => positioning.side,
    (side) => {
      store.set('popupSide', side);
    },
  );

  const setPositionerElement = store.useStateSetter('positionerElement');

  const element = () =>
    usePositioner(componentProps as any, state, {
      get styles() {
        return alignItemWithTriggerActive() ? FIXED : positioning.positionerStyles;
      },
      get transitionStatus() {
        return transitionStatus();
      },
      props: elementProps,
      refs: [setPositionerElement as (el: HTMLElement | null) => void],
      get hidden() {
        return !mounted();
      },
      get inert() {
        return !open();
      },
    } as any);

  let prevMapSize = 0;

  const onMapChange = (map: Map<Element, { index?: number | null | undefined } | null>) => {
    if (store.context.valuesRef.current.length === 0) {
      return;
    }

    const prevSize = prevMapSize;
    prevMapSize = map.size;

    const value = selection.value;
    const multiple = selection.multiple;
    const { isItemEqualToValue } = store.context;
    const eventDetails = createChangeEventDetails(REASONS.none);

    if (prevSize !== 0 && !multiple && value != null) {
      const selectedValueIndex = findItemIndex(
        store.context.valuesRef.current,
        value,
        isItemEqualToValue,
      );
      if (selectedValueIndex === -1) {
        const initialSelectedValue = store.context.initialValueRef.current;
        const hasInitial =
          initialSelectedValue != null &&
          findItemIndex(store.context.valuesRef.current, initialSelectedValue, isItemEqualToValue) !==
            -1;
        const nextValue = hasInitial ? initialSelectedValue : null;
        store.context.setValue(nextValue, eventDetails as any);

        if (nextValue === null) {
          store.set('selectedIndex', null);
          store.context.selectedItemTextRef.current = null;
        }
      }
    }

    if (prevSize !== 0 && multiple && Array.isArray(value)) {
      const nextValue = value.filter(
        (selectedItemValue) =>
          findItemIndex(store.context.valuesRef.current, selectedItemValue, isItemEqualToValue) !==
          -1,
      );
      if (nextValue.length !== value.length) {
        store.context.setValue(nextValue, eventDetails as any);

        if (nextValue.length === 0) {
          store.set('selectedIndex', null);
          store.context.selectedItemTextRef.current = null;
        }
      }
    }

    if (store.select('open') && untrack(alignItemWithTriggerActive)) {
      store.update({
        scrollUpArrowVisible: false,
        scrollDownArrowVisible: false,
      } as any);

      const stylesToClear = { height: '' };
      clearStyles(store.select('positionerElement'), stylesToClear);
      clearStyles(store.context.popupRef.current, stylesToClear);
    }
  };

  const contextValue: SelectPositionerContext = Object.defineProperties(
    {} as SelectPositionerContext,
    {
      ...Object.getOwnPropertyDescriptors(positioning),
      side: { get: renderedSide, enumerable: true },
      alignItemWithTriggerActive: { get: alignItemWithTriggerActive, enumerable: true },
      setControlledAlignItemWithTrigger: {
        value: setControlledAlignItemWithTrigger,
        enumerable: true,
      },
      scrollUpArrowRef: { value: scrollUpArrowRef, enumerable: true },
      scrollDownArrowRef: { value: scrollDownArrowRef, enumerable: true },
    },
  );

  return (
    <CompositeList
      elementsRef={store.context.listRef}
      labelsRef={store.context.labelsRef}
      onMapChange={onMapChange as any}
    >
      <SelectPositionerContext value={contextValue}>
        <Show when={mounted() && modal()}>
          <InternalBackdrop inert={!open()} cutout={triggerElement()} />
        </Show>
        {untrack(element)}
      </SelectPositionerContext>
    </CompositeList>
  );
}


export interface SelectPositionerState {
  /**
   * Whether the component is open.
   */
  open: boolean;
  /**
   * The side of the anchor the component is placed on.
   */
  side: Side | 'none';
  /**
   * The alignment of the component relative to the anchor.
   */
  align: Align;
  /**
   * Whether the anchor element is hidden.
   */
  anchorHidden: boolean;
}

export interface SelectPositionerProps
  extends UseAnchorPositioningSharedParameters, BaseUIComponentProps<'div', SelectPositionerState> {
  /**
   * Whether the positioner overlaps the trigger so the selected item's text is aligned with the trigger's value text. This only applies to mouse input and is automatically disabled if there is not enough space.
   * @default true
   */
  alignItemWithTrigger?: boolean | undefined;
}

export namespace SelectPositioner {
  export type State = SelectPositionerState;
  export type Props = SelectPositionerProps;
}
