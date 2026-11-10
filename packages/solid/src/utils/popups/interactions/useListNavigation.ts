import { createEffect, createMemo, untrack, type Accessor } from 'solid-js';
import { useAnimationFrame } from 'base-ui-solidjs-utils/useAnimationFrame';
import { ownerDocument } from 'base-ui-solidjs-utils/owner';
import { platform } from 'base-ui-solidjs-utils/platform';
import { activeElement, contains, getTarget } from 'base-ui-solidjs-utils/shadowDom';
import type { RefObject } from 'base-ui-solidjs-utils/types';
import { isHTMLElement } from '@floating-ui/utils/dom';
import { createChangeEventDetails } from '../../../internals/createBaseUIEventDetails';
import { REASONS } from '../../../internals/reasons';
import { useFloatingParentNodeId, useFloatingTree } from '../tree/FloatingTree';
import type { FloatingTreeStore } from '../tree/FloatingTreeStore';
import type { ElementProps, PopupInteractionStore } from '../types';
import {
  getMaxListIndex,
  getMinListIndex,
  getNextListIndex,
  isIndexOutOfListBounds,
} from '../../../internals/composite/listIndex';
import type { gridNavigation } from './gridNavigation';
import { ARROW_DOWN, ARROW_LEFT, ARROW_RIGHT, ARROW_UP } from '../constants';
import { getFloatingFocusElement, isTypeableCombobox, isTypeableElement } from '../element';
import { enqueueFocus } from '../focus/enqueueFocus';
import { isVirtualClick, isVirtualPointerEvent, stopEvent } from '../event';

// WebKit fires zero-delta `mousemove`/`pointermove` events when the list scrolls
// beneath a stationary pointer, moving the highlight during keyboard navigation.
// https://github.com/mui/base-ui/issues/4002
function isStationaryWebKitPointer(event: MouseEvent | PointerEvent) {
  return platform.engine.webkit && event.movementX === 0 && event.movementY === 0;
}

function doSwitch(
  orientation: UseListNavigationProps['orientation'],
  vertical: boolean,
  horizontal: boolean,
) {
  switch (orientation) {
    case 'vertical':
      return vertical;
    case 'horizontal':
      return horizontal;
    default:
      return vertical || horizontal;
  }
}

export function isMainOrientationKey(
  key: string,
  orientation: UseListNavigationProps['orientation'],
) {
  const vertical = key === ARROW_UP || key === ARROW_DOWN;
  const horizontal = key === ARROW_LEFT || key === ARROW_RIGHT;
  return doSwitch(orientation, vertical, horizontal);
}

export function isMainOrientationToEndKey(
  key: string,
  orientation: UseListNavigationProps['orientation'],
  rtl: boolean,
) {
  const vertical = key === ARROW_DOWN;
  const horizontal = rtl ? key === ARROW_LEFT : key === ARROW_RIGHT;
  return (
    doSwitch(orientation, vertical, horizontal) || key === 'Enter' || key === ' ' || key === ''
  );
}

export function isCrossOrientationOpenKey(
  key: string,
  orientation: UseListNavigationProps['orientation'],
  rtl: boolean,
) {
  const vertical = rtl ? key === ARROW_LEFT : key === ARROW_RIGHT;
  const horizontal = key === ARROW_DOWN;
  return doSwitch(orientation, vertical, horizontal);
}

export function isCrossOrientationCloseKey(
  key: string,
  orientation: UseListNavigationProps['orientation'],
  rtl: boolean,
  grid: boolean,
) {
  const vertical = rtl ? key === ARROW_RIGHT : key === ARROW_LEFT;
  const horizontal = key === ARROW_UP;
  if (orientation === 'both' || (orientation === 'horizontal' && grid)) {
    return key === 'Escape';
  }
  return doSwitch(orientation, vertical, horizontal);
}

