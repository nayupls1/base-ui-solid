import type { JSX } from '@solidjs/web';
import { createEffect, createMemo, omit, onCleanup, untrack } from 'solid-js';
import type { BaseUIComponentProps } from '../../internals/types';
import type { StateAttributesMapping } from '../../internals/getStateAttributesProps';
import { useRenderElement } from '../../internals/useRenderElement';
import { useAvatarRootContext } from '../root/AvatarRootContext';
import type { AvatarRootState, ImageLoadingStatus } from '../root/AvatarRoot';
import { avatarStateAttributesMapping } from '../root/stateAttributesMapping';
import { useOpenChangeComplete } from '../../internals/useOpenChangeComplete';
import { transitionStatusMapping } from '../../internals/stateAttributesMapping';
import { useTransitionStatus } from '../../internals/useTransitionStatus';
import type { TransitionStatus } from '../../internals/useTransitionStatus';
import { useImageLoadingStatus } from './useImageLoadingStatus';

const stateAttributesMapping: StateAttributesMapping<AvatarImageState> = {
  ...avatarStateAttributesMapping,
  ...transitionStatusMapping,
};

/**
 * The image to be displayed in the avatar.
 * Renders an `<img>` element.
 *
 * Documentation: [Base UI Avatar](https://base-ui.com/react/components/avatar)
 */
export function AvatarImage(componentProps: AvatarImage.Props) {
  const elementProps = omit(
    componentProps,
    'class',
    'render',
    'onLoadingStatusChange',
    'keepMounted',
    'style',
    'sizes',
    'srcset',
    'src',
    'children',
    'ref',
  );

  const keepMounted = () => componentProps.keepMounted ?? false;
  const rootContext = useAvatarRootContext();
  const [imageLoadingStatus, setImageLoadingStatus] = useImageLoadingStatus(
    () => componentProps.src,
    {
      get referrerPolicy() {
        return componentProps.referrerpolicy as string | undefined;
      },
      get crossOrigin() {
        return componentProps.crossorigin as string | undefined;
      },
      get sizes() {
        return componentProps.sizes;
      },
      get srcSet() {
        return componentProps.srcset;
      },
    },
    () => !keepMounted(),
  );

  const isVisible = () => imageLoadingStatus() === 'loaded';
  const { mounted, transitionStatus, setMounted } = useTransitionStatus(isVisible);

  let imageElement: HTMLImageElement | null = null;
  let initialCommit = true;

  createEffect(
    () =>
      [
        keepMounted(),
        componentProps.src,
        componentProps.srcset,
        componentProps.sizes,
        componentProps.crossorigin,
        componentProps.referrerpolicy,
      ] as const,
    ([isKeepMounted]) => {
      if (!isKeepMounted) {
        return;
      }

      const isInitialCommit = initialCommit;
      initialCommit = false;

      const image = imageElement;
      if (!image) {
        return;
      }

      if (!image.complete) {
        setImageLoadingStatus('loading');
        return;
      }

      const status = image.naturalWidth > 0 ? 'loaded' : 'error';
      setImageLoadingStatus(status);

      if (status === 'loaded' && isInitialCommit) {
        setMounted(true);
      }
    },
  );

  const renderedStatusProps = {
    get 'data-loading'() {
      return keepMounted() && imageLoadingStatus() === 'loading' ? '' : undefined;
    },
    get 'data-error'() {
      return keepMounted() && imageLoadingStatus() === 'error' ? '' : undefined;
    },
    get 'aria-hidden'() {
      return keepMounted() ? imageLoadingStatus() !== 'loaded' || undefined : undefined;
    },
    onLoad() {
      if (keepMounted()) {
        setImageLoadingStatus('loaded');
      }
    },
    onError() {
      if (keepMounted()) {
        setImageLoadingStatus('error');
      }
    },
  };

  const handleLoadingStatusChange = (status: ImageLoadingStatus) => {
    componentProps.onLoadingStatusChange?.(status);
    rootContext.setImageLoadingStatus(status);
  };

  createEffect(imageLoadingStatus, (status) => {
    if (status !== 'idle') {
      handleLoadingStatusChange(status);
    }
  });

  onCleanup(() => {
    rootContext.setImageLoadingStatus('idle');
  });

  useOpenChangeComplete({
    get enabled() {
      return !isVisible();
    },
    get open() {
      return isVisible();
    },
    ref: () => imageElement,
    onComplete() {
      if (!isVisible()) {
        setMounted(false);
      }
    },
  });

  const state = createMemo<AvatarImageState>(() => ({
    imageLoadingStatus: imageLoadingStatus(),
    transitionStatus:
      keepMounted() && transitionStatus() === 'ending' ? undefined : transitionStatus(),
  }));

  const sourceProps = () => {
    const props: Record<string, string> = {};
    if (componentProps.sizes !== undefined) {
      props.sizes = componentProps.sizes;
    }
    if (componentProps.srcset !== undefined) {
      props.srcset = componentProps.srcset;
    }
    if (componentProps.src !== undefined) {
      props.src = componentProps.src;
    }
    return props;
  };

  return untrack(() =>
    useRenderElement('img', componentProps, {
      state,
      ref: (el: HTMLImageElement | null) => {
        imageElement = el;
      },
      props: () => [renderedStatusProps, elementProps, sourceProps()],
      stateAttributesMapping,
      enabled: () => keepMounted() || mounted(),
    }),
  );
}

export interface AvatarImageState extends AvatarRootState {
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
}

export interface AvatarImageProps extends BaseUIComponentProps<
  'img',
  AvatarImageState,
  JSX.IntrinsicElements['img']
> {
  /**
   * Callback fired when the loading status changes.
   */
  onLoadingStatusChange?: ((status: ImageLoadingStatus) => void) | undefined;
  /**
   * Whether the image element stays mounted and loads in place instead of being preloaded.
   * Supports `loading="lazy"` and optimized image components such as `next/image`.
   * @default false
   */
  keepMounted?: boolean | undefined;
}

export namespace AvatarImage {
  export type State = AvatarImageState;
  export type Props = AvatarImageProps;
}
