import { onCleanup, untrack, createEffect, type Accessor } from 'solid-js';
import { createSyncSignal } from '@base-ui-solid/utils/createSyncSignal';
import type { RefObject } from '@base-ui-solid/utils/types';
import { useCompositeListContext } from './CompositeListContext';

export interface UseCompositeListItemParameters<Metadata> {
  /**
   * Whether to guess the initial index from render order, avoiding an update after mount for
   * flat lists.
   * @default false
   */
  guess?: boolean | undefined;
  index?: number | undefined;
  label?: string | null | undefined;
  /**
   * Metadata published with the item.
   */
  metadata?: Metadata | undefined;
  textRef?: RefObject<HTMLElement | null> | undefined;
}

interface UseCompositeListItemReturnValue {
  ref: (node: HTMLElement | null) => void;
  index: Accessor<number>;
}

/**
 * Used to register a list item and its index (DOM position) in the `CompositeList`.
 * Parameters are read lazily, so they can be getters.
 */
export function useCompositeListItem<Metadata>(
  params: UseCompositeListItemParameters<Metadata> = {},
): UseCompositeListItemReturnValue {
  const { register, unregister, subscribeMapChange, nextIndexRef } = useCompositeListContext();

  let indexGuess = -1;
  const [internalIndex, setInternalIndex] = createSyncSignal<number>(
    untrack(() => params.index == null && params.guess)
      ? (() => {
          indexGuess = nextIndexRef.current;
          nextIndexRef.current += 1;
          return indexGuess;
        })()
      : -1,
  );
  const index = () => params.index ?? internalIndex();

  let componentNode: Element | null = null;

  const registerNode = () => {
    if (!componentNode) {
      return;
    }
    untrack(() =>
      register(componentNode!, {
        metadata: params.metadata ?? null,
        index: params.index ?? null,
        label: params.label,
        textRef: params.textRef,
      }),
    );
  };

  const ref = (node: HTMLElement | null) => {
    if (componentNode) {
      unregister(componentNode);
    }
    componentNode = node;
    registerNode();
  };

  // Re-register when the registration inputs change.
  createEffect(
    () => [params.metadata, params.index, params.label] as const,
    () => {
      registerNode();
    },
    { defer: true } as any,
  );

  onCleanup(() => {
    if (componentNode) {
      unregister(componentNode);
      componentNode = null;
    }
  });

  const unsubscribe = subscribeMapChange((map) => {
    if (params.index != null) {
      return;
    }
    const i = componentNode ? (map.get(componentNode) as any)?.index : null;
    if (i != null) {
      setInternalIndex(i);
    }
  });
  onCleanup(unsubscribe);

  return { ref, index };
}
