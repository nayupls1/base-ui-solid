import { createMemo } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { useFieldRootContext } from '../../internals/field-root-context/FieldRootContext';
import { getCombinedFieldValidityData } from '../utils/getCombinedFieldValidityData';
import type { FieldValidityData } from '../root/FieldRoot';
import { useTransitionStatus } from '../../internals/useTransitionStatus';
import type { TransitionStatus } from '../../internals/useTransitionStatus';
import { ownedProps } from '../../internals/ownedProps';

/**
 * Used to display a custom message based on the field's validity.
 * Requires `children` to be a function that accepts field validity state as an argument.
 * The state argument is reactive: read its properties inside JSX.
 *
 * Documentation: [Base UI Field](https://base-ui.com/react/components/field)
 */
export function FieldValidity(props: FieldValidity.Props) {
  props = ownedProps(props);
  const fieldRootContext = useFieldRootContext(false);

  const combinedFieldValidityData = createMemo(() =>
    getCombinedFieldValidityData(fieldRootContext.validityData, fieldRootContext.invalid),
  );
  const isInvalid = () => combinedFieldValidityData().state.valid === false;
  const { transitionStatus } = useTransitionStatus(isInvalid);

  const fieldValidityState = createMemo<FieldValidityState>(() => {
    const data = combinedFieldValidityData();
    return {
      ...data,
      validity: data.state,
      transitionStatus: transitionStatus(),
    };
  });

  const state = new Proxy({} as FieldValidityState, {
    get(_target, key) {
      return (fieldValidityState() as any)[key];
    },
    ownKeys() {
      return Reflect.ownKeys(fieldValidityState());
    },
    getOwnPropertyDescriptor(_target, key) {
      return { configurable: true, enumerable: true, value: (fieldValidityState() as any)[key] };
    },
  });

  return <>{props.children(state)}</>;
}

export interface FieldValidityState extends Omit<FieldValidityData, 'state'> {
  /**
   * The validity state.
   */
  validity: FieldValidityData['state'];
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
}

export interface FieldValidityProps {
  /**
   * A function that accepts the field validity state as an argument.
   *
   * ```jsx
   * <Field.Validity>
   *   {(validity) => {
   *     return <div>...</div>
   *   }}
   * </Field.Validity>
   * ```
   */
  children: (state: FieldValidityState) => JSX.Element;
}

export namespace FieldValidity {
  export type State = FieldValidityState;
  export type Props = FieldValidityProps;
}
