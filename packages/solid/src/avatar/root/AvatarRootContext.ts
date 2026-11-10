import { createContext, useContext } from 'solid-js';
import type { ImageLoadingStatus } from './AvatarRoot';

type SetStateAction<T> = T | ((prev: T) => T);

/** Reactive values are getters. */
export interface AvatarRootContext {
  readonly imageLoadingStatus: ImageLoadingStatus;
  setImageLoadingStatus: (value: SetStateAction<ImageLoadingStatus>) => void;
}

export const AvatarRootContext = createContext<AvatarRootContext | null>(null);

export function useAvatarRootContext() {
  const context = useContext(AvatarRootContext);
  if (context == null) {
    throw new Error(
      'Base UI: AvatarRootContext is missing. Avatar parts must be placed within <Avatar.Root>.',
    );
  }
  return context;
}
