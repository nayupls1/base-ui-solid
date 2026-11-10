import { useFilterDropdownGroup } from '../../filter-dropdown/group/useFilterDropdownGroup';
import { FilterDropdownGroupContext } from '../../filter-dropdown/group/FilterDropdownGroupContext';
import { MenuGroupPlain } from '../group/MenuGroup';
import type { MenuGroupProps } from '../group/MenuGroup';
import { MenuRadioGroupPlain } from '../radio-group/MenuRadioGroup';
import type { MenuRadioGroupProps } from '../radio-group/MenuRadioGroup';

/**
 * A group in a filterable menu. It hides itself when all of its items are filtered out.
 *
 * @internal
 */
export function MenuFilterGroup(props: MenuGroupProps) {
  const { hidden, context } = useFilterDropdownGroup();

  return (
    <FilterDropdownGroupContext value={context}>
      <MenuGroupPlain {...props} hidden={hidden() || (props as any).hidden || undefined} />
    </FilterDropdownGroupContext>
  );
}

/**
 * A radio group in a filterable menu. It hides itself when all of its items are filtered out.
 *
 * @internal
 */
export function MenuFilterRadioGroup(props: MenuRadioGroupProps) {
  const { hidden, context } = useFilterDropdownGroup();

  return (
    <FilterDropdownGroupContext value={context}>
      <MenuRadioGroupPlain {...props} hidden={hidden() || (props as any).hidden || undefined} />
    </FilterDropdownGroupContext>
  );
}
