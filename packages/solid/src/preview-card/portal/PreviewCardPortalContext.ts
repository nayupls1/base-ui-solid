import { createContext, useContext } from 'solid-js';

export const PreviewCardPortalContext = createContext<boolean | null>(null);

export function usePreviewCardPortalContext() {
  const value = useContext(PreviewCardPortalContext);
  if (value == null) {
    throw new Error('Base UI: <PreviewCard.Portal> is missing.');
  }
  return value ?? undefined;
}
