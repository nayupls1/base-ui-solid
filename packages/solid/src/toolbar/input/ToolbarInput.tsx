import { createMemo, omit } from 'solid-js';
import type { BaseUIComponentProps, HTMLProps } from '../../internals/types';
import { useFocusableWhenDisabled } from '../../utils/useFocusableWhenDisabled';
import type { ToolbarRootState } from '../root/ToolbarRoot';
import { useToolbarRootContext } from '../root/ToolbarRootContext';
import { useToolbarGroupContext } from '../group/ToolbarGroupContext';
import { CompositeItem } from '../../internals/composite/item/CompositeItem';

/**
 * A native input element that integrates with Toolbar keyboard navigation.
 * Renders an `<input>` element.
 *
 * Documentation: [Base UI Toolbar](https://base-ui.com/react/components/toolbar)
 */
export function ToolbarInput(componentProps: ToolbarInput.Props) {
  const elementProps = omit(
    componentProps,
    'class',
    'focusableWhenDisabled',
    'render',
    'disabled',
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

  const { props: focusableWhenDisabledProps } = useFocusableWhenDisabled({
    composite: true,
    get disabled() {
      return disabled();
    },
    get focusableWhenDisabled() {
      return focusableWhenDisabled();
    },
    isNativeButton: false,
  });

  const state = (): ToolbarInputState => ({
    disabled: disabled(),
    orientation: rootContext.orientation,
    focusable: focusableWhenDisabled(),
  });

  const preventWhenDisabled = (event: Event) => {
    if (disabled()) {
      event.preventDefault();
    }
  };

  const defaultProps: HTMLProps = {
    onClick: preventWhenDisabled,
    onPointerDown: preventWhenDisabled,
  };

  return (
    <CompositeItem
      tag="input"
      render={componentProps.render}
      class={componentProps.class}
      style={componentProps.style}
      metadata={itemMetadata()}
      state={state()}
      refs={[componentProps.ref]}
      props={[defaultProps, elementProps, focusableWhenDisabledProps]}
    />
  );
}

export interface ToolbarInputState extends ToolbarRootState {
  disabled: boolean;
  focusable: boolean;
}

export interface ToolbarInputProps extends BaseUIComponentProps<'input', ToolbarInputState> {
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
  defaultValue?: string | number | undefined;
}

export namespace ToolbarInput {
  export type State = ToolbarInputState;
  export type Props = ToolbarInputProps;
}
