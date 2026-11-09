import { createEffect, type Accessor } from 'solid-js';
import { createSyncSignal, type SyncSetter } from '@base-ui-solid/utils/createSyncSignal';
import { NOOP } from '../../internals/noop';
import type { ImageLoadingStatus } from '../root/AvatarRoot';

interface UseImageLoadingStatusOptions {
  referrerPolicy?: string | undefined;
  crossOrigin?: string | undefined;
  sizes?: string | undefined;
  srcSet?: string | undefined;
}

/**
 * Inputs are read lazily, so they can be getters.
 */
export function useImageLoadingStatus(
  src: Accessor<string | undefined>,
  options: UseImageLoadingStatusOptions,
  enabled: Accessor<boolean>,
): [Accessor<ImageLoadingStatus>, SyncSetter<ImageLoadingStatus>] {
  const [loadingStatus, setLoadingStatus] = createSyncSignal<ImageLoadingStatus>('idle');

  createEffect(
    () =>
      [
        enabled(),
        src(),
        options.srcSet,
        options.sizes,
        options.crossOrigin,
        options.referrerPolicy,
      ] as const,
    ([isEnabled, currentSrc, srcSet, sizes, crossOrigin, referrerPolicy]) => {
      if (!isEnabled) {
        return NOOP;
      }

      if (!currentSrc && !srcSet) {
        setLoadingStatus('error');
        return NOOP;
      }

      let isMounted = true;
      const image = new window.Image();

      const updateStatus = (status: ImageLoadingStatus) => () => {
        if (!isMounted) {
          return;
        }

        setLoadingStatus(status);
      };

      setLoadingStatus('loading');
      image.onload = updateStatus('loaded');
      image.onerror = updateStatus('error');
      if (referrerPolicy) {
        image.referrerPolicy = referrerPolicy;
      }
      image.crossOrigin = crossOrigin ?? null;
      if (sizes) {
        image.sizes = sizes;
      }
      if (srcSet) {
        image.srcset = srcSet;
      }
      if (currentSrc) {
        image.src = currentSrc;
      }

      if (image.complete) {
        setLoadingStatus(image.naturalWidth > 0 ? 'loaded' : 'error');
      }

      return () => {
        isMounted = false;
      };
    },
  );

  return [loadingStatus, setLoadingStatus];
}
