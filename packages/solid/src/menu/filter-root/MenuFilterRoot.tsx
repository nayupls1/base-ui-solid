import type { JSX } from '@solidjs/web';
import { MenuRootInternal } from '../root/MenuRoot';
import type { MenuRoot } from '../root/MenuRoot';
import type { MenuFilterProviderOptions } from '../filter-provider/MenuFilterProviderOptions';
import { MenuFilterDropdown } from './MenuFilterDropdown';
import { useMenuFilterRoot } from './useMenuFilterRoot';

/**
 * A `Menu.Root` whose items are filtered by a `Menu.Input`.
 *
 * The filter sits inside the root's payload render function, as upstream does, so a change of
 * payload (a detached trigger with a different payload opening) recreates the filter state.
 *
 * @internal
 */
export function MenuFilterRoot<Payload>(props: MenuFilterRootProps<Payload>): JSX.Element {
  const { rootProps, dropdownProps } = useMenuFilterRoot(props);

  return (
    <MenuRootInternal {...(rootProps as any)}>
      {(arg: { payload: Payload | undefined }) => (
        <MenuFilterDropdown {...dropdownProps}>
          {(() => {
            const children = props.children;
            return typeof children === 'function' ? (children as any)(arg) : children;
          })()}
        </MenuFilterDropdown>
      )}
    </MenuRootInternal>
  );
}

export type MenuFilterRootProps<Payload = unknown> = MenuRoot.Props<Payload> &
  MenuFilterProviderOptions;
