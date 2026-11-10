import { createEffect } from 'solid-js';
import { isElement, isHTMLElement } from '@floating-ui/utils/dom';
import { ownerDocument } from 'base-ui-solidjs-utils/owner';
import { warn } from 'base-ui-solidjs-utils/warn';
import { activeElement, contains, getTarget } from 'base-ui-solidjs-utils/shadowDom';
import { isTypeableElement } from '../../utils/popups/element';
import { useFilterDropdownRootContext } from '../../filter-dropdown/root/FilterDropdownRootContext';
import { refocusOwner, isRefocusingOwner } from '../../filter-dropdown/utils/refocusOwner';
import type { MenuRoot } from '../root/MenuRoot';
import { isCrossOrientationCloseKey } from '../../utils/popups/interactions/useListNavigation';
import { useDirection } from '../../internals/direction-context/DirectionContext';
import type { HTMLProps } from '../../internals/types';

/**
 * Popup interactions for a filterable menu: the input keeps real focus while the pointer moves
 * over the popup. `orientation` is an accessor.
 */
export function useMenuFilterPopup(orientation: () => MenuRoot.Orientation): HTMLProps {
  const context = useFilterDropdownRootContext();
  const direction = useDirection();
  const { focusOwnerRef } = context;

  // Focus that entered a nested popup by keyboard or click stays there while the
  // pointer crosses the parent popup. Returning to a submenu trigger restores focus to the
  // parent input. Focus that merely followed the pointer in follows it back out.
  let nestedFocus: Element | null = null;
  // A tap fires compatibility mouse events, which must not focus the input and raise the
  // on-screen keyboard.
  let pointerType = 'mouse';

  function trackPointerType(event: PointerEvent) {
    pointerType = event.pointerType || 'mouse';
  }

  if (process.env.NODE_ENV !== 'production') {
    createEffect(
      () => context.open,
      (open) => {
        if (open && focusOwnerRef.current === null) {
          // Wait for the popup's content to attach its input.
          queueMicrotask(() => {
            if (focusOwnerRef.current === null) {
              warn(
                'A filterable menu opened without a <Menu.Input>. Render the input inside ' +
                  '<Menu.Popup>, or drop <Menu.FilterProvider> for a menu that does not filter.',
              );
            }
          });
        }
      },
    );
  }

  function restoreInputFocus(event: MouseEvent, enteredTrigger: boolean) {
    const focusOwner = focusOwnerRef.current;
    const currentTarget = event.currentTarget as HTMLElement;
    if (!context.open || !focusOwner) {
      return;
    }

    const activeEl = activeElement(ownerDocument(currentTarget));
    if (activeEl === focusOwner || contains(currentTarget, activeEl)) {
      return;
    }

    // Nested popups are portalled, so their events don't bubble through this popup's DOM; the
    // composed path only contains this popup when the pointer is really over it, and a closing
    // popup must not re-capture focus during its exit transition.
    let submenuTrigger: HTMLElement | null = null;
    const nearestPopup = event.composedPath().find((node) => {
      if (!isHTMLElement(node)) {
        return false;
      }
      if (node.getAttribute('role') === 'dialog' || node.hasAttribute('data-rootownerid')) {
        return true;
      }
      if (node.hasAttribute('aria-haspopup')) {
        submenuTrigger = node;
      }
      return false;
    });
    if (nearestPopup !== currentTarget) {
      return;
    }

    // A nested popup that took focus keeps it while the pointer moves over the parent popup.
    // Entering a submenu trigger returns focus to the parent's input.
    if (nestedFocus && !(enteredTrigger && submenuTrigger)) {
      return;
    }
    if (
      enteredTrigger &&
      submenuTrigger &&
      isElement(event.relatedTarget) &&
      contains(submenuTrigger, event.relatedTarget as Element)
    ) {
      return;
    }
    refocusOwner(focusOwner);
  }

  return {
    // The input owns virtual focus.
    'aria-activedescendant': undefined,
    // Not valid on a dialog; the list's implicit orientation is already vertical.
    'aria-orientation': undefined,
    onMouseDown(event: MouseEvent) {
      if (getTarget(event) === event.currentTarget) {
        // Keep focus on the virtual focus owner when the popup's own background is pressed.
        event.preventDefault();
      }
    },
    onPointerDown: trackPointerType,
    // `pointerover` precedes the compatibility `mouseover`, so a mouse entering right after a tap
    // is recognized before the handoff below.
    onPointerOver: trackPointerType,
    onPointerMove: trackPointerType,
    onMouseMove(event: MouseEvent) {
      if (pointerType === 'mouse') {
        restoreInputFocus(event, false);
      }
    },
    onMouseOver(event: MouseEvent) {
      if (pointerType === 'mouse' && nestedFocus) {
        restoreInputFocus(event, true);
      }
    },
    onFocus(event: FocusEvent) {
      // `focusin` bubbles, so this also sees the owner itself being focused.
      const target = getTarget(event);
      const currentTarget = event.currentTarget as HTMLElement;

      if (target === focusOwnerRef.current) {
        nestedFocus = null;
      } else if (
        isHTMLElement(target) &&
        !contains(currentTarget, target as Element) &&
        !isRefocusingOwner()
      ) {
        nestedFocus = target as Element;
      }

      // Focus that lands on the popup itself, the focus manager's fallback target, moves on to
      // the input, which owns focus while the menu filters.
      if (context.open && target === currentTarget) {
        focusOwnerRef.current?.focus({ preventScroll: true });
      }
    },
    onKeyDown(event: KeyboardEvent) {
      const target = getTarget(event);
      if (target === focusOwnerRef.current || isTypeableElement(target)) {
        return;
      }

      if (isCrossOrientationCloseKey(event.key, orientation(), direction() === 'rtl', false)) {
        focusOwnerRef.current?.focus({ preventScroll: true });
        event.stopPropagation();
      }
    },
  } as any;
}
