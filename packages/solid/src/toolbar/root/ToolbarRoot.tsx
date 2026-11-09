import { createMemo, omit } from 'solid-js';
import { createSyncSignal } from '@base-ui-solid/utils/createSyncSignal';
import type {
  BaseUIComponentProps,
  Orientation as BaseOrientation,
  HTMLProps,
} from '../../internals/types';
import { CompositeRoot } from '../../internals/composite/root/CompositeRoot';
import type { CompositeMetadata } from '../../internals/composite/list/CompositeList';
import { ToolbarRootContext } from './ToolbarRootContext';

/**
 * A container for grouping a set of controls, such as buttons, toggle groups, or menus.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Toolbar](https://base-ui.com/react/components/toolbar)
 */
export function ToolbarRoot(componentProps: ToolbarRoot.Props) {
  const elementProps = omit(
    componentProps,
    'disabled',
    'loopFocus',
    'orientation',
    'class',
    'render',
    'style',
    'children',
    'ref',
  );

  const disabled = () => componentProps.disabled ?? false;
  const orientation = () => componentProps.orientation ?? 'horizontal';

  const [itemMap, setItemMap] = createSyncSignal(
    new Map<Node, CompositeMetadata<ToolbarRoot.ItemMetadata>>(),
  );

  const disabledIndices = createMemo(() => {
    const output: number[] = [];
    for (const itemMetadata of itemMap().values()) {
      if (itemMetadata.disabled && !itemMetadata.focusableWhenDisabled) {
        output.push(itemMetadata.index);
      }
    }
    return output;
  });

  const toolbarRootContext: ToolbarRootContext = {
    get disabled() {
      return disabled();
    },
    get orientation() {
      return orientation();
    },
  };

  const state = (): ToolbarRootState => ({ disabled: disabled(), orientation: orientation() });

  const defaultProps: HTMLProps = {
    get 'aria-orientation'() {
      return orientation();
    },
    role: 'toolbar',
  };

  return (
    <ToolbarRootContext value={toolbarRootContext}>
      <CompositeRoot
        render={componentProps.render}
        class={componentProps.class}
        style={componentProps.style}
        state={state()}
        refs={[componentProps.ref]}
        props={[defaultProps, elementProps]}
        disabledIndices={disabledIndices()}
        loopFocus={componentProps.loopFocus}
        onMapChange={(map: any) => {
          setItemMap(map);
        }}
        orientation={orientation()}
      >
        {componentProps.children}
      </CompositeRoot>
    </ToolbarRootContext>
  );
}

type ToolbarRootContext = import('./ToolbarRootContext').ToolbarRootContext;

export interface ToolbarRootItemMetadata {
  disabled: boolean;
  focusableWhenDisabled: boolean;
}

export type ToolbarRootOrientation = BaseOrientation;

export interface ToolbarRootState {
  disabled: boolean;
  orientation: ToolbarRoot.Orientation;
}

export interface ToolbarRootProps extends BaseUIComponentProps<'div', ToolbarRootState> {
  /**
   * Whether the toolbar should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * The orientation of the toolbar.
   * @default 'horizontal'
   */
  orientation?: ToolbarRoot.Orientation | undefined;
  /**
   * If `true`, using keyboard navigation will wrap focus to the other end of the toolbar once the end is reached.
   *
   * @default true
   */
  loopFocus?: boolean | undefined;
}

export namespace ToolbarRoot {
  export type ItemMetadata = ToolbarRootItemMetadata;
  export type Orientation = ToolbarRootOrientation;
  export type State = ToolbarRootState;
  export type Props = ToolbarRootProps;
}
