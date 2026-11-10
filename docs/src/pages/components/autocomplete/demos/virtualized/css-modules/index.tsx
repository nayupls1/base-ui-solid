import type { JSX } from '@solidjs/web';
import { For, Show } from 'solid-js';
import { Autocomplete } from '@base-ui-solid/solid/autocomplete';
import { createVirtualizer, type SolidVirtualizer } from 'docs/src/utils/createVirtualizer';
import styles from './index.module.css';

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
      <label class={styles.Label}>
        Search 10,000 items
        <Autocomplete.Input class={styles.Input} />
      </label>

      <Autocomplete.Portal>
        <Autocomplete.Positioner class={styles.Positioner} sideOffset={4}>
          <Autocomplete.Popup class={styles.Popup}>
            <Autocomplete.Empty>
              <div class={styles.Empty}>No items found.</div>
            </Autocomplete.Empty>
            <Autocomplete.List class={styles.List}>
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
        class={styles.Scroller}
        style={{ '--total-size': `${virtualizer.totalSize()}px` } as JSX.CSSProperties}
      >
        <div
          role="presentation"
          class={styles.VirtualizedPlaceholder}
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
                      class={styles.Item}
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
