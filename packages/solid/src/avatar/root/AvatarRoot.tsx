import { omit, untrack } from 'solid-js';
import { createSyncSignal } from 'base-ui-solidjs-utils/createSyncSignal';
import type { BaseUIComponentProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { AvatarRootContext } from './AvatarRootContext';
import { avatarStateAttributesMapping } from './stateAttributesMapping';
import { ownedProps } from '../../internals/ownedProps';

/**
 * Displays a user's profile picture, initials, or fallback icon.
 * Renders a `<span>` element.
 *
 * Documentation: [Base UI Avatar](https://base-ui.com/react/components/avatar)
 */
export function AvatarRoot(componentProps: AvatarRoot.Props) {
  componentProps = ownedProps(componentProps);
  const elementProps = omit(componentProps, 'class', 'render', 'style', 'children', 'ref');

  const [imageLoadingStatus, setImageLoadingStatus] =
    createSyncSignal<ImageLoadingStatus>('idle');

  const state = (): AvatarRootState => ({
    imageLoadingStatus: imageLoadingStatus(),
  });

  const contextValue: AvatarRootContext = {
    get imageLoadingStatus() {
      return imageLoadingStatus();
    },
    setImageLoadingStatus: (value) => {
      setImageLoadingStatus(value);
    },
  };

  return (
    <AvatarRootContext value={contextValue}>
      {untrack(() =>
        useRenderElement('span', componentProps, {
          state,
          props: elementProps,
          stateAttributesMapping: avatarStateAttributesMapping,
        }),
      )}
    </AvatarRootContext>
  );
}


export type ImageLoadingStatus = 'idle' | 'loading' | 'loaded' | 'error';

export interface AvatarRootState {
  /**
   * The image loading status.
   */
  imageLoadingStatus: ImageLoadingStatus;
}

export interface AvatarRootProps extends BaseUIComponentProps<'span', AvatarRootState> {}

export namespace AvatarRoot {
  export type State = AvatarRootState;
  export type Props = AvatarRootProps;
}
