import type { RefObject } from 'base-ui-solidjs-utils/types';
import { omit, Show } from 'solid-js';
import { FloatingPortalLite } from '../../utils/popups/portal/FloatingPortalLite';
import type { BaseUIComponentProps } from '../../internals/types';
import type { RefInput } from '../../internals/useRenderElement';
import { usePreviewCardRootContext } from '../root/PreviewCardContext';
import { PreviewCardPortalContext } from './PreviewCardPortalContext';
import { ownedProps } from '../../internals/ownedProps';

/**
 * A portal element that moves the popup to a different part of the DOM.
 * By default, the portal element is appended to `<body>`.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Preview Card](https://base-ui.com/react/components/preview-card)
 */
export function PreviewCardPortal(props: PreviewCardPortal.Props) {
  props = ownedProps(props);
  const portalProps = omit(props, 'keepMounted');

  const store = usePreviewCardRootContext();
  const mounted = store.useState('mounted');

  const shouldRender = () => mounted() || (props.keepMounted ?? false);

  return (
    <Show when={shouldRender()}>
      <PreviewCardPortalContext value={props.keepMounted ?? false}>
        <FloatingPortalLite {...portalProps} />
      </PreviewCardPortalContext>
    </Show>
  );
}

export interface PreviewCardPortalState {}

export interface PreviewCardPortalProps extends BaseUIComponentProps<
  'div',
  PreviewCardPortalState
> {
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

export namespace PreviewCardPortal {
  export type State = PreviewCardPortalState;
  export type Props = PreviewCardPortalProps;
}
