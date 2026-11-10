import { createContext, useContext } from 'solid-js';

export const PopoverPortalContext = createContext<boolean | null>(null);

export function usePopoverPortalContext() {
  const value = useContext(PopoverPortalContext);
  if (value == null) {
    throw new Error('Base UI: <Popover.Portal> is missing.');
  }
  return value;
}
