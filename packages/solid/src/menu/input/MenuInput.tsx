import { createMemo, omit } from 'solid-js';
import { ownerDocument } from '@base-ui-solid/utils/owner';
import { activeElement } from '@base-ui-solid/utils/shadowDom';
import { FilterDropdownInput } from '../../filter-dropdown/input/FilterDropdownInput';
import type {
  FilterDropdownInputProps,
  FilterDropdownInputState,
} from '../../filter-dropdown/input/FilterDropdownInput';
import { useFilterDropdownValueContext } from '../../filter-dropdown/root/FilterDropdownRootContext';
import { reactiveMergeProps } from '../../internals/reactiveMergeProps';
import { useMenuFilterKeyDown } from '../filter-root/useMenuFilterKeyDown';
import { useMenuFilterPart } from '../filter-root/MenuFilterContext';
import { useMenuRootContext } from '../root/MenuRootContext';
import { assignRefs, type RefInput } from '../../internals/useRenderElement';

/**
 * A search field that filters the menu items.
 * Requires the menu to be wrapped in `Menu.FilterProvider`.
 * Renders an `<input>` element.
 *
 * Documentation: [Base UI Menu](https://base-ui.com/react/components/menu)
 */
export function MenuInput(componentProps: MenuInput.Props) {
  useMenuFilterPart('Input');
  const { store } = useMenuRootContext();
  const value = useFilterDropdownValueContext();

  const inputPropsState = store.useState('inputProps');
  const navigationProps = createMemo(() => omit(inputPropsState() as any, 'onKeyDown'));
  const activeItemId = store.useState('highlightedItemId');

  const handleKeyDown = useMenuFilterKeyDown(() => value() !== '');
  const handleInputRef = (input: HTMLInputElement | null) => {
    // Ref changes cover input removal without blur.
    store.set('inputFocused', input !== null && activeElement(ownerDocument(input)) === input);
  };

  const inputProps = reactiveMergeProps(
    {
      onKeyDown: handleKeyDown,
      onFocus() {
        store.set('inputFocused', true);
      },
      onBlur() {
        store.set('inputFocused', false);
      },
    } as any,
    omit(componentProps, 'ref') as any,
  );

  return (
    <FilterDropdownInput
      {...(inputProps as any)}
      activeItemId={activeItemId() as string | undefined}
      navigationProps={navigationProps()}
      ref={(el: HTMLInputElement | null) => {
        assignRefs(componentProps.ref as RefInput<HTMLInputElement | null>, el);
        handleInputRef(el);
      }}
    />
  );
}

export interface MenuInputState extends FilterDropdownInputState {}
export interface MenuInputProps extends FilterDropdownInputProps {}

export namespace MenuInput {
  export type State = MenuInputState;
  export type Props = MenuInputProps;
}
