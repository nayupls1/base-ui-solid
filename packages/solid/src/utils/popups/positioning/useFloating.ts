import { createEffect, createMemo, type Accessor } from 'solid-js';
import type { VirtualElement } from '@floating-ui/dom';
import { isElement } from '@floating-ui/utils/dom';
import { createSyncSignal } from '@base-ui-solid/utils/createSyncSignal';
import { useFloatingTree } from '../tree/FloatingTree';
import type {
  PopupPositioningContext,
  PopupInteractionStore,
  NarrowedElement,
  ReferenceType,
  UseFloatingOptions,
  UseFloatingReturn,
} from '../types';
import { usePosition } from './usePosition';

/**
 * Provides data to position a floating element and context to add interactions.
 * Options are read lazily, so they can be getters.
 * @see https://floating-ui.com/docs/useFloating
 */
export function useBaseUIFloating(
  options: UseFloatingOptions & { rootStore: PopupInteractionStore },
): UseFloatingReturn {
  const store = options.rootStore;

  const anchor = store.useState('anchor') as Accessor<ReferenceType | null>;
  const positionerElement = store.useState('positionerElement') as Accessor<HTMLElement | null>;
  const anchorElement = store.useState('anchorElement') as Accessor<Element | null>;
  const open = store.useState('open') as Accessor<boolean>;
  const defaultPopupId = store.useState('defaultPopupId') as Accessor<string | undefined>;

  const [positionerAnchor, setPositionerAnchor] = createSyncSignal<ReferenceType | null>(null);

  const domReferenceRef = { current: null as NarrowedElement<ReferenceType> | null };

  const tree = useFloatingTree(options.externalTree);

  const position = usePosition<ReferenceType>({
    get placement() {
      return options.placement;
    },
    get strategy() {
      return options.strategy;
    },
    get middleware() {
      return options.middleware;
    },
    get platform() {
      return options.platform;
    },
    get transform() {
      return options.transform;
    },
    get whileElementsMounted() {
      return options.whileElementsMounted;
    },
    get open() {
      return options.open;
    },
    elements: {
      get reference() {
        return positionerAnchor() ?? anchor();
      },
      get floating() {
        return positionerElement();
      },
    },
  });

  const setPositionReference = (node: ReferenceType | null) => {
    const computedPositionReference = isElement(node)
      ? ({
          getBoundingClientRect: () => node.getBoundingClientRect(),
          getClientRects: () => node.getClientRects(),
          contextElement: node,
        } satisfies VirtualElement)
      : node;
    // Store the positionerAnchor so it survives re-renders, as setReference is just a ref setter.
    setPositionerAnchor(computedPositionReference);
    position.refs.setReference(computedPositionReference);
  };

  const refs = {
    ...position.refs,
    setPositionReference,
    domReference: domReferenceRef,
  };

  const elements = {
    get reference() {
      return position.elements.reference;
    },
    get floating() {
      return position.elements.floating;
    },
    get domReference() {
      return anchorElement() as NarrowedElement<ReferenceType> | null;
    },
  };

  const context: PopupPositioningContext = {
    get x() {
      return position.x;
    },
    get y() {
      return position.y;
    },
    get placement() {
      return position.placement;
    },
    get strategy() {
      return position.strategy;
    },
    get middlewareData() {
      return position.middlewareData;
    },
    get isPositioned() {
      return position.isPositioned;
    },
    get floatingStyles() {
      return position.floatingStyles;
    },
    update: position.update,
    get open() {
      return open();
    },
    get defaultPopupId() {
      return defaultPopupId();
    },
    refs,
    elements,
    get nodeId() {
      return options.nodeId;
    },
    rootStore: store,
  } as PopupPositioningContext;

  createEffect(anchorElement, (element) => {
    if (element) {
      domReferenceRef.current = element as NarrowedElement<ReferenceType>;
    }
  });

  store.context.positioning = context;
  createEffect(
    () => options.nodeId,
    (nodeId) => {
      const node = tree?.nodesRef.current.find((n) => n.id === nodeId);
      if (node) {
        node.context = context;
      }
    },
  );

  return {
    get x() {
      return position.x;
    },
    get y() {
      return position.y;
    },
    get placement() {
      return position.placement;
    },
    get strategy() {
      return position.strategy;
    },
    get middlewareData() {
      return position.middlewareData;
    },
    get isPositioned() {
      return position.isPositioned;
    },
    get floatingStyles() {
      return position.floatingStyles;
    },
    update: position.update,
    context,
    refs,
    elements,
    rootStore: store,
  } as unknown as UseFloatingReturn;
}

export type { Accessor };
export { createMemo };
