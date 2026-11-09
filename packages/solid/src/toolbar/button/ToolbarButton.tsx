import { createMemo, omit } from 'solid-js';
import { EMPTY_OBJECT } from '@base-ui-solid/utils/empty';
import type { BaseUIComponentProps, NativeButtonProps } from '../../internals/types';
import { useButton } from '../../internals/use-button';
import type { ToolbarRootState } from '../root/ToolbarRoot';
import { useToolbarRootContext } from '../root/ToolbarRootContext';
import { useToolbarGroupContext } from '../group/ToolbarGroupContext';
import { CompositeItem } from '../../internals/composite/item/CompositeItem';
import { ownedProps } from '../../internals/ownedProps';

/**
 * A button that can be used as-is or as a trigger for other components.
 * Renders a `<button>` element.
 *
 * Documentation: [Base UI Toolbar](https://base-ui.com/react/components/toolbar)
 */
export function ToolbarButton(componentProps: ToolbarButton.Props) {
  componentProps = ownedProps(componentProps);
  const elementProps = omit(
    componentProps,
    'class',
    'disabled',
    'focusableWhenDisabled',
    'render',
    'nativeButton',
    'style',
    'children',
    'ref',
  );

  const rootContext = useToolbarRootContext();
  const groupContext = useToolbarGroupContext();

  const focusableWhenDisabled = () => componentProps.focusableWhenDisabled ?? true;
  const disabled = () =>
    rootContext.disabled || (groupContext?.disabled ?? false) || (componentProps.disabled ?? false);

  const itemMetadata = createMemo(() => ({
    disabled: disabled(),
    focusableWhenDisabled: focusableWhenDisabled(),
  }));

  const { getButtonProps, buttonRef } = useButton({
    get disabled() {
      return disabled();
    },
    get focusableWhenDisabled() {
      return focusableWhenDisabled();
    },
    get native() {
      return componentProps.nativeButton;
    },
  });

  const state = (): ToolbarButtonState => ({
    disabled: disabled(),
    orientation: rootContext.orientation,
    focusable: focusableWhenDisabled(),
  });

  const hasRender = 'render' in componentProps;

  return (
    <CompositeItem
      tag="button"
      render={componentProps.render}
      class={componentProps.class}
      style={componentProps.style}
      metadata={itemMetadata()}
      state={state()}
      refs={[componentProps.ref, buttonRef]}
      props={[
        elementProps,
        hasRender
          ? {
              get disabled() {
                return disabled();
              },
            }
          : EMPTY_OBJECT,
        getButtonProps,
      ]}
    >
      {componentProps.children}
    </CompositeItem>
  );
}

export interface ToolbarButtonState extends ToolbarRootState {
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
  focusable: boolean;
}

export interface ToolbarButtonProps
  extends NativeButtonProps, BaseUIComponentProps<'button', ToolbarButtonState> {
  /**
   * When `true` the item is disabled.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * When `true` the item remains focuseable when disabled.
   * @default true
   */
  focusableWhenDisabled?: boolean | undefined;
}

export namespace ToolbarButton {
  export type State = ToolbarButtonState;
  export type Props = ToolbarButtonProps;
}
