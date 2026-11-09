import { createEffect, createMemo, For, omit, untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { createSyncSignal } from '@base-ui-solid/utils/createSyncSignal';
import type { FieldRootState } from '../root/FieldRoot';
import { useFieldRootContext } from '../../internals/field-root-context/FieldRootContext';
import { useLabelableContext } from '../../internals/labelable-provider/LabelableContext';
import { fieldValidityMapping } from '../../internals/field-constants/constants';
import { useFormContext } from '../../internals/form-context/FormContext';
import type { BaseUIComponentProps } from '../../internals/types';
import type { StateAttributesMapping } from '../../internals/getStateAttributesProps';
import { useRenderElement } from '../../internals/useRenderElement';
import { useBaseUiId } from '../../internals/useBaseUiId';
import { useOpenChangeComplete } from '../../internals/useOpenChangeComplete';
import { transitionStatusMapping } from '../../internals/stateAttributesMapping';
import { useTransitionStatus } from '../../internals/useTransitionStatus';
import type { TransitionStatus } from '../../internals/useTransitionStatus';
import { ownedProps } from '../../internals/ownedProps';

const stateAttributesMapping: StateAttributesMapping<FieldErrorState> = {
  ...fieldValidityMapping,
  ...transitionStatusMapping,
};

/**
 * An error message displayed if the field control fails validation.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Field](https://base-ui.com/react/components/field)
 */
export function FieldError(componentProps: FieldError.Props) {
  componentProps = ownedProps(componentProps);
  const elementProps = omit(
    componentProps,
    'render',
    'id',
    'class',
    'match',
    'style',
    'children',
    'ref',
  );

  const id = useBaseUiId(() => componentProps.id);

  const fieldRootContext = useFieldRootContext(false);
  const labelable = useLabelableContext();
  const formContext = useFormContext();

  const formError = () => {
    const name = fieldRootContext.name;
    const errors = formContext.errors;
    return name && Object.hasOwn(errors, name) ? errors[name] : null;
  };
  const hasFormError = () => {
    const error = formError();
    return !!(Array.isArray(error) ? error.length : error);
  };
  const hasSpecificMatch = () => typeof componentProps.match === 'string';

  const rendered = createMemo(() => {
    const match = componentProps.match;
    if (match === true) {
      return true;
    }
    if (fieldRootContext.state.disabled) {
      return false;
    }
    if (typeof match === 'string') {
      return Boolean((fieldRootContext.validityData.state as any)[match]);
    }
    return hasFormError() || fieldRootContext.validityData.state.valid === false;
  });

  const { mounted, transitionStatus, setMounted } = useTransitionStatus(rendered);

  createEffect(
    () => [rendered(), id()] as const,
    ([isRendered, currentId]) => {
      if (!isRendered || !currentId) {
        return undefined;
      }

      labelable.setMessageIds((v) => v.concat(currentId));

      return () => {
        labelable.setMessageIds((v) => v.filter((item) => item !== currentId));
      };
    },
  );

  let errorElement: HTMLDivElement | null = null;

  const error = createMemo<string | string[] | null | undefined>(() => {
    const validityData = fieldRootContext.validityData;
    if (!hasSpecificMatch() && hasFormError()) {
      return formError();
    }
    if (validityData.errors.length > 1) {
      return validityData.errors;
    }
    return validityData.error;
  });

  const renderError = (value: string | string[] | null | undefined): JSX.Element => {
    if (Array.isArray(value)) {
      return value.length > 1 ? (
        <ul>
          <For each={value}>{(message) => <li>{message}</li>}</For>
        </ul>
      ) : (
        value[0]
      );
    }
    return value;
  };

  // Keep showing the last message while the error animates out.
  const [lastRenderedError, setLastRenderedError] = createSyncSignal<
    string | string[] | null | undefined
  >(untrack(() => (rendered() ? error() : null)));

  createEffect(
    () => [rendered(), error()] as const,
    ([isRendered, currentError]) => {
      if (isRendered) {
        setLastRenderedError(currentError);
      }
    },
  );

  useOpenChangeComplete({
    get open() {
      return rendered();
    },
    ref: () => errorElement,
    onComplete() {
      if (!rendered()) {
        setMounted(false);
      }
    },
  });

  const state = (): FieldErrorState => ({
    ...fieldRootContext.state,
    transitionStatus: transitionStatus(),
  });

  return useRenderElement('div', componentProps, {
    ref: (el: HTMLDivElement | null) => {
      errorElement = el;
    },
    state,
    props: [
      {
        get id() {
          return id();
        },
      },
      elementProps,
    ],
    children: () =>
      componentProps.children ?? renderError(rendered() ? error() : lastRenderedError()),
    stateAttributesMapping,
    enabled: mounted,
  });
}

export interface FieldErrorState extends FieldRootState {
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
}

export interface FieldErrorProps extends BaseUIComponentProps<'div', FieldErrorState> {
  /**
   * Determines whether to show the error message according to the field's
   * [ValidityState](https://developer.mozilla.org/en-US/docs/Web/API/ValidityState).
   * Specifying `true` will always show the error message, and lets external libraries
   * control the visibility.
   */
  match?: boolean | keyof ValidityState | undefined;
}

export namespace FieldError {
  export type State = FieldErrorState;
  export type Props = FieldErrorProps;
}
