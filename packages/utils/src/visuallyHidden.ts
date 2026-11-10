import type { JSX } from '@solidjs/web';

const visuallyHiddenBase: JSX.CSSProperties = {
  'clip-path': 'inset(50%)',
  overflow: 'hidden',
  'white-space': 'nowrap',
  border: '0',
  padding: '0',
  width: '1px',
  height: '1px',
  margin: '-1px',
};

// Just above the viewport: many 1px fixed elements inside it can make Chrome drop frames.
export const visuallyHidden: JSX.CSSProperties = {
  ...visuallyHiddenBase,
  position: 'fixed',
  margin: '0',
  top: '-1px',
  left: '0',
};

export const visuallyHiddenInput: JSX.CSSProperties = {
  ...visuallyHiddenBase,
  position: 'absolute',
};

// Unnamed hidden inputs: zero size so Chrome doesn't give each one a compositor layer. On screen
// so the native validation message shows once they grow to 1px on `invalid`.
export const visuallyHiddenInputPinned: JSX.CSSProperties = {
  ...visuallyHidden,
  width: '0',
  height: '0',
  top: '0',
};
