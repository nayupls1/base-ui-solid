import { createMemo, untrack, Show, $PROXY, type Accessor } from 'solid-js';
import { spread, insert, type JSX } from '@solidjs/web';
import { EMPTY_OBJECT } from '@base-ui-solid/utils/empty';
import type { HTMLProps } from './types';
import type { StateAttributesMapping } from './getStateAttributesProps';
import { getStateAttributesProps } from './getStateAttributesProps';
import { resolveClassName } from '../utils/resolveClassName';
import { resolveStyle } from '../utils/resolveStyle';
import { mergeClassNames, mergePropsSkipping, mergeStyles, toStyleObject } from '../merge-props/mergeProps';

type IntrinsicTagName = keyof JSX.IntrinsicElements;

export type RefInput<T> =
  | ((instance: T) => void)
  | { current: T | null | undefined }
  | null
  | undefined
  | false
  | RefInput<T>[];

export type PropsInput =
  | HTMLProps
  | Record<string, any>
  | ((props: HTMLProps) => HTMLProps)
  | undefined
  | null
  | false;

const SKIP_KEYS = { children: true, ref: true } as const;

/**
 * Renders a Base UI element.
 *
 * @param element The default HTML element to render. Can be overridden by the `render` prop.
 * @param componentProps An object containing the `render`, `class`, `style`, `ref` and `children`
 * props to be used for element customization. Other props are ignored (pass them via `params.props`).
 * @param params Additional parameters for rendering the element.
 */
export function useRenderElement<State extends Record<string, any>>(
  element: IntrinsicTagName | undefined,
  componentProps: UseRenderElementComponentProps<State>,
  params: UseRenderElementParameters<State> = {},
): JSX.Element {
  const getState: Accessor<State> =
    typeof params.state === 'function'
      ? (params.state as Accessor<State>)
      : () => (params.state as State | undefined) ?? (EMPTY_OBJECT as State);

  const getEnabled: Accessor<boolean> =
    typeof params.enabled === 'function'
      ? (params.enabled as Accessor<boolean>)
      : () => params.enabled !== false;

  const resolvedProps = createMemo(() => {
    if (!getEnabled()) {
      return EMPTY_OBJECT as Record<string, any>;
    }
    const state = getState();
    const stateProps = getStateAttributesProps(state, params.stateAttributesMapping);
    const inputs = resolvePropsInputs(params.props);

    const outProps = mergePropsSkipping([stateProps, ...inputs], SKIP_KEYS as any);

    const className = resolveClassName(componentProps.class, state);
    if (className !== undefined) {
      outProps.class = mergeClassNames(outProps.class, className);
    }

    const style = resolveStyle(componentProps.style, state);
    if (style !== undefined) {
      outProps.style = mergeStyles(outProps.style, style);
    }

    normalizeProps(outProps);
    return outProps;
  });

  const ref = (instance: Element) => {
    assignRefs(componentProps.ref as RefInput<Element>, instance);
    assignRefs(params.ref as RefInput<Element>, instance);
  };

  const getChildren = () => {
    if (params.children !== undefined) {
      return typeof params.children === 'function'
        ? (params.children as Accessor<JSX.Element>)()
        : params.children;
    }
    return componentProps.children;
  };

  const renderProp = untrack(() => componentProps.render);

  const content = () => {
    if (renderProp == null || typeof renderProp === 'string') {
      const tag = (renderProp as IntrinsicTagName | undefined) ?? element ?? 'div';
      return renderTag(tag, resolvedProps, getChildren, ref);
    }

    if (typeof renderProp === 'function') {
      const props = createReactiveProps(resolvedProps, getChildren, ref);
      const state = createReactiveState(getState);
      return untrack(() => (renderProp as Function)(props, state));
    }

    if (isDOMElement(renderProp)) {
      return renderIntoElement(renderProp, resolvedProps, getChildren, ref);
    }

    if (process.env.NODE_ENV !== 'production') {
      throw new Error(
        [
          'Base UI: The `render` prop was provided an invalid value.',
          'Pass a tag name, a JSX element, or a function that returns the element to render.',
          'https://base-ui.com/r/invalid-render-prop',
        ].join('\n'),
      );
    }
    return null;
  };

  if (params.enabled === undefined || params.enabled === true) {
    return content();
  }

  return <Show when={getEnabled()}>{content()}</Show>;
}

