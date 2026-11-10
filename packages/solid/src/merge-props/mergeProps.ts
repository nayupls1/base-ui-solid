import type { JSX } from '@solidjs/web';
import type { BaseUIEvent } from '../internals/types';

type AnyProps = Record<string, any>;
type InputProps<P extends AnyProps = AnyProps> = P | ((otherProps: P) => P) | undefined | null | false;

const EMPTY_PROPS = {};

/* eslint-disable id-denylist */
/**
 * Merges multiple sets of props. It follows the Object.assign pattern where the rightmost object's fields overwrite
 * the conflicting ones from others. This doesn't apply to event handlers, `class` and `style` props.
 *
 * Event handlers are merged and called in right-to-left order (rightmost handler executes first, leftmost last).
 * For DOM events, the rightmost handler can prevent prior (left-positioned) handlers from executing
 * by calling `event.preventBaseUIHandler()`. For non-DOM events (custom events with primitive/object values),
 * all handlers always execute without prevention capability.
 *
 * The `class` prop is merged by concatenating classes in right-to-left order (rightmost class appears first in the string).
 * The `style` prop is merged with rightmost styles overwriting the prior ones.
 *
 * Props can either be provided as objects or as functions that take the previous props as an argument.
 * The function will receive the merged props up to that point (going from left to right):
 * so in the case of `(obj1, obj2, fn, obj3)`, `fn` will receive the merged props of `obj1` and `obj2`.
 * The function is responsible for chaining event handlers if needed (that is, we don't run the merge logic).
 *
 * Note: getters on the input objects are read eagerly, so call `mergeProps` inside a reactive
 * scope (JSX, a memo, or a render function) to keep the result up to date.
 *
 * @important **`ref` is not merged.**
 * @public
 */
export function mergeProps<P extends AnyProps = AnyProps>(...props: InputProps<P>[]): P {
  return mergePropsN(props);
}
/* eslint-enable id-denylist */

/**
 * Merges an arbitrary number of props using the same logic as {@link mergeProps}.
 * This function accepts an array of props instead of individual arguments.
 *
 * @public
 */
export function mergePropsN<P extends AnyProps = AnyProps>(props: InputProps<P>[]): P {
  if (props.length === 0) {
    return EMPTY_PROPS as P;
  }

  let merged = createInitialMergedProps(props[0]);

  for (let i = 1; i < props.length; i += 1) {
    merged = mergeInto(merged, props[i]);
  }

  return merged as P;
}

function createInitialMergedProps(inputProps: InputProps<any>, skip?: SkipKeys) {
  if (isPropsGetter(inputProps)) {
    return { ...inputProps(EMPTY_PROPS) };
  }

  return copyInitialProps(inputProps, skip);
}

function mergeInto(merged: AnyProps, inputProps: InputProps<any>, skip?: SkipKeys) {
  if (isPropsGetter(inputProps)) {
    return inputProps(merged);
  }
  return mutablyMergeInto(merged, inputProps, skip);
}

type SkipKeys = Record<string, true>;

function copyInitialProps(inputProps: AnyProps | undefined | null | false, skip?: SkipKeys) {
  const copiedProps: AnyProps = {};
  if (!inputProps) {
    return copiedProps;
  }

  // eslint-disable-next-line guard-for-in
  for (const propName in inputProps) {
    if (skip && skip[propName]) {
      continue;
    }
    const propValue = inputProps[propName];
    if (isEventHandler(propName, propValue)) {
      copiedProps[propName] = wrapEventHandler(normalizeHandler(propValue));
    } else {
      copiedProps[propName] = propValue;
    }
  }

  return copiedProps;
}

/**
 * Merges two sets of props. In case of conflicts, the external props take precedence.
 */
function mutablyMergeInto(
  mergedProps: AnyProps,
  externalProps: AnyProps | undefined | null | false,
  skip?: SkipKeys,
) {
  if (!externalProps) {
    return mergedProps;
  }

  // eslint-disable-next-line guard-for-in
  for (const propName in externalProps) {
    if (skip && skip[propName]) {
      continue;
    }
    const externalPropValue = externalProps[propName];

    switch (propName) {
      case 'style': {
        mergedProps[propName] = mergeStyles(mergedProps.style, externalPropValue);
        break;
      }
      case 'class':
      case 'className': {
        mergedProps.class = mergeClassNames(
          mergedProps.class ?? mergedProps.className,
          externalPropValue,
        );
        if (propName === 'className') {
          delete mergedProps.className;
        }
        break;
      }
      default: {
        if (isEventHandler(propName, externalPropValue)) {
          mergedProps[propName] = mergeEventHandlers(
            mergedProps[propName],
            normalizeHandler(externalPropValue),
          );
        } else {
          mergedProps[propName] = externalPropValue;
        }
      }
    }
  }

  return mergedProps;
}

