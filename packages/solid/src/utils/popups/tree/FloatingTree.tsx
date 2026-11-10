import { createContext, createEffect, useContext, untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { useId } from 'base-ui-solidjs-utils/useId';
import type { FloatingNodeType, FloatingTreeType } from '../types';
import { FloatingTreeStore } from './FloatingTreeStore';
import { ownedProps } from '../../../internals/ownedProps';

const FloatingNodeContext = createContext<FloatingNodeType | null>(null);
const FloatingTreeContext = createContext<FloatingTreeType | null>(null);

/**
 * Returns the parent node id for nested floating elements, if available.
 * Returns `null` for top-level floating elements.
 */
export const useFloatingParentNodeId = (): string | null => {
  const node = useContext(FloatingNodeContext);
  return untrack(() => node?.id) || null;
};

/**
 * Returns the nearest floating tree context, if available.
 */
export const useFloatingTree = (externalTree?: FloatingTreeStore): FloatingTreeType | null => {
  const contextTree = useContext(FloatingTreeContext) as FloatingTreeType | null;
  return externalTree ?? contextTree;
};

/**
 * Registers a node into the `FloatingTree`, returning its id.
 */
export function useFloatingNodeId(externalTree?: FloatingTreeStore): string | undefined {
  const id = useId();
  const tree = useFloatingTree(externalTree);
  const parentId = useFloatingParentNodeId();

  createEffect(
    () => 0,
    () => {
      if (!id) {
        return undefined;
      }

      const node = { id, parentId };
      tree?.addNode(node);
      return () => {
        tree?.removeNode(node);
      };
    },
  );

  return id;
}

export interface FloatingNodeProps {
  children?: JSX.Element;
  id: string | undefined;
}

/**
 * Provides parent node context for nested floating elements.
 */
export function FloatingNode(props: FloatingNodeProps): JSX.Element {
  props = ownedProps(props);
  const parentId = useFloatingParentNodeId();
  const value: FloatingNodeType = {
    get id() {
      return props.id;
    },
    parentId,
  };

  return <FloatingNodeContext value={value}>{props.children}</FloatingNodeContext>;
}

export interface FloatingTreeProps {
  children?: JSX.Element;
  /**
   * External floating tree to use when the one provided by context can't be used.
   */
  externalTree?: FloatingTreeStore | undefined;
}

/**
 * Provides context for nested floating elements when they are not children of
 * each other on the DOM.
 */
export function FloatingTree(props: FloatingTreeProps): JSX.Element {
  props = ownedProps(props);
  // eslint-disable-next-line solid/reactivity
  const tree = props.externalTree ?? new FloatingTreeStore();
  return <FloatingTreeContext value={tree}>{props.children}</FloatingTreeContext>;
}
