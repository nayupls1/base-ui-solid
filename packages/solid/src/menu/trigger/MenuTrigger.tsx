import type { JSX } from '@solidjs/web';
import { createEffect, createMemo, createSignal, omit, Show, untrack, type Accessor } from 'solid-js';
import { createSyncSignal } from '@base-ui-solid/utils/createSyncSignal';
import { useTimeout } from '@base-ui-solid/utils/useTimeout';
import { ownerDocument } from '@base-ui-solid/utils/owner';
import { EMPTY_OBJECT } from '@base-ui-solid/utils/empty';
import { contains, getTarget } from '@base-ui-solid/utils/shadowDom';
import { safePolygon } from '../../utils/popups/interactions/safePolygon';
import { useClick } from '../../utils/popups/interactions/useClick';
import {
  useFloatingTree,
  useFloatingNodeId,
  useFloatingParentNodeId,
} from '../../utils/popups/tree/FloatingTree';
import { useFocus } from '../../utils/popups/interactions/useFocus';
import { useHoverTriggerInteraction } from '../../utils/popups/interactions/useHoverTriggerInteraction';
import { FloatingTreeStore } from '../../utils/popups/tree/FloatingTreeStore';
import { useMenuRootContext } from '../root/MenuRootContext';
import { pressableTriggerOpenStateMapping } from '../../utils/popups/popupStateMapping';
import { useRenderElement } from '../../internals/useRenderElement';
import type { RefInput } from '../../internals/useRenderElement';
import type { BaseUIComponentProps, NativeButtonProps } from '../../internals/types';
import { useButton } from '../../internals/use-button/useButton';
import { isMouseWithinBounds } from '../../utils/getPseudoElementBounds';
import { CompositeItem } from '../../internals/composite/item/CompositeItem';
import { useCompositeRootContext } from '../../internals/composite/root/CompositeRootContext';
import { findRootOwnerId } from '../utils/findRootOwnerId';
import { usePopupHandleStore } from '../../utils/popups/usePopupHandleStore';
import { useTriggerDataForwarding } from '../../utils/popups/popupStoreUtils';
import { useTriggerFocusGuards } from '../../utils/popups/useTriggerFocusGuards';
import { useBaseUiId } from '../../internals/useBaseUiId';
import { REASONS } from '../../internals/reasons';
import { useMixedToggleClickHandler } from './useMixedToggleClickHandler';
import type { MenuHandle } from '../store/MenuHandle';
import { useMenubarContext } from '../../menubar/MenubarContext';
import type { MenuParent } from '../root/MenuRoot';
import { PATIENT_CLICK_THRESHOLD } from '../../internals/constants';
import { FocusGuard } from '../../utils/popups/focus/FocusGuard';
import { mergeProps } from '../../merge-props';
import { ownedProps } from '../../internals/ownedProps';

/**
 * A button that opens the menu.
 * Renders a `<button>` element.
 *
 * Documentation: [Base UI Menu](https://base-ui.com/react/components/menu)
 */
