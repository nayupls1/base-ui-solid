import { createContext, useContext } from 'solid-js';
import type { JSX } from '@solidjs/web';
import type { Side, Align } from '../../internals/useAnchorPositioning';

/** Reactive values are getters. */
export interface PreviewCardPositionerContext {
  readonly side: Side;
  readonly align: Align;
  arrowRef: (element: Element | null) => void;
  readonly arrowUncentered: boolean;
  readonly arrowStyles: JSX.CSSProperties;
}

export const PreviewCardPositionerContext = createContext<PreviewCardPositionerContext | null>(null);

export function usePreviewCardPositionerContext() {
  const context = useContext(PreviewCardPositionerContext);
  if (!context) {
    throw new Error(
      'Base UI: PreviewCardPositionerContext is missing. PreviewCardPositioner parts must be placed within <PreviewCard.Positioner>.',
    );
  }
  return context;
}