function resolvePropsInputs(props: UseRenderElementParameters<any>['props']): PropsInput[] {
  if (props == null) {
    return [];
  }
  if (Array.isArray(props)) {
    return props;
  }
  if (typeof props === 'function' && (props as Function).length === 0) {
    const result = (props as () => PropsInput | PropsInput[])();
    return Array.isArray(result) ? result : [result];
  }
  return [props as PropsInput];
}

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

/**
 * Creates the element and spreads the reactive props onto it.
 * Spreading an accessor (instead of a props object) lets Solid track the set of keys too.
 */
function renderTag(
  tag: string,
  resolvedProps: Accessor<Record<string, any>>,
  getChildren: () => JSX.Element,
  ref: (instance: Element) => void,
) {
  const node =
    tag === 'svg' ? document.createElementNS(SVG_NAMESPACE, tag) : document.createElement(tag);
  const defaults = getTagDefaults(tag);
  spread(
    node,
    () => {
      const props = resolvedProps();
      const result: Record<string, any> = defaults ? { ...defaults, ...props } : { ...props };
      result.ref = ref;
      return result;
    },
    true,
  );
  insert(node, getChildren);
  return node;
}

/**
 * Creates a props object backed by the memo. Every key read is tracked, and the set of keys is
 * reactive too, so Solid's spread adds and removes attributes as needed.
 */
function createReactiveProps(
  resolvedProps: Accessor<Record<string, any>>,
  getChildren: () => JSX.Element,
  ref: (instance: Element) => void,
  defaults?: Record<string, any>,
): HTMLProps {
  const read = (key: string | symbol) => {
    if (key === 'children') {
      return getChildren();
    }
    if (key === 'ref') {
      return ref;
    }
    const props = resolvedProps();
    if (defaults && !(key in props)) {
      return defaults[key as string];
    }
    return props[key as string];
  };
  const keys = () => {
    const props = resolvedProps();
    const result = Object.keys(props);
    if (defaults) {
      for (const key in defaults) {
        if (!(key in props)) {
          result.push(key);
        }
      }
    }
    result.push('children', 'ref');
    return result;
  };
  const proxy: HTMLProps = new Proxy({} as HTMLProps, {
    get(_target, key) {
      if (key === $PROXY) {
        return proxy;
      }
      return read(key);
    },
    has(_target, key) {
      return key === $PROXY || key === 'children' || key === 'ref' || key in resolvedProps() || (!!defaults && key in defaults);
    },
    ownKeys() {
      return keys();
    },
    getOwnPropertyDescriptor(_target, key) {
      return {
        configurable: true,
        enumerable: true,
        get: () => read(key),
      };
    },
  });
  return proxy;
}

function createReactiveState<State extends Record<string, any>>(getState: Accessor<State>): State {
  const proxy: State = new Proxy({} as State, {
    get(_target, key) {
      if (key === $PROXY) {
        return proxy;
      }
      return (getState() as any)[key];
    },
    has(_target, key) {
      return key === $PROXY || key in getState();
    },
    ownKeys() {
      return Reflect.ownKeys(getState());
    },
    getOwnPropertyDescriptor(_target, key) {
      return {
        configurable: true,
        enumerable: true,
        get: () => (getState() as any)[key],
      };
    },
  });
  return proxy;
}

/**
 * Supports `render={<a href="/" />}`: the element node is created once and Base UI's props are
 * spread onto it. The element's own `class` and `style` are kept and merged, and its own children
 * take precedence over the component's children.
 */
