import { omit } from 'solid-js';
import { useSelectRootContext } from '../root/SelectRootContext';
import { useFieldRootContext } from '../../internals/field-root-context/FieldRootContext';
import { fieldValidityMapping } from '../../internals/field-constants/constants';
import type { BaseUIComponentProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { useLabel } from '../../internals/labelable-provider/useLabel';
import { getDefaultLabelId } from '../../utils/resolveAriaLabelledBy';
import type { FieldRoot } from '../../field/root/FieldRoot';
import { ownedProps } from '../../internals/ownedProps';

/**
 * An accessible label that is automatically associated with the select trigger.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Select](https://base-ui.com/react/components/select)
 */
export function SelectLabel(componentProps: SelectLabel.Props) {
  componentProps = ownedProps(componentProps);
  const elementProps = omit(componentProps, 'render', 'class', 'style', 'id' as any, 'ref');

  const fieldRootContext = useFieldRootContext();
  const store = useSelectRootContext();
  const triggerElement = store.useState('triggerElement');
  const rootId = store.useState('id');

  const labelProps = useLabel({
    get id() {
      return getDefaultLabelId(rootId());
    },
    get fallbackControlId() {
      return triggerElement()?.id ?? rootId();
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

export type SelectLabelState = FieldRoot.State;

export interface SelectLabelProps extends Omit<
  BaseUIComponentProps<'div', SelectLabel.State>,
  'id'
> {}

export namespace SelectLabel {
  export type State = SelectLabelState;
  export type Props = SelectLabelProps;
}
