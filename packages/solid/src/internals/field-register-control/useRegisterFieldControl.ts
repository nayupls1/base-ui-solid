import { createEffect, onCleanup, untrack, type Accessor } from 'solid-js';
import { useFieldRootContext } from '../field-root-context/FieldRootContext';
import type { FieldControlRegistration } from './useFieldControlRegistration';

/**
 * Registers a control with the surrounding Field. Reactive inputs are accessors.
 */
export function useRegisterFieldControl(
  controlRef: FieldControlRegistration['controlRef'],
  id: Accessor<FieldControlRegistration['id']>,
  value: Accessor<FieldControlRegistration['value']>,
  getFormValueOverride?: FieldControlRegistration['getValue'],
  enabled: Accessor<boolean> = () => true,
  name?: Accessor<FieldControlRegistration['name']>,
) {
  const { registerFieldControl } = useFieldRootContext();
  const source = Symbol();

  createEffect(
    () => [enabled(), id(), value(), name?.()] as const,
    ([isEnabled, currentId, currentValue, currentName]) => {
      if (!isEnabled) {
        untrack(() => registerFieldControl(source, undefined));
        return;
      }

      const registration: FieldControlRegistration = {
        controlRef,
        getValue: getFormValueOverride,
        id: currentId,
        name: currentName,
        value: currentValue,
      };

      untrack(() => registerFieldControl(source, registration));
    },
  );

  onCleanup(() => {
    registerFieldControl(source, undefined);
  });
}