export function MenuTrigger<Payload = unknown>(componentProps: MenuTrigger.Props<Payload>) {
  componentProps = ownedProps(componentProps);
  const elementProps = omit(
    componentProps,
    'render',
    'class',
    'style',
    'disabled',
    'nativeButton',
    'id',
    'openOnHover',
    'delay',
    'closeDelay',
    'handle',
    'payload',
    'children',
    'ref',
  );
  const delay = () => componentProps.delay ?? 100;
  const closeDelay = () => componentProps.closeDelay ?? 0;

  const rootContext = useMenuRootContext(true);
  const handleStore = usePopupHandleStore(untrack(() => componentProps.handle) as any);
  const store = (handleStore ?? rootContext?.store) as NonNullable<typeof rootContext>['store'];
  if (!store) {
    throw new Error(
      'Base UI: <Menu.Trigger> must be either used within a <Menu.Root> component or provided with a handle.',
    );
  }

  const thisTriggerId = useBaseUiId(() => componentProps.id);

  const isTriggerActive = store.useState('isTriggerActive', thisTriggerId);
  const isOpenedByThisTrigger = store.useState('isOpenedByTrigger', thisTriggerId);
  const controlsId = store.useState('triggerControlsId', thisTriggerId);

  const [triggerElement, setTriggerElement] = createSyncSignal<HTMLElement | null>(null);
  const triggerElementRef = {
    get current() {
      return triggerElement();
    },
  };

  const parent = useMenuParent();
  const compositeRootContext = useCompositeRootContext(true);
  const floatingTreeRootFromContext = useFloatingTree();

  const floatingTreeRoot: FloatingTreeStore =
    (floatingTreeRootFromContext as FloatingTreeStore | null) ?? new FloatingTreeStore();

  const floatingNodeId = useFloatingNodeId(floatingTreeRoot);
  const floatingParentNodeId = useFloatingParentNodeId();

  const { registerTrigger, isMountedByThisTrigger } = useTriggerDataForwarding(
    thisTriggerId,
    triggerElement as any,
    store as any,
    () => ({
      payload: componentProps.payload,
      closeDelay: closeDelay(),
      parent,
      floatingTreeRoot,
      floatingNodeId,
      floatingParentNodeId,
      keyboardEventRelay: (compositeRootContext as any)?.relayKeyboardEvent,
    }),
  );

  const isInMenubar = parent.type === 'menubar';

  const rootDisabled = store.useState('disabled');

  const disabled = () =>
    (componentProps.disabled ?? false) ||
    rootDisabled() ||
    (parent.type === 'menubar' && parent.context.disabled);

  const { getButtonProps, buttonRef } = useButton({
    get disabled() {
      return disabled();
    },
    get native() {
      return componentProps.nativeButton ?? true;
    },
  });

  createEffect(isOpenedByThisTrigger, (isOpened) => {
    if (!isOpened && parent.type === undefined) {
      store.context.allowMouseUpTriggerRef.current = false;
    }
  });

  let triggerRefElement: HTMLElement | null = null;
  const allowMouseUpTriggerTimeout = useTimeout();

  const handleDocumentMouseUp = (mouseEvent: MouseEvent) => {
    if (!triggerRefElement) {
      return;
    }

    allowMouseUpTriggerTimeout.clear();
    store.context.allowMouseUpTriggerRef.current = false;

    const mouseUpTarget = getTarget(mouseEvent) as Element | null;

    if (
      contains(triggerRefElement, mouseUpTarget) ||
      contains(store.select('positionerElement'), mouseUpTarget) ||
      mouseUpTarget === triggerRefElement
    ) {
      return;
    }

    if (mouseUpTarget != null && findRootOwnerId(mouseUpTarget) === store.select('rootId')) {
      return;
    }

    if (isMouseWithinBounds(mouseEvent, triggerRefElement)) {
      return;
    }

    floatingTreeRoot.events.emit('close', { domEvent: mouseEvent, reason: REASONS.cancelOpen });
  };

  createEffect(isOpenedByThisTrigger, (isOpened) => {
    const doc = ownerDocument(triggerRefElement);

    if (isOpened && store.select('lastOpenChangeReason') === REASONS.triggerHover) {
      doc.addEventListener('mouseup', handleDocumentMouseUp, { once: true });

      return () => {
        doc.removeEventListener('mouseup', handleDocumentMouseUp);
      };
    }

    return undefined;
  });

  const parentMenubarHasSubmenuOpen = () =>
    parent.type === 'menubar' && parent.context.hasSubmenuOpen;
  const openOnHover = () => componentProps.openOnHover ?? parentMenubarHasSubmenuOpen();

  const hoverProps = useHoverTriggerInteraction(store as any, {
    get enabled() {
      return (
        openOnHover() &&
        !disabled() &&
        (!isInMenubar || (parentMenubarHasSubmenuOpen() && !isMountedByThisTrigger()))
      );
    },
    handleClose: safePolygon({ blockPointerEvents: !isInMenubar }),
    mouseOnly: true,
    move: false,
    get restMs() {
      return parent.type === undefined ? delay() : undefined;
    },
    get delay() {
      return { close: closeDelay() };
    },
    triggerElement,
    externalTree: floatingTreeRoot,
    get isActiveTrigger() {
      return isTriggerActive();
    },
  } as any);

  // Whether to ignore clicks to open the menu.
  const stickIfOpen = useStickIfOpen(isOpenedByThisTrigger, () =>
    store.select('lastOpenChangeReason'),
  );

  const click = useClick(store as any, {
    get enabled() {
      return !disabled();
    },
    get event() {
      return isOpenedByThisTrigger() && isInMenubar ? 'click' : 'mousedown';
    },
    toggle: true,
    ignoreMouse: false,
    stickIfOpen: () => (parent.type === undefined ? stickIfOpen() : false),
  } as any);

  const focus = useFocus(store as any, {
    get enabled() {
      return !disabled() && parentMenubarHasSubmenuOpen();
    },
  });

  const mixedToggleHandlers = useMixedToggleClickHandler({
    get open() {
      return isOpenedByThisTrigger();
    },
    enabled: isInMenubar,
    mouseDownAction: 'open',
  });

  const rootTriggerProps = store.useState('triggerProps', isMountedByThisTrigger);
  // A filterable menu keeps real focus inside its popup and publishes what its trigger needs.
  const filterTriggerProps = store.useState('filterTriggerProps');

  const { handlePreFocusGuardFocus, handleFocusTargetFocus } = useTriggerFocusGuards(
    store as any,
    triggerElementRef,
  );

  const state = createMemo<MenuTriggerState>(() => ({
    disabled: disabled(),
    open: isOpenedByThisTrigger(),
  }));

  const ref = [
    (el: HTMLElement | null) => {
      triggerRefElement = el;
    },
    buttonRef,
    registerTrigger,
    (el: HTMLElement | null) => {
      setTriggerElement(el);
    },
  ];
  const props = [
    (merged: Record<string, any>) => mergeProps(merged, focus.reference, click.reference),
    hoverProps ?? EMPTY_OBJECT,
    (merged: Record<string, any>) => mergeProps(merged, rootTriggerProps()),
    {
      'aria-haspopup': 'menu' as const,
      get 'aria-controls'() {
        return controlsId();
      },
      get id() {
        return thisTriggerId();
      },
      onMouseDown: (event: MouseEvent) => {
        if (store.select('open')) {
          return;
        }

        // mousedown -> mouseup on menu item should not trigger it within 200ms.
        allowMouseUpTriggerTimeout.start(200, () => {
          store.context.allowMouseUpTriggerRef.current = true;
        });

        const doc = ownerDocument(event.currentTarget as Element);
        doc.addEventListener('mouseup', handleDocumentMouseUp, { once: true });
      },
    },
    (merged: Record<string, any>) => mergeProps(merged, filterTriggerProps()),
    isInMenubar ? { role: 'menuitem' } : EMPTY_OBJECT,
    isInMenubar ? mixedToggleHandlers : EMPTY_OBJECT,
    elementProps,
    getButtonProps,
  ];

  if (isInMenubar) {
    return (
      <CompositeItem
        tag="button"
        render={componentProps.render as any}
        class={componentProps.class as any}
        style={componentProps.style as any}
        state={state()}
        refs={ref as any}
        props={props as any}
        stateAttributesMapping={pressableTriggerOpenStateMapping as any}
      />
    );
  }

  const element = untrack(() =>
    useRenderElement('button', componentProps, {
      stateAttributesMapping: pressableTriggerOpenStateMapping,
      state,
      ref: ref as any,
      props: props as any,
    }),
  );

  return (
    <>
      <Show when={isOpenedByThisTrigger()}>
        <FocusGuard
          ref={(el: HTMLElement) => {
            store.context.beforeTriggerFocusGuardRef.current = el;
          }}
          onFocus={handlePreFocusGuardFocus}
        />
      </Show>
      {element}
      <Show when={isOpenedByThisTrigger()}>
        <FocusGuard
          ref={(el: HTMLElement) => {
            store.context.triggerFocusTargetRef.current = el;
          }}
          onFocus={handleFocusTargetFocus}
        />
      </Show>
    </>
  );
}

