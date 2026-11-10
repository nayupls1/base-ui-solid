import { type Accessor } from 'solid-js';
import type { InteractionType } from 'base-ui-solidjs-utils/useEnhancedClickHandler';
import { useEnhancedClickHandler } from 'base-ui-solidjs-utils/useEnhancedClickHandler';
import { platform } from 'base-ui-solidjs-utils/platform';
import { createSyncSignal } from 'base-ui-solidjs-utils/createSyncSignal';
import { useValueChanged } from '../../../internals/useValueChanged';

/**
 * Returns trigger props that record how the popup was opened.
 */
export function useOpenMethodTriggerProps(
  open: boolean | (() => boolean),
  setOpenMethod: (interactionType: InteractionType | null) => void,
) {
  const handleTriggerClick = (_: MouseEvent | PointerEvent, interactionType: InteractionType) => {
    const isOpen = typeof open === 'function' ? open() : open;

    if (!isOpen) {
      setOpenMethod(
        interactionType ||
          // On iOS Safari, the hitslop around touch targets means tapping outside an element's
          // bounds does not fire `pointerdown` but does fire `mousedown`.
          (platform.os.ios ? 'touch' : ''),
      );
    }
  };

  const { onClick, onPointerDown } = useEnhancedClickHandler(handleTriggerClick);

  return {
    onClick,
    onPointerDown,
  };
}

/**
 * Determines the interaction type (keyboard, mouse, touch, etc.) that opened the component.
 *
 * @param open The open state of the component.
 */
export function useOpenInteractionType(open: Accessor<boolean>) {
  const [openMethod, setOpenMethod] = createSyncSignal<InteractionType | null>(null);

  const triggerProps = useOpenMethodTriggerProps(open, (value) => {
    setOpenMethod(value);
  });

  useValueChanged(open, (previousOpen) => {
    if (previousOpen && !open()) {
      setOpenMethod(null);
    }
  });

  return {
    openMethod,
    triggerProps,
  };
}
