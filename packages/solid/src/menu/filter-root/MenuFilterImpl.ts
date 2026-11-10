import { MenuFilterPopup } from './MenuFilterPopup';
import { MenuFilterList } from './MenuFilterList';
import { MenuFilterGroup, MenuFilterRadioGroup } from './MenuFilterGroup';
import { useFilterDropdownItem } from '../../filter-dropdown/item/useFilterDropdownItem';
import { useMenuFilterSubmenuTrigger } from './useMenuFilterSubmenuTrigger';
import { useVirtualFocusParentHandoff } from './useVirtualFocusParentHandoff';
import type { MenuFilterImpl } from './MenuFilterContext';

/**
 * The filter implementation a filterable menu root hands to the parts below it.
 */
export const MENU_FILTER_IMPL: MenuFilterImpl = {
  Popup: MenuFilterPopup,
  List: MenuFilterList,
  Group: MenuFilterGroup,
  RadioGroup: MenuFilterRadioGroup,
  useItem: useFilterDropdownItem as MenuFilterImpl['useItem'],
  useSubmenuTrigger: useMenuFilterSubmenuTrigger,
  useParentHandoff: useVirtualFocusParentHandoff,
};
