import { createContext, createEffect, useContext } from 'solid-js';
import { createSyncSignal } from 'base-ui-solidjs-utils/createSyncSignal';

interface ClosePartContextValue {
  register: () => () => void;
}

export const ClosePartContext = createContext<ClosePartContextValue | null>(null);

/**
 * Counts the close parts rendered in a popup.
 */
export function useClosePartCount() {
  const [closePartCount, setClosePartCount] = createSyncSignal(0);

  const register = () => {
    setClosePartCount((count) => count + 1);

    return () => {
      setClosePartCount((count) => Math.max(0, count - 1));
    };
  };

  return {
    context: { register },
    hasClosePart: () => closePartCount() > 0,
  };
}

/**
 * Registers a close part with the surrounding popup.
 */
export function useClosePartRegistration() {
  const context = useContext(ClosePartContext);

  createEffect(
    () => 0,
    () => context?.register(),
  );
}
