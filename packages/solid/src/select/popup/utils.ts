import type { JSX } from '@solidjs/web';

/** Restores inline styles saved with camelCase keys (as `element.style` accepts them). */
export function clearStyles(element: HTMLElement | null, originalStyles: Record<string, string>) {
  if (element) {
    Object.assign(element.style, originalStyles);
  }
}

export const LIST_FUNCTIONAL_STYLES: JSX.CSSProperties = {
  position: 'relative',
  'max-height': '100%',
  'overflow-x': 'hidden',
  'overflow-y': 'auto',
};
