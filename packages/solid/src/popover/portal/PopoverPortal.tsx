import type { RefObject } from 'base-ui-solidjs-utils/types';
import { omit, Show } from 'solid-js';
import { FloatingPortal } from '../../utils/popups/portal/FloatingPortal';
import type { BaseUIComponentProps } from '../../internals/types';
import type { RefInput } from '../../internals/useRenderElement';
import { usePopoverRootContext } from '../root/PopoverRootContext';
import { PopoverPortalContext } from './PopoverPortalContext';
import { ownedProps } from '../../internals/ownedProps';

/**
 * A portal element that moves the popup to a different part of the DOM.
 * By default, the portal element is appended to `<body>`.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Popover](https://base-ui.com/react/components/popover)
 */
export function PopoverPortal(props: PopoverPortal.Props) {
  props = ownedProps(props);
  const portalProps = omit(props, 'keepMounted');

  const store = usePopoverRootContext();
  const mounted = store.useState('mounted');

  const shouldRender = () => mounted() || (props.keepMounted ?? false);

  return (
    <Show when={shouldRender()}>
      <PopoverPortalContext value={props.keepMounted ?? false}>
        <FloatingPortal {...portalProps} />
      </PopoverPortalContext>
    </Show>
  );
}

export interface PopoverPortalState {}

export interface PopoverPortalProps extends BaseUIComponentProps<'div', PopoverPortalState> {
  /**
   * Whether to keep the portal mounted in the DOM while the popup is hidden.
   * @default false
   */
  keepMounted?: boolean | undefined;
  /**
   * A parent element to render the portal element into.
   */
  container?:
    HTMLElement | ShadowRoot | RefObject<HTMLElement | ShadowRoot | null> | null | undefined;
}

export namespace PopoverPortal {
  export type State = PopoverPortalState;
  export type Props = PopoverPortalProps;
}
