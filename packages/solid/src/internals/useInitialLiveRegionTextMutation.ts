import { createEffect, createSignal, type Accessor } from 'solid-js';
import { platform } from '@base-ui-solid/utils/platform';
import { useTimeout } from '@base-ui-solid/utils/useTimeout';

// Word Joiner is invisible and zero-width, so it forces a text mutation without shifting layout.
const LIVE_REGION_MARKER = '⁠';
// Safari VoiceOver needed roughly 200ms to reliably notice the initial polite live-region change.
export const INITIAL_LIVE_REGION_TEXT_MUTATION_RESET_DELAY = 200;

function findLastTextNode(root: HTMLElement): Text | null {
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let lastTextNode: Text | null = null;

  while (walker.nextNode()) {
    const textNode = walker.currentNode as Text;
    if (textNode.nodeValue !== '') {
      lastTextNode = textNode;
    }
  }

  return lastTextNode;
}

/**
 * Appends an invisible marker to a live region's text right after it appears, so screen readers
 * announce the initial content. Returns a ref callback for the live region element.
 */
export function useInitialLiveRegionTextMutation<T extends HTMLElement>(
  present: Accessor<boolean> = () => true,
) {
  const timeout = useTimeout();
  const [root, setRoot] = createSignal<T | null>(null, { ownedWrite: true });

  // Only the initial mounted announcement needs the marker; later text updates announce naturally.
  createEffect(
    () => (present() ? root() : null),
    (element) => {
      if (element == null || platform.os.ios) {
        return undefined;
      }

      const textNode = findLastTextNode(element);
      if (textNode == null) {
        return undefined;
      }

      const originalValue = textNode.data;
      const markedValue = `${originalValue}${LIVE_REGION_MARKER}`;
      textNode.nodeValue = markedValue;

      timeout.start(INITIAL_LIVE_REGION_TEXT_MUTATION_RESET_DELAY, () => {
        if (textNode.nodeValue === markedValue) {
          textNode.nodeValue = originalValue;
        }
      });

      return () => {
        timeout.clear();

        if (textNode.nodeValue === markedValue) {
          textNode.nodeValue = originalValue;
        }
      };
    },
  );

  return (element: T | null) => {
    setRoot(() => element);
  };
}
