import { $PROXY } from 'solid-js';
import type { RefObject } from 'base-ui-solidjs-utils/types';
import type { MenuFilterRootProps } from './MenuFilterRoot';

/**
 * Splits a filterable root's props into the menu root's props and the filter's props.
 * Both results are reactive views of `props`.
 */
export function useMenuFilterRoot<Payload>(props: MenuFilterRootProps<Payload>) {
  const omitted = new Set<PropertyKey>([
    'children',
    'value',
    'defaultValue',
    'onValueChange',
    'filter',
    'autoHighlight',
    'locale',
  ]);

  const virtualFocusRef: RefObject<HTMLElement | null> = { current: null };

  return {
    rootProps: forwardProps(props as Record<PropertyKey, any>, omitted, {
      virtualFocus: true,
      virtualFocusRef,
      get allowEscape() {
        return !(props.autoHighlight ?? false);
      },
      get resetOnPointerLeave() {
        return (props.autoHighlight ?? false) !== 'always';
      },
    }),
    dropdownProps: {
      get value() {
        return props.value;
      },
      get defaultValue() {
        return props.defaultValue;
      },
      get onValueChange() {
        return props.onValueChange;
      },
      get filter() {
        return props.filter;
      },
      get autoHighlight() {
        return props.autoHighlight ?? false;
      },
      get locale() {
        return props.locale;
      },
    },
  };
}

/**
 * A view of `props` without the `omitted` keys and with `overrides` on top. Reads go straight to
 * the source getters, so they stay tracked wherever they happen.
 */
function forwardProps(
  props: Record<PropertyKey, any>,
  omitted: ReadonlySet<PropertyKey>,
  overrides: Record<PropertyKey, any>,
): Record<PropertyKey, any> {
  const read = (key: PropertyKey) => (key in overrides ? overrides[key] : props[key as any]);
  const keys = () => [
    ...Object.keys(props).filter((key) => !omitted.has(key) && !(key in overrides)),
    ...Object.keys(overrides),
  ];
  const proxy: Record<PropertyKey, any> = new Proxy(
    {},
    {
      get(_target, key) {
        if (key === $PROXY) {
          return proxy;
        }
        // Solid reads internal symbols (such as its merge record) off `$PROXY` objects; this
        // view must not hand out the source's.
        if (typeof key === 'symbol') {
          return undefined;
        }
        return omitted.has(key) ? undefined : read(key);
      },
      has(_target, key) {
        return key === $PROXY || key in overrides || (!omitted.has(key) && key in props);
      },
      ownKeys() {
        return keys() as (string | symbol)[];
      },
      getOwnPropertyDescriptor(_target, key) {
        return { configurable: true, enumerable: true, get: () => read(key) };
      },
    },
  );
  return proxy;
}
