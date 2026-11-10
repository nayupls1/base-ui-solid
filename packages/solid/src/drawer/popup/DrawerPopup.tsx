import { createEffect, createMemo, createSignal, omit, onCleanup, untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';
import type { RefObject } from 'base-ui-solidjs-utils/types';
import { error } from 'base-ui-solidjs-utils/error';
import type { InteractionType } from 'base-ui-solidjs-utils/useEnhancedClickHandler';
import { EMPTY_OBJECT } from 'base-ui-solidjs-utils/empty';
import { FloatingFocusManager } from '../../utils/popups/focus/FloatingFocusManager';
import { useDialogRootContext } from '../../dialog/root/DialogRootContext';
import { useRenderElement } from '../../internals/useRenderElement';
import type { BaseUIComponentProps } from '../../internals/types';
import type { TransitionStatus } from '../../internals/useTransitionStatus';
import type { StateAttributesMapping } from '../../internals/getStateAttributesProps';
import { popupTransitionStateMapping } from '../../utils/popups/popupStateMapping';
import * as DrawerBackdropCssVars from '../backdrop/DrawerBackdropCssVars';
import * as DrawerPopupCssVars from './DrawerPopupCssVars';
import * as DrawerPopupDataAttributes from './DrawerPopupDataAttributes';
import { useDialogPortalContext } from '../../dialog/portal/DialogPortalContext';
import { useOpenChangeComplete } from '../../internals/useOpenChangeComplete';
import { COMPOSITE_KEYS } from '../../internals/composite/composite';
import { useDrawerRootContext } from '../root/DrawerRootContext';
import type { DrawerSwipeDirection } from '../root/DrawerRootContext';
import { getSnapPointSwipeMovement, useDrawerSnapPoints } from '../root/useDrawerSnapPoints';
import { useDrawerViewportContext } from '../viewport/DrawerViewportContext';
import { FOCUSABLE_POPUP_PROPS } from '../../utils/popups/popupStoreUtils';
import { mergeProps } from '../../merge-props';
import { ownedProps } from '../../internals/ownedProps';

// Module-level flag to ensure we only register the CSS properties once,
// regardless of how many Drawer components are mounted.
let drawerSwipeVarsRegistered = false;

/**
 * Removes inheritance of high-frequency drawer swipe CSS variables, which
 * reduces style recalculation cost in complex drawers with deep subtrees.
 * See https://motion.dev/blog/web-animation-performance-tier-list
 * under the "Improving CSS variable performance" section.
 */
function removeCSSVariableInheritance() {
  if (drawerSwipeVarsRegistered) {
    return;
  }

  // Intentionally keep inheritance disabled on WebKit as well. Safari doesn't support
  // opting descendants back in via `--var: inherit` for custom properties registered
  // with `inherits: false`, but Drawer does not rely on descendant access to these vars
  // (unlike ScrollArea), so we keep the performance optimization enabled.
  if (typeof CSS !== 'undefined' && 'registerProperty' in CSS) {
    [
      DrawerPopupCssVars.swipeMovementX,
      DrawerPopupCssVars.swipeMovementY,
      DrawerPopupCssVars.snapPointOffset,
    ].forEach((name) => {
      try {
        CSS.registerProperty({
          name,
          syntax: '<length>',
          inherits: false,
          initialValue: '0px',
        });
      } catch {
        /* ignore already-registered */
      }
    });

    [
      {
        name: DrawerBackdropCssVars.swipeProgress,
        initialValue: '0',
      },
      {
        name: DrawerPopupCssVars.swipeStrength,
        initialValue: '1',
      },
    ].forEach(({ name, initialValue }) => {
      try {
        CSS.registerProperty({
          name,
          syntax: '<number>',
          inherits: false,
          initialValue,
        });
      } catch {
        /* ignore already-registered */
      }
    });
  }

  drawerSwipeVarsRegistered = true;
}

const stateAttributesMapping: StateAttributesMapping<DrawerPopupState> = {
  ...popupTransitionStateMapping,
  expanded(value) {
    return value ? { [DrawerPopupDataAttributes.expanded]: '' } : null;
  },
  nestedDrawerOpen(value) {
    return value ? { [DrawerPopupDataAttributes.nestedDrawerOpen]: '' } : null;
  },
  nestedDrawerSwiping(value) {
    return value ? { [DrawerPopupDataAttributes.nestedDrawerSwiping]: '' } : null;
  },
  swipeDirection(value) {
    return { [DrawerPopupDataAttributes.swipeDirection]: value };
  },
  swiping(value) {
    return value ? { [DrawerPopupDataAttributes.swiping]: '' } : null;
  },
};

/**
 * A container for the drawer contents.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Drawer](https://base-ui.com/react/components/drawer)
 */
export function DrawerPopup(componentProps: DrawerPopup.Props) {
  componentProps = ownedProps(componentProps);
  const elementProps = omit(
    componentProps,
    'render',
    'class',
    'style',
    'finalFocus',
    'initialFocus',
    'children',
    'ref',
  );

  const store = useDialogRootContext();
  const popupRef = store.context.popupRef;

  const root = useDrawerRootContext();
  const {
    nestedSwipeProgressStore,
    onPopupHeightChange,
    notifyParentFrontmostHeight,
    notifyParentHasNestedDrawer,
  } = root;

  const descriptionElementId = store.useState('descriptionElementId');
  const disablePointerDismissal = store.useState('disablePointerDismissal');
  const rootPopupProps = store.useState('popupProps');
  const modal = store.useState('modal');
  const mounted = store.useState('mounted');
  const nested = store.useState('nested');
  const nestedOpenDrawerCount = store.useState('nestedOpenDrawerCount');
  const transitionStatus = store.useState('transitionStatus');
  const open = store.useState('open');
  const openMethod = store.useState('openMethod');
  const titleElementId = store.useState('titleElementId');
  const role = store.useState('role');
  const defaultPopupId = store.useState('defaultPopupId');

  const popupId = () => (componentProps as any).id ?? defaultPopupId();

  const swipe = useDrawerViewportContext();
  useDialogPortalContext();
  const snap = useDrawerSnapPoints();

  const nestedDrawerOpen = () => nestedOpenDrawerCount() > 0;
  const swiping = () => swipe?.swiping ?? false;
  const swipeStrength = () => swipe?.swipeStrength ?? null;

  const [popupHeight, setPopupHeight] = createSignal(0, { ownedWrite: true });
  let lastPopupHeight = 0;

  if (process.env.NODE_ENV !== 'production') {
    if (!swipe) {
      error(
        '<Drawer.Popup> expected to be rendered within <Drawer.Viewport>. Omitting the ' +
          'viewport disables drawer swipe handling and touch scroll locking. Wrap ' +
          '<Drawer.Popup> in <Drawer.Viewport>.',
      );
    }
  }

  const measureHeight = () => {
    const popupElement = popupRef.current;
    if (!popupElement) {
      return;
    }

    const offsetHeight = popupElement.offsetHeight;
    const frontmostHeight = untrack(() => root.frontmostHeight);

    // Only skip while the element is still actually stretched beyond its last measured height.
    if (
      lastPopupHeight > 0 &&
      frontmostHeight > lastPopupHeight &&
      offsetHeight > lastPopupHeight
    ) {
      return;
    }

    const keepHeightWhileNested = lastPopupHeight > 0 && untrack(() => root.hasNestedDrawer);
    if (keepHeightWhileNested) {
      const oldHeight = lastPopupHeight;
      setPopupHeight(oldHeight);
      onPopupHeightChange(oldHeight);
      return;
    }

    const nextHeight = offsetHeight;
    if (nextHeight === lastPopupHeight) {
      return;
    }

    lastPopupHeight = nextHeight;
    setPopupHeight(nextHeight);
    onPopupHeightChange(nextHeight);
  };

  const [popupElementSignal, setPopupElementSignal] = createSignal<HTMLElement | null>(null, {
    ownedWrite: true,
  });

  createEffect(
    () => [mounted(), nestedDrawerOpen(), popupElementSignal()] as const,
    ([isMounted, , popupElement]) => {
      if (!isMounted) {
        lastPopupHeight = 0;
        setPopupHeight(0);
        onPopupHeightChange(0);
        return undefined;
      }

      if (!popupElement) {
        return undefined;
      }

      removeCSSVariableInheritance();
      measureHeight();

      if (typeof ResizeObserver !== 'function') {
        return undefined;
      }

      const resizeObserver = new ResizeObserver(measureHeight);

      resizeObserver.observe(popupElement);
      return () => {
        resizeObserver.disconnect();
      };
    },
  );

  createEffect(popupElementSignal, (popupElement) => {
    if (!popupElement) {
      return undefined;
    }
    const syncNestedSwipeProgress = () => {
      const progress = nestedSwipeProgressStore.getSnapshot();
      if (progress > 0) {
        popupElement.style.setProperty(DrawerBackdropCssVars.swipeProgress, `${progress}`);
      } else {
        popupElement.style.setProperty(DrawerBackdropCssVars.swipeProgress, '0');
      }
    };

    syncNestedSwipeProgress();
    const unsubscribe = nestedSwipeProgressStore.subscribe(syncNestedSwipeProgress);

    return () => {
      unsubscribe();
      popupElement.style.setProperty(DrawerBackdropCssVars.swipeProgress, '0');
    };
  });

  createEffect(
    () => [root.frontmostHeight, open()] as const,
    ([frontmostHeight, isOpen]) => {
      if (!isOpen) {
        return undefined;
      }

      notifyParentFrontmostHeight?.(frontmostHeight);

      return () => {
        notifyParentFrontmostHeight?.(0);
      };
    },
  );

  createEffect(
    () => open() || transitionStatus() === 'ending',
    (present) => {
      if (!notifyParentHasNestedDrawer) {
        return undefined;
      }

      notifyParentHasNestedDrawer(present);

      return () => {
        notifyParentHasNestedDrawer(false);
      };
    },
  );

  useOpenChangeComplete({
    get open() {
      return open();
    },
    ref: popupRef,
    onComplete() {
      if (untrack(open)) {
        store.context.onOpenChangeComplete?.(true);
      }
    },
  });

  const resolvedInitialFocus = () =>
    componentProps.initialFocus === undefined ? popupRef : componentProps.initialFocus;

  const setPopupElement = store.useStateSetter('popupElement');

  const state = createMemo<DrawerPopupState>(() => ({
    open: open(),
    nested: nested(),
    transitionStatus: transitionStatus(),
    expanded: snap.activeSnapPoint === 1,
    nestedDrawerOpen: nestedDrawerOpen(),
    nestedDrawerSwiping: root.nestedSwiping,
    swipeDirection: root.swipeDirection,
    swiping: swiping(),
  }));

  const popupStyle = (): JSX.CSSProperties => {
    const swipeDirection = root.swipeDirection;
    const height = popupHeight();
    let popupHeightCssVarValue: string | undefined;
    const shouldUseAutoHeight = !root.hasNestedDrawer && transitionStatus() !== 'ending';
    if (height && !shouldUseAutoHeight) {
      popupHeightCssVarValue = `${height}px`;
    }

    const snapPoints = snap.snapPoints;
    const activeSnapPointOffset = snap.activeSnapPointOffset;
    const shouldApplySnapPoints =
      snapPoints && snapPoints.length > 0 && (swipeDirection === 'down' || swipeDirection === 'up');
    let snapPointOffsetValue: number | null = null;
    if (shouldApplySnapPoints && activeSnapPointOffset !== null) {
      snapPointOffsetValue =
        swipeDirection === 'up' ? -activeSnapPointOffset : activeSnapPointOffset;
    }

    let dragStyles: JSX.CSSProperties = swipe ? swipe.getDragStyles() : EMPTY_OBJECT;
    if (shouldApplySnapPoints && swipeDirection === 'down') {
      const baseOffset = activeSnapPointOffset ?? 0;
      const movementValue = Number.parseFloat(
        String((dragStyles as Record<string, string>)[DrawerPopupCssVars.swipeMovementY]),
      );

      if (swiping() && Number.isFinite(movementValue)) {
        dragStyles = {
          ...dragStyles,
          transform: undefined,
          [DrawerPopupCssVars.swipeMovementY]: `${getSnapPointSwipeMovement(
            baseOffset,
            movementValue,
          )}px`,
        } as JSX.CSSProperties;
      } else {
        dragStyles = {
          ...dragStyles,
          transform: undefined,
        };
      }
    }

    const frontmostHeight = root.frontmostHeight;
    const strength = swipeStrength();

    return {
      ...dragStyles,
      [DrawerBackdropCssVars.swipeProgress]: '0',
      [DrawerPopupCssVars.nestedDrawers]: String(nestedOpenDrawerCount()),
      [DrawerPopupCssVars.height]: popupHeightCssVarValue,
      [DrawerPopupCssVars.snapPointOffset]:
        typeof snapPointOffsetValue === 'number' ? `${snapPointOffsetValue}px` : '0px',
      [DrawerPopupCssVars.frontmostHeight]: frontmostHeight ? `${frontmostHeight}px` : undefined,
      [DrawerPopupCssVars.swipeStrength]:
        typeof strength === 'number' && Number.isFinite(strength) && strength > 0
          ? `${strength}`
          : '1',
    } as JSX.CSSProperties;
  };

  return (
    <FloatingFocusManager
      store={store}
      openInteractionType={openMethod()}
      disabled={!mounted()}
      closeOnFocusOut={!disablePointerDismissal()}
      initialFocus={resolvedInitialFocus() as any}
      returnFocus={componentProps.finalFocus as any}
      modal={modal() !== false}
      restoreFocus="popup"
    >
      {untrack(() =>
        useRenderElement('div', componentProps, {
          state,
          props: [
            (merged: Record<string, any>) => mergeProps(merged, rootPopupProps()),
            {
              get id() {
                return popupId();
              },
              get 'aria-labelledby'() {
                return titleElementId();
              },
              get 'aria-describedby'() {
                return descriptionElementId();
              },
              get role() {
                return role();
              },
              ...FOCUSABLE_POPUP_PROPS,
              get hidden() {
                return !mounted();
              },
              onKeyDown(event: KeyboardEvent) {
                if (COMPOSITE_KEYS.has(event.key)) {
                  event.stopPropagation();
                }
              },
              get style() {
                return popupStyle();
              },
            },
            elementProps,
          ],
          ref: [
            (el: HTMLElement | null) => {
              popupRef.current = el;
              setPopupElementSignal(() => el);
            },
            setPopupElement as (el: HTMLElement | null) => void,
          ],
          stateAttributesMapping,
        }),
      )}
    </FloatingFocusManager>
  );
}

export interface DrawerPopupProps extends BaseUIComponentProps<'div', DrawerPopupState> {
  /**
   * Determines the element to focus when the drawer is opened.
   *
   * - `false`: Do not move focus.
   * - `true`: Move focus based on the default behavior (first tabbable element or popup).
   * - `RefObject`: Move focus to the ref element.
   * - `function`: Called with the interaction type (`mouse`, `touch`, `pen`, or `keyboard`).
   *   Return an element to focus, `true` to use the default behavior, or `false`/`undefined` to do nothing.
   */
  initialFocus?:
    | boolean
    | RefObject<HTMLElement | null>
    | ((openType: InteractionType) => boolean | HTMLElement | null | void)
    | undefined;
  /**
   * Determines the element to focus when the drawer is closed.
   *
   * - `false`: Do not move focus.
   * - `true`: Move focus based on the default behavior (trigger or previously focused element).
   * - `RefObject`: Move focus to the ref element.
   * - `function`: Called with the interaction type (`mouse`, `touch`, `pen`, or `keyboard`).
   *   Return an element to focus, `true` to use the default behavior, or `false`/`undefined` to do nothing.
   */
  finalFocus?:
    | boolean
    | RefObject<HTMLElement | null>
    | ((closeType: InteractionType) => boolean | HTMLElement | null | void)
    | undefined;
}

export interface DrawerPopupState {
  /**
   * Whether the drawer is currently open.
   */
  open: boolean;
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
  /**
   * Whether the active snap point is the full-height expanded state.
   */
  expanded: boolean;
  /**
   * Whether the drawer is nested within a parent drawer.
   */
  nested: boolean;
  /**
   * Whether the drawer has nested drawers open.
   */
  nestedDrawerOpen: boolean;
  /**
   * Whether a nested drawer is currently being swiped.
   */
  nestedDrawerSwiping: boolean;
  /**
   * The swipe direction used to dismiss the drawer.
   */
  swipeDirection: DrawerSwipeDirection;
  /**
   * Whether the drawer is being swiped.
   */
  swiping: boolean;
}

export namespace DrawerPopup {
  export type Props = DrawerPopupProps;
  export type State = DrawerPopupState;
}
