import { omit, untrack } from 'solid-js';
import { useControlled } from '@base-ui-solid/utils/useControlled';
import { EMPTY_ARRAY } from '@base-ui-solid/utils/empty';
import { useRenderElement } from '../internals/useRenderElement';
import type { BaseUIComponentProps, HTMLProps, Orientation } from '../internals/types';
import { CompositeRoot } from '../internals/composite/root/CompositeRoot';
import { useToolbarRootContext } from '../toolbar/root/ToolbarRootContext';
import { useToolbarGroupContext } from '../toolbar/group/ToolbarGroupContext';
import { ToggleGroupContext } from './ToggleGroupContext';
import type { BaseUIChangeEventDetails } from '../internals/createBaseUIEventDetails';
import type { REASONS } from '../internals/reasons';

/**
 * Provides a shared state to a series of toggle buttons.
 *
 * Documentation: [Base UI Toggle Group](https://base-ui.com/react/components/toggle-group)
 */
export function ToggleGroup<Value extends string>(componentProps: ToggleGroup.Props<Value>) {
  const elementProps = omit(
    componentProps,
    'defaultValue',
    'disabled',
    'loopFocus',
    'onValueChange',
    'orientation',
    'multiple',
    'value',
    'class',
    'render',
    'style',
    'children',
    'ref',
  );

  const toolbarContext = useToolbarRootContext(true);
  const toolbarGroupContext = useToolbarGroupContext();

  const isValueInitialized = untrack(
    () => componentProps.value !== undefined || componentProps.defaultValue !== undefined,
  );

  const disabled = () =>
    (toolbarContext?.disabled ?? false) ||
    (toolbarGroupContext?.disabled ?? false) ||
    (componentProps.disabled ?? false);
  const multiple = () => componentProps.multiple ?? false;
  const orientation = () => componentProps.orientation ?? 'horizontal';

  const [groupValue, setValueState] = useControlled<readonly Value[]>({
    controlled: () => componentProps.value,
    default: () => componentProps.defaultValue ?? (EMPTY_ARRAY as Value[]),
    name: 'ToggleGroup',
    state: 'value',
  });

  const setGroupValue = (
    newValue: Value,
    nextPressed: boolean,
    eventDetails: BaseUIChangeEventDetails<typeof REASONS.none>,
  ) => {
    const current = groupValue();
    let newGroupValue: Value[];
    if (multiple()) {
      newGroupValue = current.slice();
      if (nextPressed) {
        newGroupValue.push(newValue);
      } else {
        newGroupValue.splice(current.indexOf(newValue), 1);
      }
    } else {
      newGroupValue = nextPressed ? [newValue] : [];
    }

    componentProps.onValueChange?.(newGroupValue, eventDetails);

    if (eventDetails.isCanceled) {
      return;
    }

    setValueState(newGroupValue);
  };

  const state = (): ToggleGroupState => ({
    disabled: disabled(),
    multiple: multiple(),
    orientation: orientation(),
  });

  const contextValue: ToggleGroupContext<Value> = {
    get disabled() {
      return disabled();
    },
    setGroupValue,
    get value() {
      return groupValue();
    },
    isValueInitialized,
  };

  const defaultProps: HTMLProps = {
    role: 'group',
  };

  return (
    <ToggleGroupContext value={contextValue}>
      {toolbarContext
        ? untrack(() =>
            useRenderElement('div', componentProps, {
              state,
              props: [defaultProps, elementProps],
            }),
          )
        : untrack(() => (
            <CompositeRoot
              render={componentProps.render}
              class={componentProps.class}
              style={componentProps.style}
              state={state()}
              refs={[componentProps.ref]}
              props={[defaultProps, elementProps]}
              loopFocus={componentProps.loopFocus ?? true}
              enableHomeAndEndKeys
              orientation={orientation()}
            >
              {componentProps.children}
            </CompositeRoot>
          ))}
    </ToggleGroupContext>
  );
}

type ToggleGroupContext<Value> = import('./ToggleGroupContext').ToggleGroupContext<Value>;

export interface ToggleGroupState {
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
  /**
   * When `false` only one item in the group can be pressed. If any item in
   * the group becomes pressed, the others will become unpressed.
   * When `true` multiple items can be pressed.
   * @default false
   */
  multiple: boolean;
  /**
   * The orientation of the toggle group.
   */
  orientation: Orientation;
}

export interface ToggleGroupProps<Value extends string> extends BaseUIComponentProps<
  'div',
  ToggleGroupState
> {
  /**
   * The pressed state of the toggle group represented by an array of
   * the values of all pressed toggle buttons.
   * This is the controlled counterpart of `defaultValue`.
   */
  value?: readonly Value[] | undefined;
  /**
   * The pressed state of the toggle group represented by an array of
   * the values of all pressed toggle buttons.
   * This is the uncontrolled counterpart of `value`.
   */
  defaultValue?: readonly Value[] | undefined;
  /**
   * Callback fired when the pressed states of the toggle group changes.
   */
  onValueChange?:
    ((groupValue: Value[], eventDetails: ToggleGroup.ChangeEventDetails) => void) | undefined;
  /**
   * Whether the toggle group should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * @default 'horizontal'
   */
  orientation?: Orientation | undefined;
  /**
   * Whether to loop keyboard focus back to the first item
   * when the end of the list is reached while using the arrow keys.
   * @default true
   */
  loopFocus?: boolean | undefined;
  /**
   * When `false` only one item in the group can be pressed. If any item in
   * the group becomes pressed, the others will become unpressed.
   * When `true` multiple items can be pressed.
   * @default false
   */
  multiple?: boolean | undefined;
}

export type ToggleGroupChangeEventReason = typeof REASONS.none;

export type ToggleGroupChangeEventDetails = BaseUIChangeEventDetails<ToggleGroup.ChangeEventReason>;

export namespace ToggleGroup {
  export type State = ToggleGroupState;
  export type Props<Value extends string = string> = ToggleGroupProps<Value>;
  export type ChangeEventReason = ToggleGroupChangeEventReason;
  export type ChangeEventDetails = ToggleGroupChangeEventDetails;
}
