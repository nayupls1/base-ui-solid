import { createEffect, untrack } from 'solid-js';
import { useId } from 'base-ui-solidjs-utils/useId';
import { PopupTriggerMap } from '../popupTriggerMap';
import type { BaseUIChangeEventDetails } from '../../../internals/createBaseUIEventDetails';
import { useFloatingParentNodeId } from '../tree/FloatingTree';
import { FloatingRootStore } from './FloatingRootStore';
import type { FloatingRootState as State } from './FloatingRootStore';

/**
 * What `useFloatingRootStore` syncs into its store.
 */
export interface UseFloatingRootStoreOptions {
  /**
   * Whether the popup is open.
   * @default false
   */
  open?: boolean | undefined;
  /**
   * Called when an interaction hook requests an open change.
   */
  onOpenChange?(open: boolean, eventDetails: BaseUIChangeEventDetails<string>): void;
  /**
   * The elements to sync into the store. A key left `undefined` keeps the store's current value.
   */
  elements?:
    | {
        /**
         * The DOM element the popup is anchored to.
         */
        anchor?: Element | null | undefined;
        /**
         * The popup's positioner element, or the popup itself when it has no positioner.
         */
        positionerElement?: HTMLElement | null | undefined;
      }
    | undefined;
}

/**
 * Creates a `FloatingRootStore` for components that manage their open state without a popup
 * store. Options are read lazily, so they can be getters.
 */
export function useFloatingRootStore(options: UseFloatingRootStoreOptions): FloatingRootStore {
  const defaultPopupId = useId();
  const nested = useFloatingParentNodeId() != null;

  const store = untrack(
    () =>
      new FloatingRootStore({
        open: options.open ?? false,
        onOpenChange: (open, details) => options.onOpenChange?.(open, details),
        anchorElement: options.elements?.anchor ?? null,
        positionerElement: options.elements?.positionerElement ?? null,
        triggerElements: new PopupTriggerMap(),
        defaultPopupId,
        nested,
      }),
  );

  createEffect(
    () =>
      [options.open ?? false, options.elements?.anchor, options.elements?.positionerElement] as const,
    ([open, anchor, positionerElement]) => {
      const valuesToSync = { open, defaultPopupId } as Pick<
        State,
        'open' | 'defaultPopupId' | 'anchorElement' | 'positionerElement'
      >;

      if (anchor !== undefined) {
        valuesToSync.anchorElement = anchor;
      }

      if (positionerElement !== undefined) {
        valuesToSync.positionerElement = positionerElement;
      }

      store.update(valuesToSync);
    },
  );

  store.context.nested = nested;

  return store;
}
