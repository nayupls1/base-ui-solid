import { createContext, useContext } from 'solid-js';

export const DialogPortalContext = createContext<boolean | null>(null);

export function useDialogPortalContext() {
  const value = useContext(DialogPortalContext);
  if (value == null) {
    throw new Error('Base UI: <Dialog.Portal> is missing.');
  }
  return value;
}
