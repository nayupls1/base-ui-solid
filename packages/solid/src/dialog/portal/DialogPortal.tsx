import type { RefObject } from 'base-ui-solidjs-utils/types';
import { omit, Show } from 'solid-js';
import { FloatingPortal } from '../../utils/popups/portal/FloatingPortal';
import type { BaseUIComponentProps } from '../../internals/types';
import { useDialogRootContext } from '../root/DialogRootContext';
import { DialogPortalContext } from './DialogPortalContext';
import { InternalBackdrop } from '../../utils/popups/InternalBackdrop';
import { ownedProps } from '../../internals/ownedProps';

/**
 * A portal element that moves the popup to a different part of the DOM.
 * By default, the portal element is appended to `<body>`.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Dialog](https://base-ui.com/react/components/dialog)
 */
export function DialogPortal(props: DialogPortal.Props) {
  props = ownedProps(props);
  const portalProps = omit(props, 'keepMounted', 'children');

  const store = useDialogRootContext();
  const mounted = store.useState('mounted');
  const modal = store.useState('modal');
  const open = store.useState('open');

  const shouldRender = () => mounted() || (props.keepMounted ?? false);

  return (
    <Show when={shouldRender()}>
      <DialogPortalContext value={props.keepMounted ?? false}>
        <FloatingPortal {...portalProps}>
          <Show when={mounted() && modal() === true}>
            <InternalBackdrop
              ref={(el: HTMLDivElement) => {
                store.context.internalBackdropRef.current = el;
              }}
              inert={!open()}
            />
          </Show>
          {props.children}
        </FloatingPortal>
      </DialogPortalContext>
    </Show>
  );
}

export interface DialogPortalState {}

export interface DialogPortalProps extends BaseUIComponentProps<'div', DialogPortalState> {
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

export namespace DialogPortal {
  export type State = DialogPortalState;
  export type Props = DialogPortalProps;
}
