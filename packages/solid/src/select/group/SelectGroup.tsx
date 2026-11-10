import { createSignal, omit, untrack } from 'solid-js';
import type { BaseUIComponentProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { SelectGroupContext } from './SelectGroupContext';
import { ownedProps } from '../../internals/ownedProps';

/**
 * Groups related select items with the corresponding label.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Select](https://base-ui.com/react/components/select)
 */
export function SelectGroup(componentProps: SelectGroup.Props) {
  componentProps = ownedProps(componentProps);
  const elementProps = omit(componentProps, 'render', 'class', 'style', 'ref');

  const [labelId, setLabelId] = createSignal<string | undefined>(undefined, { ownedWrite: true });

  const contextValue: SelectGroupContext = {
    get labelId() {
      return labelId();
    },
    setLabelId: setLabelId as SelectGroupContext['setLabelId'],
  };

  return (
    <SelectGroupContext value={contextValue}>
      {untrack(() =>
        useRenderElement('div', componentProps, {
          props: [
            {
              role: 'group',
              get 'aria-labelledby'() {
                return labelId();
              },
            },
            elementProps,
          ],
        }),
      )}
    </SelectGroupContext>
  );
}

export interface SelectGroupState {}

export interface SelectGroupProps extends BaseUIComponentProps<'div', SelectGroupState> {}

export namespace SelectGroup {
  export type State = SelectGroupState;
  export type Props = SelectGroupProps;
}