function renderIntoElement(
  node: HTMLElement,
  resolvedProps: Accessor<Record<string, any>>,
  getChildren: () => JSX.Element,
  ref: (instance: Element) => void,
) {
  const ownClass = node.getAttribute('class') || undefined;
  const ownStyle = node.getAttribute('style') || undefined;
  const hasOwnChildren = node.childNodes.length > 0;

  const merged = createMemo(() => {
    const props = { ...resolvedProps() };
    if (ownClass) {
      props.class = mergeClassNames(props.class, ownClass);
    }
    if (ownStyle) {
      props.style = mergeStyles(props.style, toStyleObject(ownStyle));
    }
    return props;
  });

  spread(
    node,
    () => {
      const props = { ...merged() };
      props.ref = ref;
      return props;
    },
    true,
  );
  if (!hasOwnChildren) {
    insert(node, getChildren);
  }
  return node;
}

function isDOMElement(value: unknown): value is HTMLElement {
  return typeof Element !== 'undefined' && value instanceof Element;
}

function getTagDefaults(tag: string): Record<string, any> | undefined {
  if (tag === 'button') {
    return { type: 'button' };
  }
  if (tag === 'img') {
    return { alt: '' };
  }
  return undefined;
}

/**
 * Converts React-flavoured values into what Solid expects:
 * - boolean `aria-*` values are stringified (Solid 2 would drop `false`)
 * - `className` is folded into `class`
 */
function normalizeProps(props: Record<string, any>) {
  // eslint-disable-next-line guard-for-in
  for (const key in props) {
    const value = props[key];
    if (typeof value === 'boolean' && key.charCodeAt(0) === 97 /* a */ && key.startsWith('aria-')) {
      props[key] = value ? 'true' : 'false';
    }
  }
  if ('className' in props) {
    props.class = mergeClassNames(props.class, props.className);
    delete props.className;
  }
}

export function assignRefs<T>(ref: RefInput<T> | undefined, instance: T) {
  if (!ref) {
    return;
  }
  if (Array.isArray(ref)) {
    for (const nested of ref) {
      assignRefs(nested, instance);
    }
    return;
  }
  if (typeof ref === 'function') {
    ref(instance);
    return;
  }
  ref.current = instance;
}

export type UseRenderElementParameters<State> = {
  /**
   * If `false`, nothing is rendered. Accepts an accessor for reactive toggling.
   * @default true
   */
  enabled?: boolean | Accessor<boolean> | undefined;
  /**
   * The ref(s) to apply to the rendered element.
   */
  ref?: RefInput<any> | undefined;
  /**
   * The state of the component. Pass an accessor so state changes are tracked.
   */
  state?: State | Accessor<State> | undefined;
  /**
   * Intrinsic props to be spread on the rendered element.
   * Use getters for reactive values. Function entries receive the props merged so far.
   */
  props?: PropsInput | PropsInput[] | (() => PropsInput | PropsInput[]) | undefined;
  /**
   * A mapping of state to `data-*` attributes.
   */
  stateAttributesMapping?: StateAttributesMapping<State> | undefined;
  /**
   * Overrides the children rendered inside the element.
   */
  children?: JSX.Element | Accessor<JSX.Element> | undefined;
};

export interface UseRenderElementComponentProps<State> {
  /**
   * The class to apply to the rendered element.
   * Can be a string or a function that accepts the state and returns a string.
   */
  class?: any;
  /**
   * The render prop to override the default element.
   */
  render?: any;
  /**
   * The style to apply to the rendered element.
   * Can be a style object or a function that accepts the state and returns a style object.
   */
  style?: JSX.CSSProperties | string | ((state: State) => JSX.CSSProperties | string | undefined) | undefined;
  ref?: any;
  children?: JSX.Element;
}

export interface UseRenderElementState {}
