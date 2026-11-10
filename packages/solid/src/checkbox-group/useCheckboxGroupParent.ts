import { untrack } from 'solid-js';
import { createSyncSignal } from '@base-ui-solid/utils/createSyncSignal';
import { EMPTY_ARRAY } from '@base-ui-solid/utils/empty';
import type { RefObject } from '@base-ui-solid/utils/types';
import type { BaseUIChangeEventDetails } from '../internals/createBaseUIEventDetails';
import type { BaseUIEventReasons } from '../internals/reasons';

/**
 * Parameters are read lazily, so they can be getters.
 */
export function useCheckboxGroupParent(
  params: UseCheckboxGroupParentParameters,
): UseCheckboxGroupParentReturnValue {
  const allValues = () => params.allValues ?? (EMPTY_ARRAY as string[]);

  const uncontrolledStateRef = { current: untrack(() => params.value) };
  const disabledStatesRef = { current: new Map<string, boolean>() };

  const [status, setStatus] = createSyncSignal<'on' | 'off' | 'mixed'>('mixed');
  const [childIdsState, setChildIdsState] = createSyncSignal(
    { registry: new Map<string, readonly string[]>() },
    { equals: false },
  );

  const checked = () => params.value.length === allValues().length;
  const indeterminate = () =>
    params.value.length !== allValues().length && params.value.length > 0;

  const onValueChange: NonNullable<UseCheckboxGroupParentParameters['onValueChange']> = (
    value,
    eventDetails,
  ) => {
    params.onValueChange?.(value, eventDetails);
  };

  const registerChildId = (childValue: string, childId: string) => {
    const childIds = childIdsState().registry;
    childIds.set(childValue, (childIds.get(childValue) ?? EMPTY_ARRAY).concat(childId));
    setChildIdsState({ registry: childIds });

    return () => {
      const nextIds = (childIds.get(childValue) ?? EMPTY_ARRAY).filter((id) => id !== childId);
      if (nextIds.length === 0) {
        childIds.delete(childValue);
      } else {
        childIds.set(childValue, nextIds);
      }
      setChildIdsState({ registry: childIds });
    };
  };

  const getParentProps: UseCheckboxGroupParentReturnValue['getParentProps'] = () => ({
    indeterminate: indeterminate(),
    checked: checked(),
    'aria-controls':
      allValues()
        .flatMap((v) => childIdsState().registry.get(v) ?? EMPTY_ARRAY)
        .join(' ') || undefined,
    onCheckedChange(_, eventDetails) {
      const uncontrolledState = uncontrolledStateRef.current;
      const values = allValues();

      const none = values.filter(
        (v) => disabledStatesRef.current.get(v) && uncontrolledState.includes(v),
      );
      const all = values.filter(
        (v) => !disabledStatesRef.current.get(v) || uncontrolledState.includes(v),
      );

      const allOnOrOff = uncontrolledState.length === all.length || uncontrolledState.length === 0;

      if (allOnOrOff) {
        if (params.value.length === all.length) {
          onValueChange(none, eventDetails);
        } else {
          onValueChange(all, eventDetails);
        }
        return;
      }

      let nextStatus: 'on' | 'off' | 'mixed' = 'mixed';
      let nextValue = uncontrolledState;

      if (status() === 'mixed') {
        nextStatus = 'on';
        nextValue = all;
      } else if (status() === 'on') {
        nextStatus = 'off';
        nextValue = none;
      }

      onValueChange(nextValue, eventDetails);

      if (!eventDetails.isCanceled) {
        setStatus(nextStatus);
      }
    },
  });

  const getChildProps: UseCheckboxGroupParentReturnValue['getChildProps'] = (
    childValue: string,
  ) => ({
    checked: params.value.includes(childValue),
    onCheckedChange(nextChecked, eventDetails) {
      const newValue = params.value.slice();
      if (nextChecked) {
        newValue.push(childValue);
      } else {
        newValue.splice(newValue.indexOf(childValue), 1);
      }

      onValueChange(newValue, eventDetails);

      if (!eventDetails.isCanceled) {
        uncontrolledStateRef.current = newValue;
        setStatus('mixed');
      }
    },
  });

  return {
    getParentProps,
    getChildProps,
    registerChildId,
    disabledStatesRef,
  };
}

export interface UseCheckboxGroupParentParameters {
  allValues?: string[] | undefined;
  value: string[];
  onValueChange?:
    | ((
        value: string[],
        eventDetails: BaseUIChangeEventDetails<BaseUIEventReasons['none']>,
      ) => void)
    | undefined;
}

export interface UseCheckboxGroupParentReturnValue {
  disabledStatesRef: RefObject<Map<string, boolean>>;
  /**
   * Reports the `id` of the element a child checkbox exposes.
   */
  registerChildId: (value: string, id: string) => () => void;
  /** Call inside a reactive scope. */
  getParentProps: () => {
    indeterminate: boolean;
    checked: boolean;
    'aria-controls': string | undefined;
    onCheckedChange: (
      checked: boolean,
      eventDetails: BaseUIChangeEventDetails<BaseUIEventReasons['none']>,
    ) => void;
  };
  /** Call inside a reactive scope. */
  getChildProps: (value: string) => {
    checked: boolean;
    onCheckedChange: (
      checked: boolean,
      eventDetails: BaseUIChangeEventDetails<BaseUIEventReasons['none']>,
    ) => void;
  };
}
