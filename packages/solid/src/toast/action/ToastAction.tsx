import { children as resolveChildren, omit, Show, untrack } from 'solid-js';
import type { BaseUIComponentProps, NativeButtonProps } from '../../internals/types';
import { useToastRootContext } from '../root/ToastRootContext';
import { useButton } from '../../internals/use-button';
import { useRenderElement } from '../../internals/useRenderElement';
import { hasRenderableChildren } from '../utils/isRenderableNode';
import { ownedProps } from '../../internals/ownedProps';

/**
 * Performs an action when clicked.
 * Renders a `<button>` element.
 *
 * Documentation: [Base UI Toast](https://base-ui.com/react/components/toast)
 */
export function ToastAction(componentProps: ToastAction.Props) {
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

  const root = useToastRootContext();

  const computedChildren = resolveChildren(
    () => (root.toast.actionProps?.children ?? componentProps.children) as any,
  );

  const { getButtonProps, buttonRef } = useButton({
    get disabled() {
      return componentProps.disabled ?? false;
    },
    get native() {
      return componentProps.nativeButton ?? true;
    },
  });

  const state = (): ToastActionState => ({
    type: root.toast.type,
  });

  const actionProps = new Proxy({} as Record<string, unknown>, {
    get(_target, key) {
      if (key === 'children') {
        return undefined;
      }
      return (root.toast.actionProps as any)?.[key];
    },
    has(_target, key) {
      return key !== 'children' && !!root.toast.actionProps && key in root.toast.actionProps;
    },
    ownKeys() {
      return Object.keys(root.toast.actionProps ?? {}).filter((key) => key !== 'children');
    },
    getOwnPropertyDescriptor(_target, key) {
      if (key === 'children' || !root.toast.actionProps || !(key in root.toast.actionProps)) {
        return undefined;
      }
      return { enumerable: true, configurable: true };
    },
  });

  return (
    <Show when={hasRenderableChildren(computedChildren())}>
      {untrack(() =>
        useRenderElement('button', componentProps, {
          ref: buttonRef,
          state,
          props: [elementProps, actionProps, getButtonProps],
          children: computedChildren,
        }),
      )}
    </Show>
  );
}

export interface ToastActionState {
  /**
   * The type of the toast.
   */
  type: string | undefined;
}

export interface ToastActionProps
  extends NativeButtonProps, BaseUIComponentProps<'button', ToastActionState> {}

export namespace ToastAction {
  export type State = ToastActionState;
  export type Props = ToastActionProps;
}
