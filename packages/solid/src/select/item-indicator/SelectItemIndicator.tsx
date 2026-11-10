import type { JSX } from '@solidjs/web';
import { Show } from 'solid-js';
import { useSelectItemContext } from '../item/SelectItemContext';
import type { BaseUIComponentProps } from '../../internals/types';
import { ItemIndicator } from '../../utils/ItemIndicator';
import type { TransitionStatus } from '../../internals/useTransitionStatus';

/**
 * Indicates whether the select item is selected.
 * Renders a `<span>` element.
 *
 * Documentation: [Base UI Select](https://base-ui.com/react/components/select)
 */
export function SelectItemIndicator(componentProps: SelectItemIndicator.Props) {
  const item = useSelectItemContext();

  return (
    <Show when={componentProps.keepMounted || item.selected}>
      <ItemIndicator {...(componentProps as any)} selected={item.selected} />
    </Show>
  );
}

export interface SelectItemIndicatorState {
  /**
   * Whether the item is selected.
   */
  selected: boolean;
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
}

export interface SelectItemIndicatorProps extends BaseUIComponentProps<
  'span',
  SelectItemIndicatorState
> {
  children?: JSX.Element;
  /**
   * Whether to keep the HTML element in the DOM when the item is not selected.
   */
  keepMounted?: boolean | undefined;
}

export namespace SelectItemIndicator {
  export type State = SelectItemIndicatorState;
  export type Props = SelectItemIndicatorProps;
}