export interface UseListNavigationProps {
  /**
   * A ref that holds an array of list items.
   * @default empty list
   */
  listRef: RefObject<Array<HTMLElement | null>>;
  /**
   * The index of the currently active (focused or highlighted) item, which may
   * or may not be selected.
   * @default null
   */
  activeIndex: number | null;
  /**
   * A callback that is called when the user navigates to a new active item,
   * passed in a new `activeIndex`.
   */
  onNavigate?:
    ((activeIndex: number | null, event: Event | undefined) => void) | undefined;
  /**
   * Whether the Hook is enabled, including all internal Effects and event
   * handlers.
   * @default true
   */
  enabled?: boolean | undefined;
  /**
   * The currently selected item index, which may or may not be active.
   * @default null
   */
  selectedIndex?: number | null | undefined;
  /**
   * Whether to focus the item upon opening the floating element. 'auto' infers
   * what to do based on the input type (keyboard vs. pointer), while a boolean
   * value will force the value.
   * @default 'auto'
   */
  focusItemOnOpen?: boolean | 'auto' | undefined;
  /**
   * Whether hovering an item synchronizes the focus.
   * @default true
   */
  focusItemOnHover?: boolean | undefined;
  /**
   * Whether pressing an arrow key on the navigation's main axis opens the
   * floating element.
   * @default true
   */
  openOnArrowKeyDown?: boolean | undefined;
  /**
   * By default elements with either a `disabled` or `aria-disabled` attribute
   * are skipped in the list navigation — however, this requires the items to
   * be rendered.
   * This prop allows you to manually specify indices which should be disabled,
   * overriding the default logic.
   * For Windows-style select popups, where the menu does not open when
   * navigating via arrow keys, specify an empty array.
   * @default undefined
   */
  disabledIndices?: ReadonlyArray<number> | ((index: number) => boolean) | undefined;
  /**
   * Determines whether focus can escape the list, such that nothing is selected
   * after navigating beyond the boundary of the list. In some
   * autocomplete/combobox components, this may be desired, as screen
   * readers will return to the input.
   * `loopFocus` must be `true`.
   * @default false
   */
  allowEscape?: boolean | undefined;
  /**
   * Determines whether focus should loop around when navigating past the first
   * or last item.
   * @default false
   */
  loopFocus?: boolean | undefined;
  /**
   * If the list is nested within another one (e.g. a nested submenu), the
   * navigation semantics change.
   * @default false
   */
  nested?: boolean | undefined;
  /**
   * Allows to specify the orientation of the parent list, which is used to
   * determine the direction of the navigation.
   * This is useful when list navigation is used within a Composite,
   * as the hook can't determine the orientation of the parent list automatically.
   */
  parentOrientation?: UseListNavigationProps['orientation'] | undefined;
  /**
   * Whether the direction of the floating element's navigation is in RTL
   * layout.
   * @default false
   */
  rtl?: boolean | undefined;
  /**
   * Whether the focus is virtual (using `aria-activedescendant`).
   * Use this if you need focus to remain on the reference element
   * (such as an input), but allow arrow keys to navigate list items.
   * This is common in autocomplete listbox components.
   * Your virtually-focused list items must have a unique `id` set on them.
   * @default false
   */
  virtual?: boolean | undefined;
  /**
   * The orientation in which navigation occurs.
   * @default 'vertical'
   */
  orientation?: 'vertical' | 'horizontal' | 'both' | undefined;
  /**
   * The orientation used to open the list from its trigger.
   * @default orientation
   */
  triggerOrientation?: 'vertical' | 'horizontal' | 'both' | undefined;
  /**
   * The id of the root component.
   */
  id?: string | undefined;
  /**
   * Whether to clear the active index when the pointer leaves an item.
   * @default true
   */
  resetOnPointerLeave?: boolean | undefined;
  /**
   * External FloatingTree to use when the one provided by context can't be used.
   */
  externalTree?: FloatingTreeStore | undefined;
  /**
   * Focus target used when a nested list returns to a virtually focused parent.
   */
  nestedReturnFocusRef?: RefObject<HTMLElement | null> | undefined;
  /**
   * Computes two-dimensional list navigation for grid-capable consumers.
   */
  grid?: typeof gridNavigation | null | undefined;
}


/**
 * Adds arrow key-based navigation of a list of items, either using real DOM
 * focus or virtual focus.
 * Props are read lazily, so they can be getters.
 * @see https://floating-ui.com/docs/useListNavigation
 */
