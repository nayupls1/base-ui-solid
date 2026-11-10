import type { JSX } from '@solidjs/web';
import { For, Show } from 'solid-js';
import { Autocomplete } from '@base-ui-solid/solid/autocomplete';
import { createVirtualizer, type SolidVirtualizer } from 'docs/src/utils/createVirtualizer';

export default function ExampleVirtualizedAutocomplete() {
  const virtualizerRef: { current: SolidVirtualizer['instance'] | null } = { current: null };

  return (
    <Autocomplete.Root
      virtualized
      items={virtualizedItems}
      openOnInputClick
      itemToStringValue={getItemLabel}
      onItemHighlighted={(item, { reason, index }) => {
        const virtualizer = virtualizerRef.current;

        if (!item || !virtualizer) {
          return;
        }

        const isStart = index === 0;
        const isEnd = index === virtualizer.options.count - 1;
        const shouldScroll = reason === 'none' || (reason === 'keyboard' && (isStart || isEnd));

        if (shouldScroll) {
          queueMicrotask(() => {
            virtualizer.scrollToIndex(index, { align: isEnd ? 'start' : 'end' });
          });
        }
      }}
    >
      <label class="flex flex-col gap-1 text-sm font-bold text-neutral-950 dark:text-white">
        Search 10,000 items
        <Autocomplete.Input class="h-8 w-[16rem] border border-neutral-950 bg-white dark:bg-neutral-950 px-2 text-sm any-pointer-coarse:text-base font-normal text-neutral-950 focus:outline-2 focus:-outline-offset-1 focus:outline-neutral-950 dark:focus:outline-white dark:border-white dark:text-white" />
      </label>

      <Autocomplete.Portal>
        <Autocomplete.Positioner class="outline-hidden" sideOffset={4}>
          <Autocomplete.Popup class="w-[var(--anchor-width)] max-w-[var(--available-width)] border border-neutral-950 bg-white text-neutral-950 shadow-[0.25rem_0.25rem_0] shadow-black/12 dark:border-white dark:bg-neutral-950 dark:text-white dark:shadow-none">
            <Autocomplete.Empty>
              <div class="py-3 px-2 text-sm leading-4 text-neutral-500 dark:text-neutral-400">
                No items found.
              </div>
            </Autocomplete.Empty>
            <Autocomplete.List class="p-0">
              <VirtualizedList virtualizerRef={virtualizerRef} />
            </Autocomplete.List>
          </Autocomplete.Popup>
        </Autocomplete.Positioner>
      </Autocomplete.Portal>
    </Autocomplete.Root>
  );
}

function VirtualizedList(props: {
  virtualizerRef: { current: SolidVirtualizer['instance'] | null };
}) {
  const filteredItems = Autocomplete.useFilteredItems<VirtualizedItem>();

  let scrollElement: HTMLDivElement | null = null;

  const virtualizer = createVirtualizer<HTMLDivElement, Element>(() => ({
    count: filteredItems().length,
    getScrollElement: () => scrollElement,
    estimateSize: () => 32,
    overscan: 20,
    paddingStart: 4,
    paddingEnd: 4,
    scrollPaddingEnd: 4,
    scrollPaddingStart: 4,
  }));

  props.virtualizerRef.current = virtualizer.instance;

  const handleScrollElementRef = (element: HTMLDivElement | null) => {
    scrollElement = element;
    if (element) {
      virtualizer.instance.measure();
    }
  };

  return (
    <Show when={filteredItems().length > 0}>
      <div
        role="presentation"
        ref={handleScrollElementRef}
        class="h-[min(22.5rem,var(--total-size))] max-h-[var(--available-height)] overflow-auto overscroll-contain scroll-py-1"
        style={{ '--total-size': `${virtualizer.totalSize()}px` } as JSX.CSSProperties}
      >
        <div
          role="presentation"
          class="relative w-full"
          style={{ height: `${virtualizer.totalSize()}px` }}
        >
          <For each={virtualizer.virtualItems()}>
            {(virtualItem) => {
              const item = () => filteredItems()[virtualItem.index];
              return (
                <Show when={item()}>
                  {(itemValue) => (
                    <Autocomplete.Item
                      index={virtualItem.index}
                      data-index={virtualItem.index}
                      ref={(el: HTMLDivElement) => virtualizer.instance.measureElement(el)}
                      value={itemValue()}
                      class="flex cursor-default py-2 pr-2 pl-2 text-sm leading-4 outline-hidden select-none data-highlighted:relative data-highlighted:z-0 data-highlighted:text-white data-highlighted:before:absolute data-highlighted:before:inset-x-0 data-highlighted:before:inset-y-0 data-highlighted:before:z-[-1] data-highlighted:before:bg-neutral-950 dark:data-highlighted:text-neutral-950 dark:data-highlighted:before:bg-white"
                      aria-setsize={filteredItems().length}
                      aria-posinset={virtualItem.index + 1}
                      style={{
                        position: 'absolute',
                        top: '0',
                        left: '0',
                        width: '100%',
                        height: `${virtualItem.size}px`,
                        transform: `translateY(${virtualItem.start}px)`,
                      }}
                    >
                      {itemValue().name}
                    </Autocomplete.Item>
                  )}
                </Show>
              );
            }}
          </For>
        </div>
      </div>
    </Show>
  );
}

interface VirtualizedItem {
  id: string;
  name: string;
}

function getItemLabel(item: VirtualizedItem | null) {
  return item ? item.name : '';
}

const virtualizedItems: VirtualizedItem[] = Array.from({ length: 10000 }, (_, index) => {
  const id = String(index + 1);
  const indexLabel = id.padStart(4, '0');
  return { id, name: `Item ${indexLabel}` };
});
