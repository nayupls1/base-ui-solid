import { createEffect } from 'solid-js';
import { addEventListener } from '@base-ui-solid/utils/addEventListener';
import { platform } from '@base-ui-solid/utils/platform';
import { mergeCleanups } from '@base-ui-solid/utils/mergeCleanups';
import { ownerDocument } from '@base-ui-solid/utils/owner';
import { useTimeout } from '@base-ui-solid/utils/useTimeout';
import { activeElement, contains, getTarget } from '@base-ui-solid/utils/shadowDom';
import { getWindow, isElement, isHTMLElement } from '@floating-ui/utils/dom';
import type { ElementProps, PopupInteractionStore } from '../types';
import { createAttribute } from '../createAttribute';
import { isTargetInsideEnabledTrigger, isTypeableElement, matchesFocusVisible } from '../element';
import { createChangeEventDetails } from '../../../internals/createBaseUIEventDetails';
import { REASONS } from '../../../internals/reasons';
import type { FloatingUIOpenChangeDetails } from '../../../internals/types';

const isMacSafari = platform.os.mac && platform.engine.webkit;

export interface UseFocusProps {
  /**
   * Whether the Hook is enabled, including all internal Effects and event
   * handlers.
   * @default true
   */
  enabled?: boolean | undefined;
  /**
   * Waits for the specified time before opening.
   * @default undefined
   */
  delay?: number | undefined;
}

/**
 * Opens the floating element while the reference element has focus, like CSS
 * `:focus`. Props are read lazily, so they can be getters.
 * @see https://floating-ui.com/docs/useFocus
 */
export function useFocus(store: PopupInteractionStore, props: UseFocusProps = {}): ElementProps {
  const storeContext = store.context;
  const { events } = storeContext;
  const enabled = () => props.enabled ?? true;

  let blockFocus = false;
  let blockedReference: Element | null = null;
  let keyboardModality = true;

  const timeout = useTimeout();

  createEffect(enabled, (isEnabled) => {
    const domReference = store.select('anchorElement');

    if (!isEnabled) {
      return undefined;
    }

    const win = getWindow(domReference);

    // If the reference was focused and the user left the tab/window, and the
    // floating element was not open, the focus should be blocked when they
    // return to the tab/window.
    function onBlur() {
      const currentDomReference = store.select('anchorElement');
      if (
        !store.select('open') &&
        isHTMLElement(currentDomReference) &&
        currentDomReference === activeElement(ownerDocument(currentDomReference))
      ) {
        blockFocus = true;
        blockedReference = currentDomReference;
      }
    }

    function onKeyDown() {
      keyboardModality = true;
    }

    function onPointerDown() {
      keyboardModality = false;
    }

    return mergeCleanups(
      addEventListener(win, 'blur', onBlur),
      isMacSafari && addEventListener(win, 'keydown', onKeyDown, true),
      isMacSafari && addEventListener(win, 'pointerdown', onPointerDown, true),
    );
  });

  createEffect(enabled, (isEnabled) => {
    if (!isEnabled) {
      return undefined;
    }

    function onOpenChangeLocal(details: FloatingUIOpenChangeDetails) {
      if (details.reason === REASONS.triggerPress || details.reason === REASONS.escapeKey) {
        const referenceElement = store.select('anchorElement');
        if (isElement(referenceElement)) {
          blockedReference = referenceElement;
          blockFocus = true;
        }
      }
    }

    events.on('openchange', onOpenChangeLocal);
    return () => {
      events.off('openchange', onOpenChangeLocal);
    };
  });

  function resetBlockedFocus() {
    blockFocus = false;
    blockedReference = null;
  }

  const reference: ElementProps['reference'] = {
    onMouseLeave() {
      resetBlockedFocus();
    },
    onFocus(event: FocusEvent) {
      const focusTarget = event.currentTarget as Element;

      if (blockFocus) {
        if (blockedReference === focusTarget) {
          return;
        }

        resetBlockedFocus();
      }

      const target = getTarget(event);

      if (isElement(target)) {
        // Safari fails to match `:focus-visible` if focus was initially outside the document.
        if (isMacSafari && !event.relatedTarget) {
          if (!keyboardModality && !isTypeableElement(target)) {
            return;
          }
        } else if (!matchesFocusVisible(target)) {
          return;
        }
      }

      const movedFromOtherEnabledTrigger = isTargetInsideEnabledTrigger(
        event.relatedTarget,
        store.context.triggerElements,
      );

      const currentTarget = event.currentTarget as HTMLElement;
      const delay = props.delay;

      if ((store.select('open') && movedFromOtherEnabledTrigger) || !delay) {
        store.setOpen(true, createChangeEventDetails(REASONS.triggerFocus, event, currentTarget));
        return;
      }

      timeout.start(delay, () => {
        if (blockFocus) {
          return;
        }

        store.setOpen(true, createChangeEventDetails(REASONS.triggerFocus, event, currentTarget));
      });
    },
    onBlur(event: FocusEvent) {
      resetBlockedFocus();

      const relatedTarget = event.relatedTarget;

      // Hit the non-modal focus management portal guard. Focus will be
      // moved into the floating element immediately after.
      const movedToFocusGuard =
        isElement(relatedTarget) &&
        relatedTarget.hasAttribute(createAttribute('focus-guard')) &&
        relatedTarget.getAttribute('data-type') === 'outside';

      // Wait for the window blur listener to fire.
      timeout.start(0, () => {
        const domReference = store.select('anchorElement');
        const activeEl = activeElement(ownerDocument(domReference));

        // Focus left the page, keep it open.
        if (!relatedTarget && activeEl === domReference) {
          return;
        }

        // When focusing the reference element (e.g. regular click), then
        // clicking into the floating element, prevent it from hiding.
        if (
          contains(storeContext.positioning?.refs.floating.current, activeEl) ||
          contains(domReference, activeEl) ||
          movedToFocusGuard
        ) {
          return;
        }

        // If focus is moving to another trigger of the same popup, don't close.
        const nextFocusedElement = relatedTarget ?? activeEl;
        if (isTargetInsideEnabledTrigger(nextFocusedElement, store.context.triggerElements)) {
          return;
        }

        store.setOpen(false, createChangeEventDetails(REASONS.triggerFocus, event));
      });
    },
  };

  return {
    get reference() {
      return enabled() ? reference : undefined;
    },
    get trigger() {
      return enabled() ? reference : undefined;
    },
  };
}