export function useListNavigation(
  store: PopupInteractionStore,
  props: UseListNavigationProps,
): ElementProps {
  const listRef = props.listRef;
  const activeIndex = () => props.activeIndex;
  const onNavigateProp = (index: number | null, event: Event | undefined) =>
    props.onNavigate?.(index, event);
  const enabled = () => props.enabled ?? true;
  const selectedIndex = () => props.selectedIndex ?? null;
  const allowEscape = () => props.allowEscape ?? false;
  const loopFocus = () => props.loopFocus ?? false;
  const nested = () => props.nested ?? false;
  const rtl = () => props.rtl ?? false;
  const virtual = () => props.virtual ?? false;
  const focusItemOnOpen = () => props.focusItemOnOpen ?? 'auto';
  const focusItemOnHover = () => props.focusItemOnHover ?? true;
  const openOnArrowKeyDown = () => props.openOnArrowKeyDown ?? true;
  const disabledIndices = () => props.disabledIndices;
  const orientation = () => props.orientation ?? 'vertical';
  const triggerOrientation = () => props.triggerOrientation ?? orientation();
  const resetOnPointerLeave = () => props.resetOnPointerLeave ?? true;
  const navigateGrid = () => props.grid;
  const isGrid = () => navigateGrid() != null;

  if (process.env.NODE_ENV !== 'production') {
    untrack(() => {
      if (allowEscape()) {
        if (!loopFocus()) {
          console.warn('`useListNavigation` looping must be enabled to allow escaping.');
        }

        if (!virtual()) {
          console.warn('`useListNavigation` must be virtual to allow escaping.');
        }
      }

      if (orientation() === 'vertical' && isGrid()) {
        console.warn(
          'In grid list navigation mode, the `orientation` should',
          'be either "horizontal" or "both".',
        );
      }
    });
  }

  const open = store.useState('open') as Accessor<boolean>;
  const positionerElement = store.useState('positionerElement') as Accessor<HTMLElement | null>;
  const anchorElement = store.useState('anchorElement') as Accessor<Element | null>;

  const storeContext = store.context;

  // The popup can mount after its positioner; also track the popup element so the DOM query in
  // `getFloatingFocusElement` re-runs.
  const popupElement = (store as any).useState?.('popupElement') as
    | Accessor<HTMLElement | null>
    | undefined;
  const floatingFocusElement = createMemo(() => {
    popupElement?.();
    return getFloatingFocusElement(positionerElement());
  });
  const typeableComboboxReference = () => isTypeableCombobox(anchorElement() as Element | null);

  const floatingFocusElementRef = {
    get current() {
      return untrack(floatingFocusElement);
    },
  };

  const parentId = useFloatingParentNodeId();
  const tree = useFloatingTree(untrack(() => props.externalTree));

  let focusItemOnOpenValue: boolean | 'auto' = untrack(focusItemOnOpen);
  let index = untrack(selectedIndex) ?? -1;
  let key: null | string = null;
  let isPointerModality = true;

  const onNavigate = (event?: Event) => {
    onNavigateProp(index === -1 ? null : index, event);
  };

  let previousMounted = !!untrack(positionerElement);
  let previousOpen = untrack(open);
  let forceSyncFocus = false;
  let forceScrollIntoView = false;
  let cancelQueuedFocus: (() => void) | null = null;

  const focusFrame = useAnimationFrame();
  const waitForListPopulatedFrame = useAnimationFrame();

  const focusItem = () => {
    // Synchronous navigation must also supersede any deferred focus from an earlier update.
    focusFrame.cancel();

    const isVirtual = untrack(virtual);
    function runFocus(item: HTMLElement) {
      if (!isVirtual) {
        cancelQueuedFocus = enqueueFocus(item, {
          sync: forceSyncFocus,
          preventScroll: true,
        });
      }
    }

    const initialItem = listRef.current[index];
    const shouldForceScrollIntoView = forceScrollIntoView;

    if (initialItem) {
      runFocus(initialItem);
    }

    const scheduler = forceSyncFocus
      ? (callback: () => void) => callback()
      : (callback: () => void) => focusFrame.request(callback);

    scheduler(() => {
      const waitedItem = listRef.current[index] || initialItem;

      if (!waitedItem) {
        return;
      }

      if (!initialItem) {
        runFocus(waitedItem);
      }

      const shouldScrollIntoView = shouldForceScrollIntoView || !isPointerModality;

      if (shouldScrollIntoView) {
        // JSDOM doesn't support `.scrollIntoView()` but it's widely supported
        // by all browsers.
        waitedItem.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
      }
    });
  };

  createEffect(orientation, (value) => {
    storeContext.orientation = value;
  });

  // Reset on its own: an explicit `focusItemOnOpen` can change one render before `open` does,
  // which must not discard the key the trigger just recorded.
  createEffect(open, (isOpen) => {
    if (!isOpen) {
      key = null;
    }
  });

  createEffect(
    () => [open(), focusItemOnOpen()] as const,
    ([isOpen, focusOnOpen]) => {
      // Explicit values can change with the opening interaction. Keep an inferred 'auto' value
      // from the trigger event, but apply a boolean before the initial highlight is synchronized.
      if (!isOpen || focusOnOpen !== 'auto') {
        focusItemOnOpenValue = focusOnOpen;
      }
    },
  );

  // Sync `selectedIndex` to be the `activeIndex` upon opening the floating
  // element. Also, reset `activeIndex` upon closing the floating element.
  createEffect(
    () => [enabled(), open(), positionerElement(), selectedIndex()] as const,
    ([isEnabled, isOpen, positioner, selected]) => {
      if (!isEnabled) {
        return;
      }

      if (isOpen && positioner) {
        index = selected ?? -1;
        if (focusItemOnOpenValue && selected != null) {
          // Regardless of the pointer modality, we want to ensure the selected
          // item comes into view when the floating element is opened.
          forceScrollIntoView = true;
          onNavigate();
        }
      } else if (previousMounted) {
        // Reset the active index when the list is no longer open and mounted (closing or
        // unmounting).
        index = -1;
        onNavigate();
      }
    },
  );

  // Sync `activeIndex` to be the focused item while the floating element is
  // open.
  createEffect(
    () => [enabled(), open(), positionerElement(), activeIndex()] as const,
    ([isEnabled, isOpen, positioner, active]) => {
      if (!isEnabled) {
        return;
      }
      if (!isOpen) {
        forceSyncFocus = false;
        return;
      }
      if (!positioner) {
        return;
      }

      if (active == null) {
        forceSyncFocus = false;

        if (untrack(selectedIndex) != null) {
          return;
        }

        // Reset while the floating element was open (e.g. the list changed).
        if (previousMounted) {
          index = -1;
          focusItem();
        }

        // Initial sync.
        if (
          (!previousOpen || !previousMounted) &&
          focusItemOnOpenValue &&
          (key != null || (focusItemOnOpenValue === true && key == null))
        ) {
          let runs = 0;
          const waitForListPopulated = () => {
            if (listRef.current[0] == null) {
              // Avoid letting the browser paint if possible on the first try,
              // otherwise use rAF. Don't try more than twice, since something
              // is wrong otherwise.
              if (runs < 2) {
                const scheduler = runs
                  ? (callback: () => void) => waitForListPopulatedFrame.request(callback)
                  : queueMicrotask;
                scheduler(waitForListPopulated);
              }
              runs += 1;
            } else {
              // Initially focus the first non-disabled item. `disabledIndices` is deliberately
              // omitted here so attribute-disabled items (`disabled`/`aria-disabled`) are skipped
              // on open even when the consumer passes an empty `disabledIndices` array.
              // The key came from the trigger, so it is read on the trigger's orientation.
              index =
                key == null ||
                isMainOrientationToEndKey(key, untrack(triggerOrientation), untrack(rtl)) ||
                untrack(nested)
                  ? getMinListIndex(listRef)
                  : getMaxListIndex(listRef);
              key = null;
              onNavigate();
            }
          };

          waitForListPopulated();
        }
      } else if (!isIndexOutOfListBounds(listRef.current, active)) {
        index = active;
        focusItem();
        forceScrollIntoView = false;
      }
    },
  );

  // Ensure the parent floating element has focus when a nested child closes
  // to allow arrow key navigation to work after the pointer leaves the child.
  createEffect(
    () => [enabled(), positionerElement(), anchorElement(), virtual()] as const,
    ([isEnabled, positioner, anchor, isVirtual]) => {
      if (!isEnabled || positioner || !tree || isVirtual || !previousMounted) {
        return;
      }

      const nodes = tree.nodesRef.current;
      const parent = nodes.find((node) => node.id === parentId)?.context?.elements.floating;
      const activeEl = activeElement(ownerDocument((anchor as Element | null) ?? parent ?? null));
      const treeContainsActiveEl = nodes.some(
        (node) => node.context && contains(node.context.elements.floating, activeEl),
      );

      if (parent && !treeContainsActiveEl && isPointerModality) {
        parent.focus({ preventScroll: true });
      }
    },
  );

  // Runs after the effects above (effects run in creation order).
  createEffect(
    () => [open(), positionerElement()] as const,
    ([isOpen, positioner]) => {
      previousOpen = isOpen;
      previousMounted = !!positioner;
    },
  );

  const syncCurrentTarget = (event: Event) => {
    if (!store.select('open')) {
      return;
    }

    const currentIndex = listRef.current.indexOf(event.currentTarget as HTMLElement);
    if (currentIndex !== -1 && (index !== currentIndex || untrack(activeIndex) !== currentIndex)) {
      index = currentIndex;
      onNavigate(event);
    }
  };

  const getParentOrientation = () => {
    return (
      untrack(() => props.parentOrientation) ??
      tree?.nodesRef.current.find((node) => node.id === parentId)?.context?.rootStore.context
        .orientation
    );
  };

  const getMinEnabledIndex = () => {
    return getMinListIndex(listRef, untrack(disabledIndices));
  };

  const commonOnKeyDown = (event: KeyboardEvent) => {
    isPointerModality = false;
    forceSyncFocus = true;

    // When composing a character, Chrome fires ArrowDown twice. Firefox/Safari
    // don't appear to suffer from this. `event.isComposing` is avoided due to
    // Safari not supporting it properly (although it's not needed in the first
    // place for Safari, just avoiding any possible issues).
    if (event.which === 229) {
      return;
    }

    // If the floating element is animating out, ignore navigation. Otherwise,
    // the `activeIndex` gets set to 0 despite not being open so the next time
    // the user ArrowDowns, the first item won't be focused.
    if (!store.select('open') && event.currentTarget === floatingFocusElementRef.current) {
      return;
    }

    const currentOrientation = untrack(orientation);
    const isRtl = untrack(rtl);
    const isVirtual = untrack(virtual);
    const currentDisabledIndices = untrack(disabledIndices);
    const currentActiveIndex = untrack(activeIndex);
    const grid = untrack(navigateGrid);

    if (
      untrack(nested) &&
      isCrossOrientationCloseKey(event.key, currentOrientation, isRtl, grid != null)
    ) {
      // If the nested list's close key is also the parent navigation key,
      // let the parent navigate. Otherwise, stop propagating the event.
      if (!isMainOrientationKey(event.key, getParentOrientation())) {
        stopEvent(event);
      }

      store.setOpen(false, createChangeEventDetails(REASONS.listNavigation, event));

      const returnElement = props.nestedReturnFocusRef?.current ?? untrack(anchorElement);
      if (isHTMLElement(returnElement)) {
        returnElement.focus();
      }

      return;
    }

    // The consumer owns `activeIndex` and may decline a navigation this hook proposed, such as a
    // virtual list keeping its highlight when the reference is refocused. Reconcile here:
    // otherwise the cursor drifts from the rendered highlight and this key moves from the wrong
    // position.
    if (
      currentActiveIndex != null &&
      currentActiveIndex !== index &&
      !isIndexOutOfListBounds(listRef.current, currentActiveIndex)
    ) {
      index = currentActiveIndex;
    }

    const currentIndex = index;
    const minIndex = getMinListIndex(listRef, currentDisabledIndices);
    const maxIndex = getMaxListIndex(listRef, currentDisabledIndices);

    if (!untrack(typeableComboboxReference)) {
      if (event.key === 'Home') {
        stopEvent(event);
        index = minIndex;
        onNavigate(event);
      }

      if (event.key === 'End') {
        stopEvent(event);
        index = maxIndex;
        onNavigate(event);
      }
    }

    // Grid navigation is injected by grid-capable consumers so non-grid
    // consumers (menu, select) tree-shake the grid helpers out.
    if (grid != null) {
      const nextIndex = grid(
        event as any,
        index,
        listRef,
        currentOrientation,
        untrack(loopFocus),
        isRtl,
        currentDisabledIndices,
        minIndex,
        maxIndex,
      );

      // The grid navigator returns the unchanged index for keys it does not handle, and
      // reporting that as a navigation would re-emit the current highlight on every keydown.
      if (nextIndex != null && nextIndex !== index) {
        index = nextIndex;
        onNavigate(event);
      }

      if (currentOrientation === 'both') {
        return;
      }
    }

    if (isMainOrientationKey(event.key, currentOrientation)) {
      stopEvent(event);

      // Reset the index if no item is focused. Focus can also rest on a container inside the
      // popup, such as a list that holds the `menu` role. Keys bubbling from a portaled nested
      // popup are not in this popup's DOM, so they navigate from the current index.
      const currentTarget = event.currentTarget as HTMLElement;
      const focusedElement = activeElement(currentTarget.ownerDocument);
      if (
        store.select('open') &&
        !isVirtual &&
        contains(currentTarget, focusedElement) &&
        !listRef.current.some((item) => item != null && contains(item, focusedElement))
      ) {
        index = isMainOrientationToEndKey(event.key, currentOrientation, isRtl)
          ? minIndex
          : maxIndex;
        onNavigate(event);
        // The boundary item may already be highlighted, so `activeIndex` won't change and the
        // effect that moves focus to the highlighted item won't run.
        if (currentActiveIndex === index) {
          focusItem();
        }
        return;
      }

      const { index: nextIndex, wrapped } = getNextListIndex(listRef.current, currentIndex, {
        decrement: !isMainOrientationToEndKey(event.key, currentOrientation, isRtl),
        loopFocus: untrack(loopFocus),
        allowEscape: untrack(allowEscape),
        disabledIndices: currentDisabledIndices,
        minIndex,
        maxIndex,
      });
      if (wrapped) {
        // Give time for virtualizers to update the listRef.
        forceSyncFocus = false;
      }
      index = nextIndex;

      onNavigate(event);
    }
  };

  const item: ElementProps['item'] = {
    onFocus(event: FocusEvent) {
      forceSyncFocus = true;
      syncCurrentTarget(event);
    },
    onMouseMove(event: MouseEvent) {
      if (isStationaryWebKitPointer(event)) {
        return;
      }
      forceSyncFocus = true;
      forceScrollIntoView = false;
      if (untrack(focusItemOnHover)) {
        syncCurrentTarget(event);
      }
    },
    onPointerLeave(event: PointerEvent) {
      if (!store.select('open') || !isPointerModality || event.pointerType === 'touch') {
        return;
      }

      forceSyncFocus = true;

      const relatedTarget = event.relatedTarget as HTMLElement | null;

      if (!untrack(focusItemOnHover) || listRef.current.includes(relatedTarget)) {
        return;
      }

      if (!untrack(resetOnPointerLeave)) {
        return;
      }

      cancelQueuedFocus?.();
      cancelQueuedFocus = null;

      index = -1;
      onNavigate(event);

      if (!untrack(virtual)) {
        const floatingFocusEl = floatingFocusElementRef.current;
        const activeEl = activeElement(ownerDocument(floatingFocusEl));
        if (floatingFocusEl && contains(floatingFocusEl, activeEl)) {
          floatingFocusEl.focus({ preventScroll: true });
        }
      }
    },
  } as any;

  const ariaActiveDescendant = () =>
    virtual() && open() && activeIndex() != null
      ? `${props.id}-${activeIndex()}`
      : undefined;

  const floating: ElementProps['floating'] = {
    get 'aria-activedescendant'() {
      return !typeableComboboxReference() ? ariaActiveDescendant() : undefined;
    },
    onKeyDown(event: KeyboardEvent) {
      // Close submenu on Shift+Tab
      if (event.key === 'Tab' && event.shiftKey && store.select('open') && !untrack(virtual)) {
        // If the event originated from within a nested element (e.g., a Dialog opened from
        // within the menu), don't close the menu. The nested element has its own focus
        // management and should handle the Tab key.
        const target = getTarget(event) as Element | null;
        if (target && !contains(floatingFocusElementRef.current, target)) {
          return;
        }

        stopEvent(event);
        const details = createChangeEventDetails(REASONS.focusOut, event);
        store.setOpen(false, details);

        const returnElement = props.nestedReturnFocusRef?.current ?? untrack(anchorElement);
        if (!details.isCanceled && isHTMLElement(returnElement)) {
          returnElement.focus();
        }

        return;
      }

      commonOnKeyDown(event);
    },
    onPointerMove(event: PointerEvent) {
      if (isStationaryWebKitPointer(event)) {
        return;
      }
      isPointerModality = true;
    },
  } as any;

  function openOnNavigationKeyDown(event: KeyboardEvent) {
    store.setOpen(
      true,
      createChangeEventDetails(
        REASONS.listNavigation,
        event,
        event.currentTarget as HTMLElement,
      ),
    );
  }

  function checkVirtualMouse(event: MouseEvent) {
    if (untrack(focusItemOnOpen) === 'auto' && isVirtualClick(event)) {
      focusItemOnOpenValue = !untrack(virtual);
    }
  }

  function checkVirtualPointer(event: PointerEvent) {
    // `pointerdown` fires first, reset the state then perform the checks.
    const focusOnOpen = untrack(focusItemOnOpen);
    focusItemOnOpenValue = focusOnOpen;
    if (focusOnOpen === 'auto' && isVirtualPointerEvent(event)) {
      focusItemOnOpenValue = true;
    }
  }

  const trigger: ElementProps['trigger'] = {
    onKeyDown(event: KeyboardEvent) {
      // non-reactive open state (to prevent re-creation of the handler)
      const currentOpen = store.select('open');
      isPointerModality = false;

      const isRtl = untrack(rtl);
      const isNested = untrack(nested);
      const isVirtual = untrack(virtual);
      const isArrowKey = event.key.startsWith('Arrow');
      const isParentCrossOpenKey = isCrossOrientationOpenKey(
        event.key,
        getParentOrientation(),
        isRtl,
      );
      const isMainKey = isMainOrientationKey(
        event.key,
        currentOpen ? untrack(orientation) : untrack(triggerOrientation),
      );
      const isNavigationKey =
        (isNested ? isParentCrossOpenKey : isMainKey) ||
        event.key === 'Enter' ||
        event.key.trim() === '';

      if (isVirtual && currentOpen && (!isNested || isTypeableElement(event.currentTarget))) {
        return commonOnKeyDown(event);
      }

      // If a floating element should not open on arrow key down, avoid
      // setting `activeIndex` while it's closed.
      if (!currentOpen && !untrack(openOnArrowKeyDown) && isArrowKey) {
        return undefined;
      }

      if (isNavigationKey) {
        const isParentMainKey = isMainOrientationKey(event.key, getParentOrientation());
        key = isNested && isParentMainKey ? null : event.key;
      }

      if (isNested) {
        if (isParentCrossOpenKey) {
          stopEvent(event);

          if (currentOpen) {
            index = getMinEnabledIndex();
            onNavigate(event);
            if (isVirtual) {
              floatingFocusElementRef.current?.focus();
            }
          } else {
            openOnNavigationKeyDown(event);
          }
        }

        return undefined;
      }

      if (isMainKey) {
        const selected = untrack(selectedIndex);
        if (selected != null) {
          index = selected;
        }

        stopEvent(event);

        if (!currentOpen && untrack(openOnArrowKeyDown)) {
          openOnNavigationKeyDown(event);
        } else {
          commonOnKeyDown(event);
        }

        if (currentOpen) {
          onNavigate(event);
        }
      }

      return undefined;
    },
    onFocus(event: FocusEvent) {
      if (event.target !== event.currentTarget) {
        return;
      }

      if (store.select('open') && !untrack(virtual)) {
        index = -1;
        onNavigate(event);
      }
    },
    onPointerDown: checkVirtualPointer,
    onPointerEnter: checkVirtualPointer,
    onMouseDown: checkVirtualMouse,
    onClick: checkVirtualMouse,
  } as any;

  const reference: ElementProps['reference'] = {
    get 'aria-activedescendant'() {
      return ariaActiveDescendant();
    },
    ...trigger,
  } as any;

  return {
    get reference() {
      return enabled() ? reference : undefined;
    },
    get floating() {
      return enabled() ? floating : undefined;
    },
    get item() {
      return enabled() ? item : undefined;
    },
    get trigger() {
      return enabled() ? trigger : undefined;
    },
  } as ElementProps;
}
