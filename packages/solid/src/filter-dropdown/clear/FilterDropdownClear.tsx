import { omit, Show, untrack } from 'solid-js';
import type { BaseUIComponentProps, NativeButtonProps } from '../../internals/types';
import { useButton } from '../../internals/use-button';
import { useRenderElement } from '../../internals/useRenderElement';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import {
  useFilterDropdownRootContext,
  useFilterDropdownValueContext,
} from '../root/FilterDropdownRootContext';
import { ownedProps } from '../../internals/ownedProps';

/**
 * Clears the query. Renders nothing while the query is empty.
 * Renders a `<button>` element.
 *
 * @internal
 */
export function FilterDropdownClear(componentProps: FilterDropdownClear.Props) {
  componentProps = ownedProps(componentProps);
  const elementProps = omit(
    componentProps,
    'render',
    'class',
    'style',
    'disabled',
    'nativeButton',
    'children',
    'ref',
  );

  const context = useFilterDropdownRootContext();
  const value = useFilterDropdownValueContext();

  const disabled = () => context.disabled || (componentProps.disabled ?? false);
  const visible = () => value() !== '';

  const { buttonRef, getButtonProps } = useButton({
    get disabled() {
      return disabled();
    },
    get native() {
      return componentProps.nativeButton ?? true;
    },
  });

  // `visible` is deliberately absent from the state: the component renders nothing when it is
  // false, so a `data-visible` attribute would be present on every rendered instance.
  const state = (): FilterDropdownClearState => ({
    disabled: disabled(),
  });

  return (
    <Show when={visible()}>
      {untrack(() =>
        useRenderElement('button', componentProps, {
          state,
          ref: buttonRef,
          props: [
            {
              tabindex: -1,
              'aria-hidden': true,
              onMouseDown(event: MouseEvent) {
                // Avoid stealing focus from the input on pointer interaction.
                event.preventDefault();
              },
              onClick(event: MouseEvent) {
                const eventDetails = createChangeEventDetails(REASONS.clearPress, event);
                context.onValueChange('', eventDetails);
                context.focusOwnerRef.current?.focus({ preventScroll: true });
              },
            },
            elementProps,
            getButtonProps,
          ],
        }),
      )}
    </Show>
  );
}

export interface FilterDropdownClearState {
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
}

export interface FilterDropdownClearProps
  extends NativeButtonProps, BaseUIComponentProps<'button', FilterDropdownClearState> {
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
}

export namespace FilterDropdownClear {
  export type Props = FilterDropdownClearProps;
  export type State = FilterDropdownClearState;
}
