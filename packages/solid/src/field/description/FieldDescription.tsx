import { createEffect, omit } from 'solid-js';
import type { FieldRootState } from '../root/FieldRoot';
import { useFieldRootContext } from '../../internals/field-root-context/FieldRootContext';
import { useLabelableContext } from '../../internals/labelable-provider/LabelableContext';
import { fieldValidityMapping } from '../../internals/field-constants/constants';
import type { BaseUIComponentProps } from '../../internals/types';
import { useBaseUiId } from '../../internals/useBaseUiId';
import { useRenderElement } from '../../internals/useRenderElement';
import { useFieldItemContext } from '../item/FieldItemContext';
import { ownedProps } from '../../internals/ownedProps';

/**
 * A paragraph with additional information about the field.
 * Renders a `<p>` element.
 *
 * Documentation: [Base UI Field](https://base-ui.com/react/components/field)
 */
export function FieldDescription(componentProps: FieldDescription.Props) {
  componentProps = ownedProps(componentProps);
  const elementProps = omit(componentProps, 'render', 'id', 'class', 'style', 'children', 'ref');

  const id = useBaseUiId(() => componentProps.id);

  const fieldRootContext = useFieldRootContext(false);
  const fieldItemContext = useFieldItemContext();
  const labelable = useLabelableContext();

  const state = (): FieldDescriptionState => ({
    ...fieldRootContext.state,
    disabled: Boolean(fieldRootContext.disabled || fieldItemContext.disabled),
  });

  createEffect(id, (currentId) => {
    if (!currentId) {
      return undefined;
    }

    labelable.setMessageIds((v) => v.concat(currentId));

    return () => {
      labelable.setMessageIds((v) => v.filter((item) => item !== currentId));
    };
  });

  return useRenderElement('p', componentProps, {
    state,
    props: [
      {
        get id() {
          return id();
        },
      },
      elementProps,
    ],
    stateAttributesMapping: fieldValidityMapping,
  });
}

export interface FieldDescriptionState extends FieldRootState {}

export interface FieldDescriptionProps extends BaseUIComponentProps<'p', FieldDescriptionState> {}

export namespace FieldDescription {
  export type State = FieldDescriptionState;
  export type Props = FieldDescriptionProps;
}
