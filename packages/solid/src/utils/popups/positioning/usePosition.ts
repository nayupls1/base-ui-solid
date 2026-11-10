import { createEffect, createMemo, onCleanup, untrack, type Accessor } from 'solid-js';
import type { JSX } from '@solidjs/web';
import {
  computePosition,
  type ComputePositionConfig,
  type Middleware,
  type MiddlewareData,
  type Placement,
  type Platform,
  type Strategy,
  type VirtualElement,
} from '@floating-ui/dom';
import { createSyncSignal } from '@base-ui-solid/utils/createSyncSignal';
import type { RefObject } from '@base-ui-solid/utils/types';

export type ReferenceElement = Element | VirtualElement;

export interface UsePositionOptions<RT extends ReferenceElement = ReferenceElement> {
  placement?: Placement | undefined;
  strategy?: Strategy | undefined;
  middleware?: Array<Middleware | null | undefined | false> | undefined;
  platform?: Platform | undefined;
  elements?:
    | {
        reference?: RT | null | undefined;
        floating?: HTMLElement | null | undefined;
      }
    | undefined;
  transform?: boolean | undefined;
  whileElementsMounted?:
    | ((reference: RT, floating: HTMLElement, update: () => void) => () => void)
    | undefined;
  open?: boolean | undefined;
}

export interface PositionData {
  x: number;
  y: number;
  strategy: Strategy;
  placement: Placement;
  middlewareData: MiddlewareData;
  isPositioned: boolean;
}

/**
 * The Solid counterpart of `@floating-ui/react-dom`'s return value.
 * Data fields are getters, so reads are tracked.
 */
export interface UsePositionReturn<RT extends ReferenceElement = ReferenceElement> {
  readonly x: number;
  readonly y: number;
  readonly strategy: Strategy;
  readonly placement: Placement;
  readonly middlewareData: MiddlewareData;
  readonly isPositioned: boolean;
  readonly floatingStyles: JSX.CSSProperties;
  update: () => void;
  refs: {
    reference: RefObject<RT | null>;
    floating: RefObject<HTMLElement | null>;
    setReference: (node: RT | null) => void;
    setFloating: (node: HTMLElement | null) => void;
  };
  readonly elements: {
    readonly reference: RT | null;
    readonly floating: HTMLElement | null;
  };
}

/**
 * Solid port of `@floating-ui/react-dom`'s `useFloating`.
 * Options are read lazily, so they can be getters.
 */
