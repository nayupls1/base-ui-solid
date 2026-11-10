import { createEffect, onCleanup, untrack, type Accessor } from 'solid-js';
import type { ReactStore } from 'base-ui-solidjs-utils/store';
import { EMPTY_OBJECT } from 'base-ui-solidjs-utils/empty';
import type { InteractionType } from 'base-ui-solidjs-utils/useEnhancedClickHandler';
import type { RefObject } from 'base-ui-solidjs-utils/types';
import { FOCUSABLE_ATTRIBUTE } from './constants';
import type { HTMLProps } from '../../internals/types';
import type {
  PopupStoreState,
  PopupStoreContext,
  popupStoreSelectors,
  PopupTriggerDataStore,
} from './store';

export const FOCUSABLE_POPUP_PROPS = {
  tabindex: -1,
  [FOCUSABLE_ATTRIBUTE]: '',
} satisfies HTMLProps<HTMLElement> & Record<typeof FOCUSABLE_ATTRIBUTE, string>;

/**
 * Returns the default initial focus behavior for anchored popups: focus the popup itself on touch,
 * otherwise the first tabbable element.
 */
export function createDefaultInitialFocus(popupRef: RefObject<HTMLElement | null>) {
  return (interactionType: InteractionType) =>
    interactionType === 'touch' ? popupRef.current : true;
}

function syncTriggerCount(store: PopupTriggerDataStore<PopupStoreState<unknown>>) {
  const triggerCount = store.context.triggerElements.size;
  if (store.select('open') && store.state.triggerCount !== triggerCount) {
    store.set('triggerCount', triggerCount);
  }
}

/**
 * Returns a callback ref that registers a trigger element with the popup store.
 * Accessors are read when the ref is invoked, so the trigger follows id/store changes.
 */
export function useTriggerRegistration<State extends PopupStoreState<unknown>>(
  id: Accessor<string | undefined>,
  store: PopupTriggerDataStore<State>,
) {
  let registration: {
    store: PopupTriggerDataStore<State>;
    storeTarget: unknown;
    id: string;
    element: Element;
  } | null = null;

  return (element: Element | null) => {
    const currentId = untrack(id);
    const storeTarget = store.context.triggerElements;

    if (registration !== null) {
      if (
        registration.element === element &&
        registration.storeTarget === storeTarget &&
        registration.id === currentId
      ) {
        return;
      }

      const previous = registration;
      registration = null;
      const registeredStore = previous.store;
      const map = previous.storeTarget as PopupStoreContext<never>['triggerElements'];
      if (map.getById(previous.id) === previous.element) {
        map.delete(previous.id);
        syncTriggerCount(registeredStore);
      }
    }

    if (element !== null && currentId !== undefined) {
      registration = { store, storeTarget, id: currentId, element };
      store.context.triggerElements.add(currentId, element);
      syncTriggerCount(store);
    }
  };
}

/**
 * Registers a trigger and forwards its state to the popup store whenever it's the active trigger.
 * `stateUpdates` is an accessor so the forwarded values stay reactive.
 */
export function useTriggerDataForwarding<
  State extends PopupStoreState<unknown>,
  const Key extends keyof Omit<State, 'activeTriggerId' | 'activeTriggerElement'>,
>(
  triggerId: Accessor<string | undefined>,
  triggerElement: Accessor<Element | null>,
  store: PopupTriggerDataStore<State>,
  stateUpdates: Accessor<Pick<State, Key>>,
) {
  const isMountedByThisTrigger = store.useState('isMountedByTrigger', triggerId);

  const baseRegisterTrigger = useTriggerRegistration(triggerId, store);

  const applyTriggerData = (element: Element) => {
    const open = store.select('open');
    const activeTriggerId = store.select('activeTriggerId');
    const currentTriggerId = untrack(triggerId);
    const updates = untrack(stateUpdates);

    if (activeTriggerId === currentTriggerId) {
      const changes = {
        activeTriggerElement: element,
        ...(open ? updates : null),
      } as Pick<Readonly<State>, Key | 'activeTriggerElement'>;
      store.update(changes);
      return;
    }

    if (activeTriggerId == null && open && !store.state.openedWithoutTrigger) {
      const changes = {
        activeTriggerId: currentTriggerId ?? null,
        activeTriggerElement: element,
        ...updates,
      } as Pick<Readonly<State>, Key | 'activeTriggerId' | 'activeTriggerElement'>;
      store.update(changes);
    }
  };

  const registerTrigger = (element: Element | null) => {
    baseRegisterTrigger(element);
    if (element) {
      applyTriggerData(element);
    }
  };

  createEffect(
    () => [triggerElement(), triggerId(), store.context.triggerElements] as const,
    ([element]) => {
      untrack(() => registerTrigger(element));
      return () => {
        untrack(() => registerTrigger(null));
      };
    },
  );

  createEffect(
    () => [isMountedByThisTrigger(), stateUpdates()] as const,
    ([isMounted, updates]) => {
      if (isMounted) {
        const changes = {
          activeTriggerElement: untrack(triggerElement),
          ...updates,
        } as Pick<Readonly<State>, Key | 'activeTriggerElement'>;
        store.update(changes);
      }
    },
  );

  return { registerTrigger, isMountedByThisTrigger };
}

type PopupInteractionPropKey = 'activeTriggerProps' | 'inactiveTriggerProps' | 'popupProps';

/**
 * Publishes the interaction props computed by a Root into its store, so detached parts can read
 * them.
 */
export function usePopupInteractionProps<
  State extends PopupStoreState<unknown>,
  const Key extends keyof State,
>(
  store: ReactStore<State, PopupStoreContext<never>, typeof popupStoreSelectors>,
  statePart: Accessor<Pick<State, Key | PopupInteractionPropKey>>,
) {
  store.useSyncedValues(statePart);

  onCleanup(() => {
    store.update({
      activeTriggerProps: EMPTY_OBJECT,
      inactiveTriggerProps: EMPTY_OBJECT,
      popupProps: EMPTY_OBJECT,
    } as any);
  });
}
