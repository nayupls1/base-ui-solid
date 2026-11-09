import { untrack, createEffect, type Accessor } from 'solid-js';
import { error } from './error';
import { createSyncSignal } from './createSyncSignal';

export interface UseControlledProps<T = unknown> {
  /**
   * Holds the component value when it's controlled.
   */
  controlled: Accessor<T | undefined>;
  /**
   * The default value when uncontrolled, and the fallback if a controlled value later becomes `undefined`.
   */
  default: T | undefined | Accessor<T | undefined>;
  /**
   * The component name displayed in warnings.
   */
  name: string;
  /**
   * The name of the state variable displayed in warnings.
   */
  state?: string | undefined;
}

export type ControlledSetter<T> = (value: T | ((prev: T) => T)) => void;

/**
 * Solid port of Base UI's `useControlled`.
 * Returns an accessor for the current value and a setter that only updates the
 * internal state when uncontrolled.
 */
export function useControlled<T = unknown>(
  props: Omit<UseControlledProps<T>, 'default'> & { default: T | Accessor<T> },
): [Accessor<T>, ControlledSetter<T>];
export function useControlled<T = unknown>(
  props: UseControlledProps<T>,
): [Accessor<T | undefined>, ControlledSetter<T | undefined>];
export function useControlled<T = unknown>(
  props: UseControlledProps<T>,
): [Accessor<T | undefined>, ControlledSetter<T | undefined>] {
  const { name, state = 'value' } = props;
  const isControlled = untrack(props.controlled) !== undefined;
  const defaultProp = untrack(() =>
    typeof props.default === 'function' && (props.default as Function).length === 0
      ? (props.default as Accessor<T | undefined>)()
      : (props.default as T | undefined),
  );
  const [valueState, setValueState] = createSyncSignal<T | undefined>(defaultProp);

  if (process.env.NODE_ENV !== 'production') {
    createEffect(props.controlled, (controlled) => {
      if (isControlled !== (controlled !== undefined)) {
        error(
          [
            `A component is changing the ${
              isControlled ? '' : 'un'
            }controlled ${state} state of ${name} to be ${isControlled ? 'un' : ''}controlled.`,
            'Elements should not switch from uncontrolled to controlled (or vice versa).',
            `Decide between using a controlled or uncontrolled ${name} ` +
              'element for the lifetime of the component.',
            "The nature of the state is determined during the first render. It's considered controlled if the value is not `undefined`.",
          ].join('\n'),
        );
      }
    });
  }

  const value = () => {
    if (isControlled) {
      const controlled = props.controlled();
      if (controlled !== undefined) {
        return controlled;
      }
    }
    return valueState();
  };

  const setValueIfUncontrolled: ControlledSetter<T | undefined> = (newValue) => {
    if (!isControlled) {
      setValueState(newValue as any);
    }
  };

  return [value, setValueIfUncontrolled];
}
