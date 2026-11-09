import { createEffect, omit, untrack } from 'solid-js';
import { useTimeout } from '@base-ui-solid/utils/useTimeout';
import { createSyncSignal } from '@base-ui-solid/utils/createSyncSignal';
import type { BaseUIComponentProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { useAvatarRootContext } from '../root/AvatarRootContext';
import type { AvatarRootState } from '../root/AvatarRoot';
import { avatarStateAttributesMapping } from '../root/stateAttributesMapping';
import { ownedProps } from '../../internals/ownedProps';

/**
 * Rendered when the image fails to load or when no image is provided.
 * Renders a `<span>` element.
 *
 * Documentation: [Base UI Avatar](https://base-ui.com/react/components/avatar)
 */
export function AvatarFallback(componentProps: AvatarFallback.Props) {
  componentProps = ownedProps(componentProps);
  const elementProps = omit(componentProps, 'class', 'render', 'delay', 'style', 'children', 'ref');

  const delay = () => componentProps.delay ?? 0;
  const rootContext = useAvatarRootContext();
  const [delayPassed, setDelayPassed] = createSyncSignal(untrack(delay) === 0);
  const timeout = useTimeout();

  createEffect(delay, (currentDelay) => {
    if (currentDelay > 0) {
      timeout.start(currentDelay, () => {
        setDelayPassed(true);
      });
    } else {
      setDelayPassed(true);
    }
    return timeout.clear;
  });

  const state = (): AvatarFallbackState => ({
    imageLoadingStatus: rootContext.imageLoadingStatus,
  });

  return untrack(() =>
    useRenderElement('span', componentProps, {
      state,
      props: elementProps,
      stateAttributesMapping: avatarStateAttributesMapping,
      enabled: () =>
        rootContext.imageLoadingStatus !== 'loaded' && (delay() === 0 || delayPassed()),
    }),
  );
}

export interface AvatarFallbackState extends AvatarRootState {}

export interface AvatarFallbackProps extends BaseUIComponentProps<'span', AvatarFallbackState> {
  /**
   * How long to wait before showing the fallback. Specified in milliseconds.
   *
   * @default 0
   */
  delay?: number | undefined;
}

export namespace AvatarFallback {
  export type State = AvatarFallbackState;
  export type Props = AvatarFallbackProps;
}
