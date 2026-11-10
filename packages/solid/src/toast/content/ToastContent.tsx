import { createEffect, createSignal, omit, untrack } from 'solid-js';
import type { BaseUIComponentProps } from '../../internals/types';
import { useToastRootContext } from '../root/ToastRootContext';
import { useRenderElement } from '../../internals/useRenderElement';
import { ownedProps } from '../../internals/ownedProps';

/**
 * A container for the contents of a toast.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Toast](https://base-ui.com/react/components/toast)
 */
export function ToastContent(componentProps: ToastContent.Props) {
  componentProps = ownedProps(componentProps);
  const elementProps = omit(componentProps, 'render', 'class', 'style', 'children', 'ref');

  const root = useToastRootContext();

  const [contentElement, setContentElement] = createSignal<HTMLDivElement | null>(null, {
    ownedWrite: true,
  });

  createEffect(contentElement, (node) => {
    untrack(() => root.recalculateHeight());

    if (!node || typeof ResizeObserver !== 'function' || typeof MutationObserver !== 'function') {
      return undefined;
    }

    const resizeObserver = new ResizeObserver(() => root.recalculateHeight(true));
    const mutationObserver = new MutationObserver(() => root.recalculateHeight(true));

    resizeObserver.observe(node);
    mutationObserver.observe(node, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  });

  const state = (): ToastContentState => ({
    expanded: root.expanded,
    behind: root.visibleIndex > 0,
  });

  return useRenderElement('div', componentProps, {
    ref: (el: HTMLDivElement | null) => setContentElement(el),
    state,
    props: [elementProps],
  });
}

export interface ToastContentState {
  /**
   * Whether the toast viewport is expanded.
   */
  expanded: boolean;
  /**
   * Whether the toast is behind the frontmost toast in the stack.
   */
  behind: boolean;
}

export interface ToastContentProps extends BaseUIComponentProps<'div', ToastContentState> {}

export namespace ToastContent {
  export type State = ToastContentState;
  export type Props = ToastContentProps;
}