export function isEventHandler(key: string, value: unknown) {
  const code0 = key.charCodeAt(0);
  const code1 = key.charCodeAt(1);
  const code2 = key.charCodeAt(2);
  return (
    code0 === 111 /* o */ &&
    code1 === 110 /* n */ &&
    code2 >= 65 /* A */ &&
    code2 <= 90 /* Z */ &&
    (typeof value === 'function' ||
      typeof value === 'undefined' ||
      (Array.isArray(value) && typeof value[0] === 'function'))
  );
}

/**
 * Solid supports bound handlers (`[handler, data]`). Convert them to plain functions.
 */
function normalizeHandler(value: any): Function | undefined {
  if (Array.isArray(value)) {
    const [handler, data] = value;
    return (event: unknown) => handler(data, event);
  }
  return value;
}

function isPropsGetter(inputProps: InputProps<any>): inputProps is (props: AnyProps) => AnyProps {
  return typeof inputProps === 'function';
}

const mergedHandlerCache = new WeakMap<Function, WeakMap<Function, Function>>();
const wrappedHandlerCache = new WeakMap<Function, Function>();

function mergeEventHandlers(ourHandler: Function | undefined, theirHandler: Function | undefined) {
  if (!theirHandler) {
    return ourHandler;
  }
  if (!ourHandler) {
    return wrapEventHandler(theirHandler);
  }

  let byTheirs = mergedHandlerCache.get(ourHandler);
  if (!byTheirs) {
    byTheirs = new WeakMap();
    mergedHandlerCache.set(ourHandler, byTheirs);
  }
  const cached = byTheirs.get(theirHandler);
  if (cached) {
    return cached;
  }

  const merged = (...args: unknown[]) => {
    const event = args[0];

    if (isDOMEvent(event)) {
      const baseUIEvent = event as BaseUIEvent<typeof event>;

      makeEventPreventable(baseUIEvent);

      const result = theirHandler(...args);

      if (!baseUIEvent.baseUIHandlerPrevented) {
        ourHandler?.(...args);
      }

      return result;
    }

    const result = theirHandler(...args);
    ourHandler?.(...args);
    return result;
  };

  byTheirs.set(theirHandler, merged);
  return merged;
}

function wrapEventHandler(handler: Function | undefined) {
  if (!handler) {
    return handler;
  }

  const cached = wrappedHandlerCache.get(handler);
  if (cached) {
    return cached;
  }

  const wrapped = (...args: unknown[]) => {
    const event = args[0];

    if (isDOMEvent(event)) {
      makeEventPreventable(event as BaseUIEvent<typeof event>);
    }

    return handler(...args);
  };
  wrappedHandlerCache.set(handler, wrapped);
  return wrapped;
}

export function makeEventPreventable<T extends Event>(event: BaseUIEvent<T>) {
  if (typeof event.preventBaseUIHandler !== 'function') {
    event.preventBaseUIHandler = () => {
      (event.baseUIHandlerPrevented as boolean) = true;
    };
  }

  return event;
}

/**
 * Merges class values. Strings are concatenated (theirs first); other Solid class values
 * (objects or arrays) are combined into an array.
 */
export function mergeClassNames(ourClassName: any, theirClassName: any): any {
  if (theirClassName) {
    if (ourClassName) {
      if (typeof ourClassName === 'string' && typeof theirClassName === 'string') {
        return theirClassName + ' ' + ourClassName;
      }
      return [theirClassName, ourClassName];
    }

    return theirClassName;
  }

  return ourClassName;
}

/**
 * Merges style values. Objects are shallowly merged with the rightmost winning.
 * String styles are converted to objects.
 */
export function mergeStyles(
  ourStyle: JSX.CSSProperties | string | undefined,
  theirStyle: JSX.CSSProperties | string | undefined,
): JSX.CSSProperties | string | undefined {
  if (!theirStyle) {
    return ourStyle;
  }
  if (!ourStyle) {
    return theirStyle;
  }
  return { ...toStyleObject(ourStyle), ...toStyleObject(theirStyle) };
}

export function toStyleObject(style: JSX.CSSProperties | string | undefined): JSX.CSSProperties {
  if (!style) {
    return {};
  }
  if (typeof style !== 'string') {
    return style;
  }
  const result: Record<string, string> = {};
  for (const declaration of style.split(';')) {
    const index = declaration.indexOf(':');
    if (index === -1) {
      continue;
    }
    const property = declaration.slice(0, index).trim();
    const value = declaration.slice(index + 1).trim();
    if (property) {
      result[property] = value;
    }
  }
  return result as JSX.CSSProperties;
}

function isDOMEvent(event: unknown): event is Event {
  return typeof Event !== 'undefined' && event instanceof Event;
}

/**
 * Internal variant used by `useRenderElement`: skips the given keys (such as `children` and `ref`)
 * so their getters are never evaluated inside the props memo.
 */
export function mergePropsSkipping(props: InputProps<any>[], skip: SkipKeys): AnyProps {
  if (props.length === 0) {
    return {};
  }
  let merged = createInitialMergedProps(props[0], skip);
  for (let i = 1; i < props.length; i += 1) {
    merged = mergeInto(merged, props[i], skip);
  }
  return merged;
}
