import { createEffect, onCleanup } from 'solid-js';
import type { RefObject } from 'base-ui-solidjs-utils/types';
import { getCombinedFieldValidityData } from '../../field/utils/getCombinedFieldValidityData';
import { useFormContext } from '../form-context/FormContext';
import type { FieldValidityData } from '../../field/root/FieldRoot';

type SetStateAction<T> = T | ((prev: T) => T);

export interface FieldControlRegistration {
  controlRef: RefObject<any>;
  id: string | undefined;
  name?: string | undefined;
  getValue?: (() => unknown) | undefined;
  value: unknown;
}

/**
 * Parameters are read lazily, so they can be getters.
 */
export function useFieldControlRegistration(params: UseFieldControlRegistrationParameters) {
  const { formRef } = useFormContext();

  let activeFieldControlSource: symbol | null = null;
  let registration: FieldControlRegistration | null = null;
  let initialValueCaptured = false;

  const getValueForForm = () => {
    if (!registration) {
      return undefined;
    }

    if (registration.getValue) {
      return registration.getValue();
    }

    return registration.value;
  };

  function getRegistrationValue(current: FieldControlRegistration) {
    return current.value === undefined ? getValueForForm() : current.value;
  }

  const validate = () => {
    params.markedDirtyRef.current = true;

    if (!registration) {
      params.commit(params.validityData.value);
      return;
    }

    params.commit(getRegistrationValue(registration));
  };

  function refreshRegistration() {
    if (!registration || !registration.id) {
      return;
    }

    formRef.current.fields.set(registration.id, {
      getValue: getValueForForm,
      name: params.name ?? registration.name,
      controlRef: registration.controlRef,
      validityData: getCombinedFieldValidityData(params.validityData, params.invalid),
      validate,
    });
  }

  function deleteRegistration(id = registration?.id) {
    if (id) {
      formRef.current.fields.delete(id);
    }
  }

  function captureInitialValue(current: FieldControlRegistration) {
    if (initialValueCaptured) {
      return;
    }

    initialValueCaptured = true;
    const initialValue = getRegistrationValue(current);

    params.setValidityData((prev) =>
      prev.initialValue === initialValue ? prev : { ...prev, initialValue },
    );
  }

  createEffect(
    () => [params.invalid, params.name, params.validityData] as const,
    ([invalid, name, validityData]) => {
      if (!registration || !registration.id) {
        return;
      }

      params.setRegisteredFieldName(name ? undefined : registration.name);

      formRef.current.fields.set(registration.id, {
        getValue: getValueForForm,
        name: name ?? registration.name,
        controlRef: registration.controlRef,
        validityData: getCombinedFieldValidityData(validityData, invalid),
        validate,
      });
    },
  );

  const fields = formRef.current.fields;
  onCleanup(() => {
    const id = registration?.id;
    if (id) {
      fields.delete(id);
    }
  });

  const register = (source: symbol, nextRegistration: FieldControlRegistration | undefined) => {
    if (!nextRegistration) {
      if (activeFieldControlSource === source) {
        activeFieldControlSource = null;
        params.change(undefined, true);
        deleteRegistration();
        registration = null;
        params.setRegisteredFieldName(undefined);
        params.registeredFieldIdRef.current = undefined;
      }
      return;
    }

    const previousId = registration?.id;
    const previousSource = activeFieldControlSource;

    if (previousSource && previousSource !== source) {
      params.change(undefined, true);
    }

    activeFieldControlSource = source;
    registration = nextRegistration;
    if (!params.name) {
      params.setRegisteredFieldName(nextRegistration.name);
    }
    params.registeredFieldIdRef.current = nextRegistration.id;

    if (previousId && previousId !== nextRegistration.id) {
      deleteRegistration(previousId);
    }

    captureInitialValue(nextRegistration);
    refreshRegistration();
  };

  return [validate, register] as const;
}

export interface UseFieldControlRegistrationParameters {
  change: (value: unknown, cancelPending?: boolean) => void;
  commit: (value: unknown) => void;
  invalid: boolean;
  markedDirtyRef: RefObject<boolean>;
  name: string | undefined;
  setRegisteredFieldName: (name: string | undefined) => void;
  registeredFieldIdRef: RefObject<string | undefined>;
  setValidityData: (value: SetStateAction<FieldValidityData>) => void;
  validityData: FieldValidityData;
}
