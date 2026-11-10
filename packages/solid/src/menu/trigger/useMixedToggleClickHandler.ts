import { untrack } from 'solid-js';
import { ownerDocument } from '@base-ui-solid/utils/owner';
import type { BaseUIEvent } from '../../internals/types';

/**
 * Returns `click` and `mousedown` handlers that fix the behavior of triggers of popups that are toggled by different events.
 * For example, a button that opens a popup on mousedown and closes it on click.
 * This hook prevents the popup from closing immediately after the mouse button is released.
 * Parameters are read lazily, so they can be getters.
 */
export function useMixedToggleClickHandler(params: UseMixedToggleClickHandlerParameters) {
  let ignoreClick = false;

  const handlers = {
    onMouseDown: (event: MouseEvent) => {
      const { enabled = true, mouseDownAction, open } = untrack(() => ({
        enabled: params.enabled,
        mouseDownAction: params.mouseDownAction,
        open: params.open,
      }));
      if (!enabled) {
        return;
      }
      if ((mouseDownAction === 'open' && !open) || (mouseDownAction === 'close' && open)) {
        ignoreClick = true;

        ownerDocument(event.currentTarget as Element).addEventListener(
          'click',
          () => {
            ignoreClick = false;
          },
          { once: true },
        );
      }
    },
    onClick: (event: BaseUIEvent<MouseEvent>) => {
      if (!untrack(() => params.enabled ?? true)) {
        return;
      }
      if (ignoreClick) {
        ignoreClick = false;
        event.preventBaseUIHandler();
      }
    },
  };

  return handlers;
}

export interface UseMixedToggleClickHandlerParameters {
  /**
   * Whether the mixed toggle click handler is enabled.
   * @default true
   */
  enabled?: boolean | undefined;
  /**
   * Determines what action is performed on mousedown.
   */
  mouseDownAction: 'open' | 'close';
  /**
   * The current open state of the popup.
   */
  open: boolean;
}

export interface UseMixedToggleClickHandlerState {}
