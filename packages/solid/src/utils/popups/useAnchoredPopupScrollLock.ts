import { createEffect, type Accessor } from 'solid-js';
import { ownerDocument } from 'base-ui-solidjs-utils/owner';
import { useScrollLock } from 'base-ui-solidjs-utils/useScrollLock';
import { createSyncSignal } from 'base-ui-solidjs-utils/createSyncSignal';

const VIEWPORT_WIDTH_TOLERANCE_PX = 20;

/**
 * Manages scroll lock for anchored popups. For non-touch opens, scroll lock is applied when
 * enabled. For touch opens, scroll lock is applied only when the positioner width is effectively
 * viewport-sized.
 */
export function useAnchoredPopupScrollLock(
  enabled: Accessor<boolean>,
  touchOpen: Accessor<boolean>,
  positionerElement: Accessor<HTMLElement | null>,
  referenceElement: Accessor<Element | null>,
) {
  const [touchOpenShouldLockScroll, setTouchOpenShouldLockScroll] = createSyncSignal(false);

  createEffect(
    () => [enabled(), touchOpen(), positionerElement()] as const,
    ([isEnabled, isTouchOpen, positioner]) => {
      if (!isEnabled || !isTouchOpen || positioner == null) {
        setTouchOpenShouldLockScroll(false);
        return;
      }

      const viewportWidth = ownerDocument(positioner).documentElement.clientWidth;
      const popupWidth = positioner.offsetWidth;

      setTouchOpenShouldLockScroll(
        viewportWidth > 0 &&
          popupWidth > 0 &&
          popupWidth >= viewportWidth - VIEWPORT_WIDTH_TOLERANCE_PX,
      );
    },
  );

  useScrollLock(
    () => enabled() && (!touchOpen() || touchOpenShouldLockScroll()),
    referenceElement,
  );
}
