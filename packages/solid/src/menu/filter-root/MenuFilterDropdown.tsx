import type { JSX } from '@solidjs/web';
import { createEffect, untrack } from 'solid-js';
import { useControlled } from 'base-ui-solidjs-utils/useControlled';
import { useMenubarContext } from '../../menubar/MenubarContext';
import { isVirtualPointerEvent } from '../../utils/popups/event';
import { FilterDropdownRoot } from '../../filter-dropdown/root/FilterDropdownRoot';
import { useFilterDropdownCloseQuery } from '../../filter-dropdown/root/useFilterDropdownCloseQuery';
import type { FilterDropdownFilter } from '../../filter-dropdown/root/FilterDropdownRootContext';
import { useMenuRootContext } from '../root/MenuRootContext';
import { REASONS } from '../../internals/reasons';
import type { BaseUIEvent, HTMLProps } from '../../internals/types';
import type { MenuFilterProvider } from '../filter-provider/MenuFilterProvider';
import { MenuFilterImplContext } from './MenuFilterContext';
import { MENU_FILTER_IMPL } from './MenuFilterImpl';
import { useMenuFilterKeyDown } from './useMenuFilterKeyDown';

export interface MenuFilterDropdownProps {
  value: string | undefined;
  defaultValue: string | undefined;
  onValueChange: MenuFilterProvider.Props['onValueChange'];
  filter: FilterDropdownFilter | null | undefined;
  autoHighlight: boolean | 'always';
  locale: Intl.LocalesArgument | undefined;
  children?: JSX.Element;
}

/**
 * Connects a filterable menu root to the filter: owns the query and hands the filter the
 * menu's list and highlight.
 *
 * @internal
 */
export function MenuFilterDropdown(props: MenuFilterDropdownProps) {
  const { store } = useMenuRootContext();

  const open = store.useState('open');
  const mounted = store.useState('mounted');
  const keyboardOpen = store.useState('keyboardOpen');
  const activeTriggerId = store.useState('activeTriggerId');
  const activeTriggerElement = store.useState('activeTriggerElement');
  const disabled = store.useState('disabled');

  const [value, setValue] = useControlled<string>({
    controlled: () => props.value,
    default: untrack(() => props.defaultValue) ?? '',
    name: 'MenuFilterProvider',
    state: 'value',
  });

  const handleValueChange = (
    nextValue: string,
    eventDetails: MenuFilterProvider.ChangeEventDetails,
  ) => {
    untrack(() => props.onValueChange)?.(nextValue, eventDetails);
    if (!eventDetails.isCanceled) {
      setValue(nextValue);
    }
  };

  const getActiveIndex = () => store.state.activeIndex;
  const setActiveIndex = (index: number | null) => {
    store.setActiveIndex(index, REASONS.none);
  };

  const query = useFilterDropdownCloseQuery({
    get open() {
      return open();
    },
    get mounted() {
      return mounted();
    },
    get value() {
      return value();
    },
    onValueChange: handleValueChange,
  });

  const filterTriggerProps = useFilterTriggerProps(() => value() !== '');
  // Seeded before the triggers below render, like the root's inactive trigger props.
  store.set('filterTriggerProps', filterTriggerProps);

  // Only `setOpen` records a keyboard open, so a controlled close that bypasses it must not leave
  // the next programmatic open looking like one.
  createEffect(open, (isOpen) => {
    if (!isOpen) {
      store.set('keyboardOpen', false);
    }
  });

  // Trust the rendered element's id once it exists: an explicitly empty id must not fall back to a
  // registered id that no element carries.
  const triggerId = () => {
    const element = activeTriggerElement();
    return element ? element.id || null : activeTriggerId();
  };

  return (
    <MenuFilterImplContext value={MENU_FILTER_IMPL}>
      <FilterDropdownRoot
        filter={props.filter}
        autoHighlight={props.autoHighlight}
        locale={props.locale}
        open={open()}
        openedByKeyboard={keyboardOpen()}
        disabled={disabled()}
        value={value()}
        query={query()}
        onValueChange={handleValueChange}
        triggerId={triggerId()}
        listRef={store.context.itemDomElements}
        getActiveIndex={getActiveIndex}
        setActiveIndex={setActiveIndex}
        focusOwnerRef={store.context.virtualFocusRef}
      >
        {props.children}
      </FilterDropdownRoot>
    </MenuFilterImplContext>
  );
}

function useFilterTriggerProps(hasValue: () => boolean): HTMLProps {
  const { store } = useMenuRootContext();
  const isInMenubar = useMenubarContext(true) != null;

  const handleInputKeyDown = useMenuFilterKeyDown(hasValue);

  return {
    'aria-haspopup': 'dialog',
    onPointerDown(event: PointerEvent) {
      store.context.virtualPress = isVirtualPointerEvent(event);
    },
    onKeyDown(event: BaseUIEvent<KeyboardEvent>) {
      const focusOwner = store.context.virtualFocusRef?.current;
      if (!store.select('open') || !focusOwner || isInMenubar) {
        return;
      }

      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        focusOwner.focus({ preventScroll: true });
        handleInputKeyDown(event);
        event.preventDefault();
        event.preventBaseUIHandler();
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        // Cross-axis keys drive submenu open/close, which the trigger must not relay.
        event.preventBaseUIHandler();
      } else if (isTypeaheadKey(event)) {
        focusOwner.focus({ preventScroll: true });
      }
    },
  } as any;
}

function isTypeaheadKey(event: KeyboardEvent) {
  return (
    event.key.length === 1 && event.key !== ' ' && !event.ctrlKey && !event.metaKey && !event.altKey
  );
}
