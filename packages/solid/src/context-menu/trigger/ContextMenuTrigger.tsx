import { createEffect, createMemo, omit, onCleanup } from 'solid-js';
import { addEventListener } from 'base-ui-solidjs-utils/addEventListener';
import { ownerDocument } from 'base-ui-solidjs-utils/owner';
import { useTimeout } from 'base-ui-solidjs-utils/useTimeout';
import { contains, getTarget } from 'base-ui-solidjs-utils/shadowDom';
import { createSyncSignal } from 'base-ui-solidjs-utils/createSyncSignal';
import { stopEvent } from '../../utils/popups/event';
import type { BaseUIComponentProps } from '../../internals/types';
import { useContextMenuRootContext } from '../root/ContextMenuRootContext';
import { useMenuRootContext } from '../../menu/root/MenuRootContext';
import { useRenderElement } from '../../internals/useRenderElement';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { pressableTriggerOpenStateMapping } from '../../utils/popups/popupStateMapping';
import { REASONS } from '../../internals/reasons';
import { findRootOwnerId } from '../../menu/utils/findRootOwnerId';
import { ownedProps } from '../../internals/ownedProps';

const LONG_PRESS_DELAY = 500;

/**
 * An area that opens the menu on right click or long press.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Context Menu](https://base-ui.com/react/components/context-menu)
 */
export function ContextMenuTrigger(componentProps: ContextMenuTrigger.Props) {
  componentProps = ownedProps(componentProps);
  const elementProps = omit(componentProps, 'render', 'class', 'style', 'children', 'ref');

  const {
    setAnchor,
    actionsRef,
    internalBackdropRef,
    backdropRef,
    positionerRef,
    allowMouseUpTriggerRef,
    initialCursorPointRef,
    rootId,
  } = useContextMenuRootContext(false);
  const { store } = useMenuRootContext(false);
  const open = store.useState('open');
  const disabled = store.useState('disabled');

  const [trigger, setTrigger] = createSyncSignal<HTMLDivElement | null>(null);
  let touchPosition: { x: number; y: number } | null = null;
  const longPressTimeout = useTimeout();
  const allowMouseUpTimeout = useTimeout();
  let allowMouseUp = false;
  let mouseUpAbortController: AbortController | null = null;

  function handleLongPress(x: number, y: number, event: MouseEvent | TouchEvent) {
    const isTouchEvent = event.type.startsWith('touch');

    initialCursorPointRef.current = { x, y };

    setAnchor({
      getBoundingClientRect() {
        return DOMRect.fromRect({
          width: isTouchEvent ? 10 : 0,
          height: isTouchEvent ? 10 : 0,
          x,
          y,
        });
      },
    });

    allowMouseUp = false;
    actionsRef.current?.setOpen(true, createChangeEventDetails(REASONS.triggerPress, event));

    allowMouseUpTimeout.start(LONG_PRESS_DELAY, () => {
      allowMouseUp = true;
    });
  }

  function handleContextMenu(event: MouseEvent) {
    if (disabled()) {
      return;
    }

    allowMouseUpTriggerRef.current = true;
    stopEvent(event);
    handleLongPress(event.clientX, event.clientY, event);
    const doc = ownerDocument(trigger());

    // Abort a listener from a previous trigger that never saw its mouseup, and scope this
    // one to a fresh controller so it's removed on unmount if the mouseup never arrives.
    mouseUpAbortController?.abort();
    const controller = new AbortController();
    mouseUpAbortController = controller;

    doc.addEventListener(
      'mouseup',
      (mouseEvent) => {
        allowMouseUpTriggerRef.current = false;

        if (!allowMouseUp) {
          return;
        }

        allowMouseUpTimeout.clear();
        allowMouseUp = false;

        const mouseUpTarget = getTarget(mouseEvent) as Element | null;

        if (contains(positionerRef.current, mouseUpTarget)) {
          return;
        }

        if (rootId && mouseUpTarget && findRootOwnerId(mouseUpTarget) === rootId) {
          return;
        }

        actionsRef.current?.setOpen(
          false,
          createChangeEventDetails(REASONS.cancelOpen, mouseEvent),
        );
      },
      { once: true, signal: controller.signal },
    );
  }

  function cancelLongPress() {
    longPressTimeout.clear();
    touchPosition = null;
  }

  function handleTouchStart(event: TouchEvent) {
    if (disabled()) {
      cancelLongPress();
      return;
    }

    allowMouseUpTriggerRef.current = false;
    if (event.touches.length !== 1) {
      cancelLongPress();
      return;
    }

    event.stopPropagation();
    const touch = event.touches[0];
    const position = { x: touch.clientX, y: touch.clientY };
    touchPosition = position;
    longPressTimeout.start(LONG_PRESS_DELAY, () => {
      handleLongPress(position.x, position.y, event);
    });
  }

  function handleTouchMove(event: TouchEvent) {
    if (event.touches.length !== 1) {
      cancelLongPress();
      return;
    }

    if (longPressTimeout.isStarted() && touchPosition) {
      const touch = event.touches[0];
      const moveThreshold = 10;

      const deltaX = Math.abs(touch.clientX - touchPosition.x);
      const deltaY = Math.abs(touch.clientY - touchPosition.y);

      if (deltaX > moveThreshold || deltaY > moveThreshold) {
        cancelLongPress();
      }
    }
  }

  onCleanup(() => {
    // Abort a pending mouseup listener if the trigger unmounts before it fires.
    mouseUpAbortController?.abort();
  });

  createEffect(
    () => [trigger(), disabled()] as const,
    ([triggerElement, isDisabled]) => {
      function handleDocumentContextMenu(event: MouseEvent) {
        if (isDisabled) {
          return;
        }

        const target = getTarget(event);
        const targetElement = target as HTMLElement | null;
        if (
          contains(triggerElement, targetElement) ||
          contains(internalBackdropRef.current, targetElement) ||
          contains(backdropRef.current, targetElement)
        ) {
          event.preventDefault();
        }
      }

      const doc = ownerDocument(triggerElement);
      return addEventListener(doc, 'contextmenu', handleDocumentContextMenu);
    },
  );

  const state = createMemo<ContextMenuTriggerState>(() => ({
    open: open(),
  }));

  return useRenderElement('div', componentProps, {
    state,
    ref: (el: HTMLDivElement | null) => {
      setTrigger(el);
    },
    props: [
      {
        onContextMenu: handleContextMenu,
        onTouchStart: handleTouchStart,
        onTouchMove: handleTouchMove,
        onTouchEnd: cancelLongPress,
        onTouchCancel: cancelLongPress,
        style: {
          '-webkit-touch-callout': 'none',
        },
      },
      elementProps,
    ],
    stateAttributesMapping: pressableTriggerOpenStateMapping,
  });
}

export interface ContextMenuTriggerState {
  /**
   * Whether the context menu is currently open.
   */
  open: boolean;
}

export interface ContextMenuTriggerProps extends BaseUIComponentProps<
  'div',
  ContextMenuTriggerState
> {}

export namespace ContextMenuTrigger {
  export type State = ContextMenuTriggerState;
  export type Props = ContextMenuTriggerProps;
}
