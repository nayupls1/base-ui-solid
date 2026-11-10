import { createMemo, omit } from 'solid-js';
import { contains } from '@base-ui-solid/utils/shadowDom';
import type { BaseUIComponentProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { useComboboxRootContext } from '../root/ComboboxRootContext';
import { useFieldRootContext } from '../../internals/field-root-context/FieldRootContext';
import type { FieldRoot, FieldRootState } from '../../field/root/FieldRoot';
import { triggerStateAttributesMapping } from '../utils/stateAttributesMapping';
import { handleInputPress } from '../utils/handleInputPress';
import type { Side } from '../../internals/useAnchorPositioning';
import { useListEmpty, usePopupSide } from '../utils/parts';
import { ownedProps } from '../../internals/ownedProps';

/**
 * A wrapper for the input and its associated controls.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Combobox](https://base-ui.com/react/components/combobox)
 */
export function ComboboxInputGroup(componentProps: ComboboxInputGroup.Props) {
  componentProps = ownedProps(componentProps);
  const elementProps = omit(componentProps, 'render', 'class', 'style', 'children', 'ref');

  const field = useFieldRootContext();
  const store = useComboboxRootContext();

  const open = store.useState('open');
  const comboboxDisabled = store.useState('disabled');
  const readOnly = store.useState('readOnly');
  const hasSelectedValue = store.useState('hasSelectedValue');
  const selectionMode = store.useState('selectionMode');

  const popupSide = usePopupSide(store);
  const listEmpty = useListEmpty();

  const state = createMemo<ComboboxInputGroup.State>(() => ({
    ...field.state,
    open: open(),
    disabled: comboboxDisabled(),
    readOnly: readOnly(),
    popupSide: popupSide(),
    listEmpty: listEmpty(),
    placeholder: selectionMode() === 'none' ? false : !hasSelectedValue(),
  }));

  const setInputGroupElement = store.useStateSetter('inputGroupElement');

  return useRenderElement('div', componentProps, {
    ref: setInputGroupElement as any,
    props: [
      {
        role: 'group',
        onMouseDown(event: MouseEvent) {
          handleInputPress(event, store, store.state.disabled, (target) => {
            return contains(store.context.chipsContainerRef.current, target);
          });
        },
      },
      elementProps,
    ],
    state,
    stateAttributesMapping: triggerStateAttributesMapping as any,
  });
}

export interface ComboboxInputGroupState extends FieldRoot.State {
  /**
   * Whether the corresponding popup is open.
   */
  open: boolean;
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
  /**
   * Whether the component should ignore user edits.
   */
  readOnly: boolean;
  /**
   * Indicates which side the corresponding popup is positioned relative to its anchor.
   */
  popupSide: Side | null;
  /**
   * Present when the corresponding items list is empty.
   */
  listEmpty: boolean;
  /**
   * Whether the combobox doesn't have a value.
   */
  placeholder: boolean;
}

export interface ComboboxInputGroupProps extends BaseUIComponentProps<
  'div',
  ComboboxInputGroup.State
> {}

export namespace ComboboxInputGroup {
  export type State = ComboboxInputGroupState;
  export type Props = ComboboxInputGroupProps;
}
