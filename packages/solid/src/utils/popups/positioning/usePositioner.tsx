import type { JSX } from '@solidjs/web';
import { popupStateMapping } from '../popupStateMapping';
import { useRenderElement, type RefInput } from '../../../internals/useRenderElement';
import type { UseRenderElementComponentProps } from '../../../internals/useRenderElement';
import { getDisabledMountTransitionStyles } from '../../../internals/getDisabledMountTransitionStyles';
import type { TransitionStatus } from '../../../internals/useTransitionStatus';

interface UsePositionerOptions {
  styles: JSX.CSSProperties;
  transitionStatus: TransitionStatus;
  props?: Record<string, any> | undefined;
  refs?: RefInput<HTMLDivElement> | undefined;
  hidden?: boolean | undefined;
  inert?: boolean | undefined;
}

/**
 * Renders the shared outer Positioner element used by popup components.
 * Applies the common role, hidden state, transition styles, state attributes, and optional inert styling.
 * Options are read lazily, so they can be getters.
 */
export function usePositioner<State extends Record<string, any>>(
  componentProps: UseRenderElementComponentProps<State>,
  state: () => State,
  options: UsePositionerOptions,
) {
  return useRenderElement('div', componentProps, {
    state,
    ref: options.refs,
    props: [
      {
        role: 'presentation',
        get hidden() {
          return options.hidden;
        },
        get style() {
          const style: JSX.CSSProperties = { ...options.styles };
          if (options.inert) {
            style['pointer-events'] = 'none';
          }
          return style;
        },
      },
      {
        get style() {
          return getDisabledMountTransitionStyles(options.transitionStatus).style;
        },
      },
      options.props,
    ],
    stateAttributesMapping: popupStateMapping,
  });
}
