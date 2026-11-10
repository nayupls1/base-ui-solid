import { omit } from 'solid-js';
import { usePreviewCardRootContext } from '../root/PreviewCardContext';
import type { BaseUIComponentProps } from '../../internals/types';
import { popupTransitionStateMapping } from '../../utils/popups/popupStateMapping';
import type { TransitionStatus } from '../../internals/useTransitionStatus';
import { useRenderElement } from '../../internals/useRenderElement';
import { ownedProps } from '../../internals/ownedProps';

/**
 * A presentational overlay displayed beneath the popup.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Preview Card](https://base-ui.com/react/components/preview-card)
 */
export function PreviewCardBackdrop(props: PreviewCardBackdrop.Props) {
  props = ownedProps(props);
  const elementProps = omit(props, 'render', 'class', 'style', 'children', 'ref');

  const store = usePreviewCardRootContext();

  const open = store.useState('open');
  const mounted = store.useState('mounted');
  const transitionStatus = store.useState('transitionStatus');

  const state = (): PreviewCardBackdropState => ({
    open: open(),
    transitionStatus: transitionStatus(),
  });

  return useRenderElement('div', props, {
    state,
    props: [
      {
        role: 'presentation',
        get hidden() {
          return !mounted();
        },
        get style() {
          return {
            'pointer-events': 'none',
            'user-select': 'none',
            '-webkit-user-select': 'none',
          };
        },
      },
      elementProps,
    ],
    stateAttributesMapping: popupTransitionStateMapping,
  });
}

export interface PreviewCardBackdropState {
  /**
   * Whether the preview card is currently open.
   */
  open: boolean;
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
}

export interface PreviewCardBackdropProps extends BaseUIComponentProps<
  'div',
  PreviewCardBackdropState
> {}

export namespace PreviewCardBackdrop {
  export type State = PreviewCardBackdropState;
  export type Props = PreviewCardBackdropProps;
}
