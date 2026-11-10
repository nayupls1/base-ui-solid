import { omit, untrack } from 'solid-js';
import type { FieldRootState } from '../root/FieldRoot';
import { useFieldRootContext } from '../../internals/field-root-context/FieldRootContext';
import { fieldValidityMapping } from '../../internals/field-constants/constants';
import type { BaseUIComponentProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { FieldItemContext } from './FieldItemContext';
import { LabelableProvider } from '../../internals/labelable-provider';
import { ownedProps } from '../../internals/ownedProps';

/**
 * Groups individual items in a checkbox group or radio group with a label and description.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Field](https://base-ui.com/react/components/field)
 */
export function FieldItem(componentProps: FieldItem.Props) {
  componentProps = ownedProps(componentProps);
  const elementProps = omit(componentProps, 'render', 'class', 'style', 'disabled', 'children', 'ref');

  const fieldRootContext = useFieldRootContext(false);

  const disabled = () => Boolean(fieldRootContext.disabled || (componentProps.disabled ?? false));
  const state = (): FieldItemState => ({ ...fieldRootContext.state, disabled: disabled() });

  const fieldItemContext: FieldItemContext = {
    get disabled() {
      return disabled();
    },
  };

  return (
    <LabelableProvider>
      <FieldItemContext value={fieldItemContext}>
        {untrack(() =>
          useRenderElement('div', componentProps, {
            state,
            props: elementProps,
            stateAttributesMapping: fieldValidityMapping,
          }),
        )}
      </FieldItemContext>
    </LabelableProvider>
  );
}


export interface FieldItemState extends FieldRootState {}

export interface FieldItemProps extends BaseUIComponentProps<'div', FieldItemState> {
  /**
   * Whether the wrapped control should ignore user interaction.
   * The `disabled` prop on `<Field.Root>` takes precedence over this.
   * @default false
   */
  disabled?: boolean | undefined;
}

export namespace FieldItem {
  export type State = FieldItemState;
  export type Props = FieldItemProps;
}
