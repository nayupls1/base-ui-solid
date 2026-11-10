import { createEffect, omit } from 'solid-js';
import { error } from 'base-ui-solidjs-utils/error';
import { useComboboxRootContext } from '../root/ComboboxRootContext';
import { useFieldRootContext } from '../../internals/field-root-context/FieldRootContext';
import { fieldValidityMapping } from '../../internals/field-constants/constants';
import type { BaseUIComponentProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { useLabel } from '../../internals/labelable-provider/useLabel';
import { getDefaultLabelId } from '../../utils/resolveAriaLabelledBy';
import type { FieldRoot } from '../../field/root/FieldRoot';
import { ownedProps } from '../../internals/ownedProps';

/**
 * An accessible label that is automatically associated with the combobox trigger.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Combobox](https://base-ui.com/react/components/combobox)
 */
export function ComboboxLabel(componentProps: ComboboxLabel.Props) {
  componentProps = ownedProps(componentProps);
  // Keep label id derived from the root and ignore runtime `id` overrides from untyped consumers.
  const elementProps = omit(componentProps, 'render', 'class', 'style', 'id' as any, 'ref');

  const fieldRootContext = useFieldRootContext();
  const store = useComboboxRootContext();

  const inputInsidePopup = store.useState('inputInsidePopup');
  const triggerElement = store.useState('triggerElement');
  const inputElement = store.useState('inputElement');
  const rootId = store.useState('id');

  if (process.env.NODE_ENV !== 'production') {
    createEffect(
      () => [inputElement(), inputInsidePopup()] as const,
      ([input, insidePopup]) => {
        if (!input || insidePopup) {
          return;
        }

        error(
          '<Combobox.Label> labels <Combobox.Trigger> only. ' +
            'When <Combobox.Input> is the form control, use a native <label> or <Field.Label> instead.',
        );
      },
    );
  }

  const labelProps = useLabel({
    get id() {
      return getDefaultLabelId(rootId());
    },
    get fallbackControlId() {
      return (
        (triggerElement() as HTMLElement | null)?.id ?? (inputInsidePopup() ? rootId() : undefined)
      );
    },
    setLabelId(nextLabelId: any) {
      const resolvedLabelId =
        typeof nextLabelId === 'function' ? nextLabelId(store.state.labelId) : nextLabelId;
      store.set('labelId', resolvedLabelId);
    },
  } as any);

  return useRenderElement('div', componentProps, {
    state: () => fieldRootContext.state,
    props: [labelProps, elementProps],
    stateAttributesMapping: fieldValidityMapping as any,
  });
}

export interface ComboboxLabelState extends FieldRoot.State {}

export interface ComboboxLabelProps extends Omit<
  BaseUIComponentProps<'div', ComboboxLabelState>,
  'id'
> {}

export namespace ComboboxLabel {
  export type State = ComboboxLabelState;
  export type Props = ComboboxLabelProps;
}
