/* eslint-disable no-bitwise */
import { onCleanup, type JSX } from 'solid-js';
import type { RefObject } from '@base-ui-solid/utils/types';
import { CompositeListContext } from './CompositeListContext';
import type { CompositeListRegistration } from './CompositeListContext';
import { ownedProps } from '../../ownedProps';

export type CompositeMetadata<CustomMetadata> = {
  index: number;
} & CustomMetadata;

interface CompositeListItem<Metadata> {
  index: number;
  element: HTMLElement;
  registration: CompositeListRegistration<Metadata>;
}

/**
 * Provides context for a list of items in a composite component.
 * Items register their elements; indices are derived from DOM order.
 */
export function CompositeList<Metadata>(props: CompositeList.Props<Metadata>) {
  props = ownedProps(props);
  const listeners = new Set<Function>();
  const map = new Map<Element, CompositeListRegistration<Metadata>>();
  const nextIndexRef = { current: 0 };
  let isScheduled = false;
  let disposed = false;
  let itemsCache: readonly CompositeListItem<Metadata>[] | null = null;
  let mutationObserver: MutationObserver | null = null;

  const scheduleMapUpdate = () => {
    if (isScheduled || disposed) {
      return;
    }
    isScheduled = true;
    // Refs run before nodes are attached. Solid attaches them within the same flush,
    // so a microtask runs once the DOM reflects the new items.
    queueMicrotask(() => {
      isScheduled = false;
      if (!disposed) {
        flush();
      }
    });
  };

  const register = (node: Element, registration: CompositeListRegistration<Metadata>) => {
    map.set(node, registration);
    scheduleMapUpdate();
  };

  const unregister = (node: Element) => {
    map.delete(node);
    scheduleMapUpdate();
  };

  const syncRefs = (items: readonly CompositeListItem<Metadata>[]) => {
    const nextMap = new Map<Element, CompositeMetadata<Metadata>>();
    const elementsRef = props.elementsRef;
    const labelsRef = props.labelsRef;

    elementsRef.current.length = 0;
    if (labelsRef) {
      labelsRef.current.length = 0;
    }

    items.forEach((item) => {
      nextMap.set(item.element, {
        ...(item.registration.metadata ?? ({} as Metadata)),
        index: item.index,
      });

      elementsRef.current[item.index] = item.element;

      if (labelsRef) {
        labelsRef.current[item.index] =
          item.registration.label !== undefined
            ? item.registration.label
            : (item.registration.textRef?.current?.textContent ?? item.element.textContent);
      }
    });

    nextIndexRef.current = elementsRef.current.length;

    return nextMap;
  };

  function observe(sortedNodes: HTMLElement[]) {
    mutationObserver?.disconnect();
    mutationObserver = null;

    if (typeof MutationObserver !== 'function' || sortedNodes.length < 2) {
      return;
    }

    const observer = new MutationObserver((entries) => {
      if (!hasMovedNode(entries)) {
        return;
      }

      let previousConnectedNode: Element | null = null;

      for (const node of sortedNodes) {
        if (!node.isConnected) {
          continue;
        }

        if (previousConnectedNode && sortByDocumentPosition(previousConnectedNode, node) > 0) {
          observer.disconnect();
          scheduleMapUpdate();
          return;
        }

        previousConnectedNode = node;
      }
    });

    mutationObserver = observer;

    const roots = new Set<Element>();
    for (let i = 1; i < sortedNodes.length; i += 1) {
      const root = getCommonAncestor(sortedNodes[i - 1], sortedNodes[i]);
      if (root) {
        roots.add(root);
      }
    }

    roots.forEach((root) => observer.observe(root, { childList: true }));
  }

  function flush() {
    const [items, automaticNodes] = getCompositeListSnapshot(map);
    const nextMap = syncRefs(items);

    const previousItems = itemsCache;
    const changed =
      !previousItems ||
      previousItems.length !== items.length ||
      items.some((item, index) => {
        const previousItem = previousItems[index];
        return (
          item.index !== previousItem.index ||
          item.element !== previousItem.element ||
          item.registration.index !== previousItem.registration.index ||
          item.registration.metadata !== previousItem.registration.metadata
        );
      });

    observe(automaticNodes);
    itemsCache = items;

    if (!changed) {
      return;
    }

    listeners.forEach((listener) => listener(nextMap));
    props.onMapChange?.(nextMap);
  }

  onCleanup(() => {
    disposed = true;
    mutationObserver?.disconnect();
    props.elementsRef.current = [];
    if (props.labelsRef) {
      props.labelsRef.current = [];
    }
  });

  const subscribeMapChange = (fn: Function) => {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  };

  const contextValue = { register, unregister, subscribeMapChange, nextIndexRef } as any;

  return <CompositeListContext value={contextValue}>{props.children}</CompositeListContext>;
}

function getCompositeListSnapshot<Metadata>(
  map: Map<Element, CompositeListRegistration<Metadata>>,
) {
  const reservedIndices = new Set<number>();
  const items: CompositeListItem<Metadata>[] = [];
  const automaticItems: CompositeListItem<Metadata>[] = [];

  map.forEach((registration, node) => {
    if (!node.isConnected) {
      return;
    }

    const index = registration.index;
    const item = {
      index: index ?? -1,
      element: node as HTMLElement,
      registration,
    };

    if (index === null) {
      automaticItems.push(item);
    } else if (index >= 0) {
      reservedIndices.add(index);
      items.push(item);
    }
  });

  let nextAutomaticIndex = 0;
  automaticItems.sort((a, b) => sortByDocumentPosition(a.element, b.element));

  automaticItems.forEach((item) => {
    while (reservedIndices.has(nextAutomaticIndex)) {
      nextAutomaticIndex += 1;
    }

    item.index = nextAutomaticIndex;
    items.push(item);
    nextAutomaticIndex += 1;
  });

  if (reservedIndices.size > 0) {
    items.sort((a, b) => a.index - b.index);
  }

  return [items, automaticItems.map((item) => item.element)] as const;
}

function getCommonAncestor(firstNode: Element, lastNode: Element) {
  let ancestor = firstNode.parentElement;

  while (ancestor && !ancestor.contains(lastNode)) {
    ancestor = ancestor.parentElement;
  }

  return ancestor;
}

function hasMovedNode(entries: MutationRecord[]) {
  for (const entry of entries) {
    for (let i = 0; i < entry.removedNodes.length; i += 1) {
      if (entry.removedNodes[i].isConnected) {
        return true;
      }
    }
  }

  return false;
}

function sortByDocumentPosition(a: Element, b: Element) {
  if (a.nextElementSibling === b) {
    return -1;
  }
  if (b.nextElementSibling === a) {
    return 1;
  }
  return a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
}

export interface CompositeListState {}

export interface CompositeListProps<Metadata> {
  children: JSX.Element;
  /**
   * A ref to the list of HTML elements, ordered by their index.
   * Explicit indexes can leave empty slots in the array.
   * `useListNavigation`'s `listRef` prop.
   */
  elementsRef: RefObject<Array<HTMLElement | null>>;
  /**
   * A ref to the list of element labels, ordered by their index.
   * `useTypeahead`'s `listRef` prop.
   */
  labelsRef?: RefObject<Array<string | null>> | undefined;
  onMapChange?: ((newMap: Map<Element, CompositeMetadata<Metadata>>) => void) | undefined;
}

export namespace CompositeList {
  export type State = CompositeListState;
  export type Props<Metadata> = CompositeListProps<Metadata>;
}
