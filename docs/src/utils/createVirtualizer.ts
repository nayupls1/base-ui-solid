import { createEffect, createSignal, untrack, type Accessor } from 'solid-js';
import {
  Virtualizer,
  elementScroll,
  measureElement,
  observeElementOffset,
  observeElementRect,
  type PartialKeys,
  type VirtualizerOptions,
} from '@tanstack/virtual-core';

type CreateVirtualizerOptions<TScroll extends Element, TItem extends Element> = PartialKeys<
  VirtualizerOptions<TScroll, TItem>,
  'observeElementRect' | 'observeElementOffset' | 'scrollToFn'
>;

/**
 * A Solid 2 binding for `@tanstack/virtual-core` (`@tanstack/solid-virtual` targets Solid 1).
 * `options` is an accessor; `virtualItems` and `totalSize` are reactive.
 */
export function createVirtualizer<TScroll extends Element, TItem extends Element>(
  options: Accessor<CreateVirtualizerOptions<TScroll, TItem>>,
) {
  const [version, setVersion] = createSignal(0, { ownedWrite: true });

  const resolveOptions = (): VirtualizerOptions<TScroll, TItem> => {
    const userOptions = options();
    return {
      observeElementRect,
      observeElementOffset,
      scrollToFn: elementScroll,
      measureElement,
      ...userOptions,
      onChange(instance, sync) {
        setVersion((value) => value + 1);
        userOptions.onChange?.(instance, sync);
      },
    } as VirtualizerOptions<TScroll, TItem>;
  };

  const instance = new Virtualizer<TScroll, TItem>(untrack(resolveOptions));

  createEffect(resolveOptions, (resolved) => {
    instance.setOptions(resolved);
    instance._willUpdate();
    setVersion((value) => value + 1);
  });

  createEffect(
    () => null,
    () => {
      const cleanup = instance._didMount();
      instance._willUpdate();
      return cleanup;
    },
  );

  return {
    instance,
    virtualItems: () => {
      version();
      return instance.getVirtualItems();
    },
    totalSize: () => {
      version();
      return instance.getTotalSize();
    },
  };
}

export type SolidVirtualizer = ReturnType<typeof createVirtualizer<HTMLDivElement, Element>>;
