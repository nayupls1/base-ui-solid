import { createEffect, onCleanup } from 'solid-js';
import { addEventListener } from '@base-ui-solid/utils/addEventListener';
import { mergeCleanups } from '@base-ui-solid/utils/mergeCleanups';
import { useTimeout } from '@base-ui-solid/utils/useTimeout';
import { isElement } from '@floating-ui/utils/dom';
import { createChangeEventDetails } from '../../../internals/createBaseUIEventDetails';
import { REASONS } from '../../../internals/reasons';
import { useFloatingParentNodeId, useFloatingTree } from '../tree/FloatingTree';
import type { PopupInteractionStore } from '../types';
import { getNodeChildren } from '../tree/nodes';
import { getHoverIntent } from './hoverIntent';

export type UseHoverPopupInteractionProps = {
  /**
   * Whether the Hook is enabled, including all internal Effects and event
   * handlers.
   * @default true
   */
  enabled?: boolean | undefined;
  /**
   * Waits for the specified time when the event listener runs before changing
   * the `open` state.
   * @default 0
   */
  closeDelay?: number | (() => number) | undefined;
  /**
   * Tree node id override for floating elements that participate in the tree
   * without a `PopupPositioningContext`, such as inline nested navigation menus.
   */
  nodeId?: string | undefined;
};

/**
 * Provides hover interactions that should be attached to the popup's positioner element.
 * Parameters are read lazily, so they can be getters.
 */
export function useHoverPopupInteraction(
  store: PopupInteractionStore,
  parameters: UseHoverPopupInteractionProps = {},
): void {
  const enabled = () => parameters.enabled ?? true;

  const open = store.useState('open');
  const positionerElement = store.useState('positionerElement');
  const anchorElement = store.useState('anchorElement');

  const tree = useFloatingTree();
  const parentId = useFloatingParentNodeId();
  const intent = getHoverIntent(store);

  const childClosedTimeout = useTimeout();

  createEffect(open, (isOpen) => {
    if (!isOpen) {
      intent.reset();
    }
  });

  onCleanup(() => {
    intent.cancelPendingOpen();
    intent.restoreOutsidePointerEvents();
  });

  createEffect(
    () => [enabled(), open(), anchorElement(), positionerElement()] as const,
    ([isEnabled, isOpen, anchor, positioner]) => {
      if (!isEnabled) {
        return undefined;
      }

      if (
        isOpen &&
        isElement(anchor) &&
        positioner &&
        intent.blockOutsidePointerEventsForPopup(
          anchor as HTMLElement | SVGSVGElement,
          positioner,
          tree,
          parentId,
        )
      ) {
        return intent.restoreOutsidePointerEvents;
      }

      return undefined;
    },
  );

  createEffect(
    () => [enabled(), positionerElement()] as const,
    ([isEnabled, floating]) => {
      if (!isEnabled) {
        return undefined;
      }

      function hasParentChildren() {
        return !!(tree && parentId && getNodeChildren(tree.nodesRef.current, parentId).length > 0);
      }

      function onFloatingMouseEnter() {
        intent.onPopupMouseEnter();
        childClosedTimeout.clear();
        tree?.events.off('floating.closed', onNodeClosed);
      }

      function onFloatingMouseLeave(event: MouseEvent) {
        if (hasParentChildren() && tree) {
          tree.events.on('floating.closed', onNodeClosed);
          return;
        }

        intent.onPopupMouseLeave(event, {
          closeDelay: parameters.closeDelay ?? 0,
          tree,
          nodeId: parameters.nodeId,
        });
      }

      function onPopupPointerDown(event: PointerEvent) {
        intent.onPopupPointerDown(event);
      }

      function onNodeClosed(event: MouseEvent) {
        if (!tree || !parentId || hasParentChildren()) {
          return;
        }
        // Allow the mouseenter event to fire in case child was closed because mouse moved into parent.
        childClosedTimeout.start(0, () => {
          tree.events.off('floating.closed', onNodeClosed);
          store.setOpen(false, createChangeEventDetails(REASONS.triggerHover, event));
          tree.events.emit('floating.closed', event);
        });
      }

      return mergeCleanups(
        floating && addEventListener(floating, 'mouseenter', onFloatingMouseEnter),
        floating && addEventListener(floating, 'mouseleave', onFloatingMouseLeave),
        floating && addEventListener(floating, 'pointerdown', onPopupPointerDown, true),
        () => {
          tree?.events.off('floating.closed', onNodeClosed);
        },
      );
    },
  );
}
