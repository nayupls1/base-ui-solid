import { flush } from 'solid-js';

/**
 * Native checkboxes toggle their `checked` property before Base UI decides whether to accept the
 * change. When the change is rejected (controlled or canceled), restore the DOM to match the state.
 */
export function syncCheckedState(input: HTMLInputElement, getChecked: () => boolean) {
  queueMicrotask(() => {
    flush();
    const checked = getChecked();
    if (input.checked !== checked) {
      input.checked = checked;
    }
  });
}
