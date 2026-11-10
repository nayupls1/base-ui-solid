import { createContext, useContext } from 'solid-js';

export const ComboboxPortalContext = createContext<boolean | null>(null);

export function useComboboxPortalContext() {
  const context = useContext(ComboboxPortalContext);
  if (context == null) {
    throw new Error('Base UI: <Combobox.Portal> is missing.');
  }
  return context ?? undefined;
}
