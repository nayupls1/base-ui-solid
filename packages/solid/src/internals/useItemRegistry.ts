import { createMemo, createSignal, type Accessor } from 'solid-js';

type RegisterItem<Key, Item> = (key: Key, item: Item) => () => void;

/**
 * A registry of items keyed by identity. `items` is a snapshot that updates once per flush after
 * registrations change; `liveItems` is the mutable registry for imperative reads.
 */
export function useItemRegistry<Key, Item>(): ItemRegistry<Key, Item> {
  const itemRegistry = new Map<Key, Item>();

  const [registryVersion, setRegistryVersion] = createSignal(0, { ownedWrite: true });

  let isUpdateScheduled = false;

  // Item effects run in the same flush, so schedule one update for all of them.
  const scheduleRegistryUpdate = () => {
    if (isUpdateScheduled) {
      return;
    }

    isUpdateScheduled = true;
    queueMicrotask(() => {
      isUpdateScheduled = false;
    });
    setRegistryVersion((version) => version + 1);
  };

  const registerItem = (key: Key, item: Item) => {
    itemRegistry.set(key, item);
    scheduleRegistryUpdate();

    return () => {
      itemRegistry.delete(key);
      scheduleRegistryUpdate();
    };
  };

  const items = createMemo(() => {
    registryVersion();
    return new Map(itemRegistry) as ReadonlyMap<Key, Item>;
  });

  return { items, registerItem, liveItems: itemRegistry };
}

export interface ItemRegistry<Key, Item> {
  items: Accessor<ReadonlyMap<Key, Item>>;
  registerItem: RegisterItem<Key, Item>;
  liveItems: ReadonlyMap<Key, Item>;
}
