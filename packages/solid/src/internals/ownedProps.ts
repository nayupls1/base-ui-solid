import { $PROXY, getOwner, isDisposed, runWithOwner } from 'solid-js';

/**
 * Wraps component props so property reads always run under the component's owner.
 *
 * Solid compiles conditional JSX expressions passed as props (`open={a ? b : c}`) into getters
 * that create a memo when read. Reading such a prop inside an effect callback (which has no
 * owner) throws `PRIMITIVE_IN_EFFECT_CALLBACK`. Base UI reads the latest props from callbacks in
 * many places (like React reading the latest props from refs), so reads that happen without an
 * active owner are re-parented to the component that owns the props.
 */
export function ownedProps<T extends object>(props: T): T {
  const owner = getOwner();
  if (!owner || props == null) {
    return props;
  }

  const read = (key: PropertyKey) => {
    if (getOwner() === null && !isDisposed(owner)) {
      return runWithOwner(owner, () => Reflect.get(props, key));
    }
    return Reflect.get(props, key);
  };

  const proxy: T = new Proxy(props, {
    get(_target, key) {
      if (key === $PROXY) {
        return proxy;
      }
      return read(key);
    },
    has(target, key) {
      return key === $PROXY || Reflect.has(target, key);
    },
    ownKeys(target) {
      return Reflect.ownKeys(target);
    },
    getOwnPropertyDescriptor(target, key) {
      const descriptor = Reflect.getOwnPropertyDescriptor(target, key);
      if (!descriptor) {
        return descriptor;
      }
      return {
        configurable: true,
        enumerable: descriptor.enumerable,
        get: () => read(key),
      };
    },
  });

  return proxy;
}
