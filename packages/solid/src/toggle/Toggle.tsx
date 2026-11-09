import { createEffect, createMemo, omit, untrack } from 'solid-js';
import { useControlled } from '@base-ui-solid/utils/useControlled';
import { error } from '@base-ui-solid/utils/error';
import { useBaseUiId } from '../internals/useBaseUiId';
import { useRenderElement } from '../internals/useRenderElement';
import type { BaseUIComponentProps, NativeButtonProps } from '../internals/types';
import { useToggleGroupContext } from '../toggle-group/ToggleGroupContext';
import { useButton } from '../internals/use-button/useButton';
import { CompositeItem } from '../internals/composite/item/CompositeItem';
import { createChangeEventDetails } from '../internals/createBaseUIEventDetails';
import type { BaseUIChangeEventDetails } from '../internals/createBaseUIEventDetails';
import { REASONS } from '../internals/reasons';

/**
 * A two-state button that can be on or off.
 * Renders a `<button>` element.
 *
 * Documentation: [Base UI Toggle](https://base-ui.com/react/components/toggle)
 */
export function Toggle<Value extends string>(componentProps: Toggle.Props<Value>) {
  const elementProps = omit(
    componentProps,
    'class',
    'defaultPressed',
    'disabled',
    'form',
    'onPressedChange',
    'pressed',
    'render',
    'type',
    'value',
    'nativeButton',
    'style',
    'children',
    'ref',
  );

  const value = useBaseUiId(() => componentProps.value || undefined);
  const groupContext = useToggleGroupContext<string>();
  const groupValue = () => groupContext?.value ?? [];

  const disabled = () => ((componentProps.disabled ?? false) || groupContext?.disabled) ?? false;

  if (process.env.NODE_ENV !== 'production') {
    createEffect(
      () => [componentProps.value, groupContext?.isValueInitialized] as const,
      ([valueProp, isValueInitialized]) => {
        if (groupContext && valueProp === undefined && isValueInitialized) {
          error(
            'A `<Toggle>` component rendered in a `<ToggleGroup>` has no explicit `value` prop.',
            'This will cause issues between the Toggle Group and Toggle values.',
            'Provide the `<Toggle>` with a `value` prop matching the `<ToggleGroup>` values prop type.',
          );
        }
      },
    );
  }

  const [pressed, setPressedState] = useControlled({
    controlled: () =>
      groupContext
        ? value() !== undefined && groupValue().indexOf(value()) > -1
        : componentProps.pressed,
    default: () => componentProps.defaultPressed ?? false,
    name: 'Toggle',
    state: 'pressed',
  });

  const { getButtonProps, buttonRef } = useButton({
    get disabled() {
      return disabled();
    },
    get native() {
      return componentProps.nativeButton ?? true;
    },
  });

  const state = createMemo<ToggleState>(() => ({
    disabled: disabled(),
    pressed: pressed(),
  }));

  const refs = [buttonRef];
  const props = [
    {
      get 'aria-pressed'() {
        return pressed();
      },
      onClick(event: MouseEvent) {
        const nextPressed = !pressed();
        const details = createChangeEventDetails(REASONS.none, event);

        componentProps.onPressedChange?.(nextPressed, details);

        if (details.isCanceled) {
          return;
        }

        if (value()) {
          groupContext?.setGroupValue?.(value(), nextPressed, details);
        }

        if (details.isCanceled) {
          return;
        }

        setPressedState(nextPressed);
      },
    },
    elementProps,
    getButtonProps,
  ];

  if (groupContext) {
    const itemMetadata = createMemo(() => ({ disabled: disabled(), focusableWhenDisabled: false }));
    return (
      <CompositeItem
        tag="button"
        render={componentProps.render}
        class={componentProps.class}
        style={componentProps.style}
        metadata={itemMetadata()}
        state={state()}
        refs={[...refs, componentProps.ref]}
        props={props}
      >
        {componentProps.children}
      </CompositeItem>
    );
  }

  return untrack(() =>
    useRenderElement('button', componentProps, {
      state,
      ref: refs,
      props,
    }),
  );
}

export interface ToggleState {
  /**
   * Whether the toggle is currently pressed.
   */
  pressed: boolean;
  /**
   * Whether the toggle should ignore user interaction.
   */
  disabled: boolean;
}

export interface ToggleProps<Value extends string>
  extends NativeButtonProps, BaseUIComponentProps<'button', ToggleState> {
  /**
   * Whether the toggle button is currently pressed.
   * This is the controlled counterpart of `defaultPressed`.
   */
  pressed?: boolean | undefined;
  /**
   * Whether the toggle button is currently pressed.
   * This is the uncontrolled counterpart of `pressed`.
   * @default false
   */
  defaultPressed?: boolean | undefined;
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * Callback fired when the pressed state is changed.
   */
  onPressedChange?:
    ((pressed: boolean, eventDetails: Toggle.ChangeEventDetails) => void) | undefined;
  /**
   * A unique string that identifies the toggle when used
   * inside a toggle group.
   */
  value?: Value | undefined;
}

export type ToggleChangeEventReason = typeof REASONS.none;

export type ToggleChangeEventDetails = BaseUIChangeEventDetails<Toggle.ChangeEventReason>;

export namespace Toggle {
  export type State = ToggleState;
  export type Props<TValue extends string = string> = ToggleProps<TValue>;
  export type ChangeEventReason = ToggleChangeEventReason;
  export type ChangeEventDetails = ToggleChangeEventDetails;
}