export interface MenuTriggerProps<Payload = unknown>
  extends NativeButtonProps, BaseUIComponentProps<'button', MenuTriggerState> {
  children?: JSX.Element;
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * A handle to associate the trigger with a menu.
   */
  handle?: MenuHandle<Payload> | undefined;
  /**
   * A payload to pass to the menu when it is opened.
   */
  payload?: Payload | undefined;
  /**
   * How long to wait before the menu may be opened on hover. Specified in milliseconds.
   *
   * Requires the `openOnHover` prop.
   * @default 100
   */
  delay?: number | undefined;
  /**
   * How long to wait before closing the menu that was opened on hover.
   * Specified in milliseconds.
   *
   * Requires the `openOnHover` prop.
   * @default 0
   */
  closeDelay?: number | undefined;
  /**
   * Whether the menu should also open when the trigger is hovered.
   */
  openOnHover?: boolean | undefined;
}

export interface MenuTriggerState {
  /**
   * Whether the menu is currently open and was opened by this trigger.
   */
  open: boolean;
  /**
   * Whether the trigger is disabled.
   */
  disabled: boolean;
}

export namespace MenuTrigger {
  export type Props<Payload = unknown> = MenuTriggerProps<Payload>;
  export type State = MenuTriggerState;
}


/**
 * Determines whether to ignore clicks after a hover-open.
 */
function useStickIfOpen(open: Accessor<boolean>, openReason: () => string | null) {
  const stickIfOpenTimeout = useTimeout();
  const [stickIfOpen, setStickIfOpen] = createSyncSignal(false);

  createEffect(open, (isOpen) => {
    const reason = untrack(openReason);
    if (isOpen && reason === REASONS.triggerHover) {
      // Only allow "patient" clicks to close the menu if it's open.
      // If they clicked within 500ms of the menu opening, keep it open.
      setStickIfOpen(true);
      stickIfOpenTimeout.start(PATIENT_CLICK_THRESHOLD, () => {
        setStickIfOpen(false);
      });
    } else if (!isOpen) {
      stickIfOpenTimeout.clear();
      setStickIfOpen(false);
    }
  });

  return stickIfOpen;
}

function useMenuParent(): MenuParent {
  const menubarContext = useMenubarContext(true);

  if (menubarContext) {
    return {
      type: 'menubar',
      context: menubarContext,
    };
  }

  return {
    type: undefined,
  };
}