export function usePosition<RT extends ReferenceElement = ReferenceElement>(
  options: UsePositionOptions<RT> = {},
): UsePositionReturn<RT> {
  const placement = () => options.placement ?? 'bottom';
  const strategy = () => options.strategy ?? 'absolute';
  const transform = () => options.transform ?? true;

  const [data, setData] = createSyncSignal<PositionData>({
    x: 0,
    y: 0,
    strategy: untrack(strategy),
    placement: untrack(placement),
    middlewareData: {},
    isPositioned: false,
  });

  const latestMiddleware = createMemo(() => options.middleware ?? [], undefined, {
    equals: (a, b) => deepEqual(middlewareOptions(a), middlewareOptions(b)),
  });

  const [internalReference, setInternalReference] = createSyncSignal<RT | null>(null);
  const [internalFloating, setInternalFloating] = createSyncSignal<HTMLElement | null>(null);

  const referenceRef: RefObject<RT | null> = { current: null };
  const floatingRef: RefObject<HTMLElement | null> = { current: null };

  const setReference = (node: RT | null) => {
    if (node !== referenceRef.current) {
      referenceRef.current = node;
      setInternalReference(node);
    }
  };

  const setFloating = (node: HTMLElement | null) => {
    if (node !== floatingRef.current) {
      floatingRef.current = node;
      setInternalFloating(node);
    }
  };

  const referenceEl = () => options.elements?.reference || internalReference();
  const floatingEl = () => options.elements?.floating || internalFloating();

  let mounted = true;
  onCleanup(() => {
    mounted = false;
  });

  let updateConfig = () => ({
    placement: untrack(placement),
    strategy: untrack(strategy),
    middleware: untrack(latestMiddleware),
  });

  const update = () => {
    if (!referenceRef.current || !floatingRef.current) {
      return;
    }

    const config: ComputePositionConfig = updateConfig();
    const platform = untrack(() => options.platform);
    if (platform) {
      config.platform = platform;
    }

    computePosition(referenceRef.current, floatingRef.current, config).then((nextData) => {
      const fullData: PositionData = {
        ...nextData,
        isPositioned: untrack(() => options.open) !== false,
      };
      if (mounted && !deepEqual(data(), fullData)) {
        setData(fullData);
      }
    });
  };

  createEffect(
    () => options.open,
    (open) => {
      const current = untrack(data);
      if (open === false && current.isPositioned) {
        setData({ ...current, isPositioned: false });
      }
    },
  );

  createEffect(
    () => [referenceEl(), floatingEl(), latestMiddleware(), placement(), strategy()] as const,
    ([reference, floating, middleware, currentPlacement, currentStrategy]) => {
      updateConfig = () => ({
        placement: currentPlacement,
        strategy: currentStrategy,
        middleware,
      });
      if (reference) {
        referenceRef.current = reference;
      }
      if (floating) {
        floatingRef.current = floating;
      }
      if (reference && floating) {
        const whileElementsMounted = untrack(() => options.whileElementsMounted);
        if (whileElementsMounted) {
          return whileElementsMounted(reference, floating, update);
        }
        update();
      }
      return undefined;
    },
  );

  const floatingStyles = createMemo<JSX.CSSProperties>(() => {
    const currentStrategy = strategy();
    const initialStyles: JSX.CSSProperties = {
      position: currentStrategy,
      left: '0',
      top: '0',
    };
    const floating = floatingEl();
    if (!floating) {
      return initialStyles;
    }

    const current = data();
    const x = roundByDPR(floating, current.x);
    const y = roundByDPR(floating, current.y);

    if (transform()) {
      return {
        ...initialStyles,
        transform: `translate(${x}px, ${y}px)`,
        ...(getDPR(floating) >= 1.5 && { 'will-change': 'transform' }),
      };
    }

    return {
      position: currentStrategy,
      left: `${x}px`,
      top: `${y}px`,
    };
  });

  return {
    get x() {
      return data().x;
    },
    get y() {
      return data().y;
    },
    get strategy() {
      return data().strategy;
    },
    get placement() {
      return data().placement;
    },
    get middlewareData() {
      return data().middlewareData;
    },
    get isPositioned() {
      return data().isPositioned;
    },
    get floatingStyles() {
      return floatingStyles();
    },
    update,
    refs: {
      reference: referenceRef,
      floating: floatingRef,
      setReference,
      setFloating,
    },
    elements: {
      get reference() {
        return referenceEl();
      },
      get floating() {
        return floatingEl();
      },
    },
  };
}

function middlewareOptions(middleware: Array<Middleware | null | undefined | false>) {
  return middleware.map((item) =>
    item ? { name: item.name, options: (item as any).options } : item,
  );
}

function getDPR(element: Element) {
  if (typeof window === 'undefined') {
    return 1;
  }
  const win = element.ownerDocument.defaultView || window;
  return win.devicePixelRatio || 1;
}

function roundByDPR(element: Element, value: number) {
  const dpr = getDPR(element);
  return Math.round(value * dpr) / dpr;
}

export function deepEqual(a: any, b: any): boolean {
  if (a === b) {
    return true;
  }
  if (typeof a !== typeof b) {
    return false;
  }
  if (typeof a === 'function' && a.toString() === b.toString()) {
    return true;
  }
  let length: number;
  let i: number;
  let keys: string[];
  if (a && b && typeof a === 'object') {
    if (Array.isArray(a)) {
      length = a.length;
      if (length !== b.length) {
        return false;
      }
      for (i = length; i-- !== 0; ) {
        if (!deepEqual(a[i], b[i])) {
          return false;
        }
      }
      return true;
    }
    if (a instanceof Element || b instanceof Element) {
      return a === b;
    }
    keys = Object.keys(a);
    length = keys.length;
    if (length !== Object.keys(b).length) {
      return false;
    }
    for (i = length; i-- !== 0; ) {
      if (!{}.hasOwnProperty.call(b, keys[i])) {
        return false;
      }
    }
    for (i = length; i-- !== 0; ) {
      const key = keys[i];
      if (!deepEqual(a[key], b[key])) {
        return false;
      }
    }
    return true;
  }
  // eslint-disable-next-line no-self-compare
  return a !== a && b !== b;
}

export type { Accessor };
