import { createContext, useContext } from 'solid-js';

export type TextDirection = 'ltr' | 'rtl';

export type DirectionContext = {
  readonly direction: TextDirection;
};

export const DirectionContext = createContext<DirectionContext | null>(null);

/**
 * Returns an accessor of the current text direction.
 */
export function useDirection(): () => TextDirection {
  const context = useContext(DirectionContext);
  return () => context?.direction ?? 'ltr';
}
