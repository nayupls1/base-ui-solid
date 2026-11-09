import { createEffect, createMemo, onCleanup, untrack, type Accessor } from 'solid-js';
import type { JSX } from '@solidjs/web';
import type { ReactStore } from '@base-ui-solid/utils/store';
import type { InteractionType } from '@base-ui-solid/utils/useEnhancedClickHandler';
import { useId } from '@base-ui-solid/utils/useId';
import { useFloatingParentNodeId } from './tree/FloatingTree';
import { useUnmountAfterClose } from '../../internals/useUnmountAfterClose';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import type { BaseUIChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import { assignRefs, type RefInput } from '../../internals/useRenderElement';
import type {
  PopupStoreState,
  PopupStoreContext,
  PopupStoreSelectors,
  popupStoreSelectors,
  PopupTriggerDataStore,
} from './store';

export interface PopupRootProps<Store extends PopupRootStore> {
  open?: boolean | undefined;
  defaultOpen?: boolean | undefined;
  onOpenChange?: Store['context']['onOpenChange'] | undefined;
  onOpenChangeComplete?: ((open: boolean) => void) | undefined;
  actionsRef?: RefInput<PopupRootActions | null> | undefined;
  triggerId?: string | null | undefined;
  defaultTriggerId?: string | null | undefined;
}

export interface PopupRootActions {
  unmount: () => void;
  close: () => void;
}

export type PopupRootInitialState = Pick<
  PopupStoreState<unknown>,
  'open' | 'openProp' | 'activeTriggerId' | 'triggerIdProp'
>;

export interface UsePopupRootOptions {
  /**
   * Whether to close the popup when its active trigger unmounts.
   * @default false
   */
  closeOnActiveTriggerUnmount?: boolean | undefined;
  /**
   * Whether a popup that mounts already open still animates in.
   * @default false
   */
  animateInitialOpen?: boolean | undefined;
  /**
   * Whether the popup is forced closed.
   * @default false
   */
  disabled?: boolean | undefined;
}

type PopupRootStore = ReactStore<
  PopupStoreState<unknown>,
  PopupStoreContext<never>,
  PopupStoreSelectors
> & {
  setOpen(
    open: boolean,
    eventDetails: BaseUIChangeEventDetails<typeof REASONS.imperativeAction | typeof REASONS.none>,
  ): void;
  resetOnUnmount(): void;
};

/**
 * Creates a popup root store and wires the shared root behavior. Props and options are read
 * lazily, so they can be getters.
 */
export function usePopupRoot<Store extends PopupRootStore>(
  props: PopupRootProps<Store>,
  createStore: (initialState: PopupRootInitialState, defaultPopupId: string | undefined) => Store,
  options: UsePopupRootOptions = {},
) {
  const defaultPopupId = useId();
  return usePopupRootWithPopupId(props, createStore, defaultPopupId, options);
}

export function usePopupRootWithPopupId<Store extends PopupRootStore>(
  props: PopupRootProps<Store>,
  createStore: (initialState: PopupRootInitialState, defaultPopupId: string | undefined) => Store,
  defaultPopupId: string | undefined,
  options: UsePopupRootOptions = {},
) {
  const disabled = () => options.disabled ?? false;

  const store = usePopupRootStore(
    (initialPopupId) =>
      untrack(() =>
        createStore(
          {
            open: props.defaultOpen ?? false,
            openProp: props.open,
            activeTriggerId: props.defaultTriggerId ?? null,
            triggerIdProp: props.triggerId,
          },
          initialPopupId,
        ),
      ),
    defaultPopupId,
  );

  const transitionOpen = usePopupRootOpenState(store, props, disabled);
  store.useControlledProp('triggerIdProp', () => props.triggerId);
  const openState = store.useState('open');
  const open = createMemo(() => !disabled() && openState());
  const mounted = store.useState('mounted');
  const payload = store.useState('payload') as Accessor<Store['state']['payload']>;

  useImplicitActiveTrigger(store, {
    get closeOnActiveTriggerUnmount() {
      return options.closeOnActiveTriggerUnmount ?? false;
    },
  });
  const transitionStatus = usePopupRootTransitions(
    store,
    transitionOpen,
    props,
    untrack(() => options.animateInitialOpen) ?? false,
  );

  return { store, open, mounted, payload, transitionStatus };
}

/**
 * Root behavior for popups anchored to a single element (no trigger registry).
 */
export function useSingleAnchorPopupRoot<Store extends PopupRootStore>(
  props: Omit<PopupRootProps<Store>, 'triggerId' | 'defaultTriggerId'>,
  createStore: (initialState: PopupRootInitialState, defaultPopupId: string | undefined) => Store,
  popupRef?: { current: HTMLElement | null },
) {
  const store = usePopupRootStore(
    (initialPopupId) =>
      untrack(() =>
        createStore(
          {
            open: props.defaultOpen ?? false,
            openProp: props.open,
            activeTriggerId: null,
            triggerIdProp: undefined,
          },
          initialPopupId,
        ),
      ),
    useId(),
  );

  const open = usePopupRootOpenState(store, props, () => false);
  const transitionStatus = usePopupRootTransitions(store, open, props, false, popupRef);

  return { store, open, transitionStatus };
}

function usePopupRootOpenState<Store extends PopupRootStore>(
  store: Store,
  props: Pick<PopupRootProps<Store>, 'open' | 'onOpenChange' | 'onOpenChangeComplete'>,
  disabled: Accessor<boolean>,
) {
  store.useControlledProp('openProp', () => props.open);

  store.useContextCallback('onOpenChange', () => props.onOpenChange as any);
  store.useContextCallback('onOpenChangeComplete', () => props.onOpenChangeComplete as any);

  const openState = store.useState('open');
  return createMemo(() => !disabled() && (props.open ?? openState()));
}

function usePopupRootTransitions<Store extends PopupRootStore>(
  store: Store,
  open: Accessor<boolean>,
  props: Pick<PopupRootProps<Store>, 'open' | 'actionsRef'>,
  animateInitialOpen: boolean,
  popupRef?: { current: HTMLElement | null },
) {
  const { forceUnmount, transitionStatus } = useOpenStateTransitions(
    open,
    store,
    () => props.open,
    animateInitialOpen,
    popupRef,
  );

  createEffect(
    () => props.actionsRef,
    (actionsRef) => {
      assignRefs(actionsRef as RefInput<PopupRootActions | null>, {
        unmount: forceUnmount,
        close: () => store.setOpen(false, createChangeEventDetails(REASONS.imperativeAction)),
      });
    },
  );

  return transitionStatus;
}

/**
 * Renders the handle attachment, the interaction hooks and the root children.
 */
export function renderPopupRootChildren<Store, Payload>(parameters: {
  store: Store;
  handle: PopupRootStoreHandle<Store> | undefined;
  interactions?: () => JSX.Element;
  children: () => JSX.Element | PayloadChildRenderFunction<Payload>;
  payload: Accessor<Payload | undefined>;
}): JSX.Element {
  const { store, handle, interactions, children, payload } = parameters;

  if (handle) {
    createEffect(
      () => 0,
      () => handle.attachStore(store),
    );
  }

  return (
    <>
      {interactions?.()}
      {(() => {
        const resolved = children();
        if (typeof resolved === 'function') {
          return (resolved as PayloadChildRenderFunction<Payload>)({
            get payload() {
              return payload();
            },
          });
        }
        return resolved;
      })()}
    </>
  );
}

export type PayloadChildRenderFunction<Payload> = (arg: {
  payload: Payload | undefined;
}) => JSX.Element;

interface PopupRootStoreHandle<Store> {
  attachStore(store: Store): () => void;
}

function usePopupRootStore<Store extends PopupRootStore>(
  createStore: (defaultPopupId: string | undefined) => Store,
  defaultPopupId: string | undefined,
): Store {
  const nested = useFloatingParentNodeId() != null;

  const store = createStore(defaultPopupId);

  store.useSyncedValue('defaultPopupId', () => defaultPopupId);
  store.context.nested = nested;

  return store;
}

/**
 * Resolves the active trigger when the popup opens without one, keeps the trigger count in sync,
 * and optionally closes the popup when its active trigger unmounts.
 */
export function useImplicitActiveTrigger<State extends PopupStoreState<unknown>>(
  store: PopupTriggerDataStore<State> & {
    setOpen(open: boolean, eventDetails: BaseUIChangeEventDetails<typeof REASONS.none>): void;
  },
  options: {
    closeOnActiveTriggerUnmount?: boolean | undefined;
  } = {},
) {
  let resolvedActiveTriggerId: string | null = null;
  const open = store.useState('open');
  const reactiveTriggerCount = store.useState('triggerCount');
  const activeTriggerId = store.useState('activeTriggerId');
  const reactiveActiveTriggerElement = store.useState('activeTriggerElement');

  createEffect(
    () =>
      [
        open(),
        reactiveTriggerCount(),
        activeTriggerId(),
        reactiveActiveTriggerElement(),
        options.closeOnActiveTriggerUnmount ?? false,
      ] as const,
    ([isOpen, , , , closeOnActiveTriggerUnmount]) => {
      if (!isOpen) {
        resolvedActiveTriggerId = null;
        if (store.state.triggerCount !== 0) {
          store.set('triggerCount', 0);
        }
        if (store.state.openedWithoutTrigger) {
          store.set('openedWithoutTrigger', false);
        }
        return;
      }

      const triggerCount = store.context.triggerElements.size;
      const stateUpdates = {} as Pick<
        State,
        'triggerCount' | 'activeTriggerId' | 'activeTriggerElement'
      >;

      if (store.state.triggerCount !== triggerCount) {
        stateUpdates.triggerCount = triggerCount;
      }

      const currentActiveTriggerId = store.select('activeTriggerId');
      let lostActiveTriggerId: string | null = null;

      if (currentActiveTriggerId) {
        const activeTriggerElement =
          store.context.triggerElements.getById(currentActiveTriggerId);
        if (!activeTriggerElement) {
          for (const [triggerId, triggerElement] of store.context.triggerElements.entries()) {
            if (triggerElement === store.state.activeTriggerElement) {
              stateUpdates.activeTriggerId = triggerId;
              stateUpdates.activeTriggerElement = triggerElement;
              resolvedActiveTriggerId = triggerId;
              break;
            }
          }

          if (stateUpdates.activeTriggerId === undefined) {
            if (resolvedActiveTriggerId === currentActiveTriggerId) {
              lostActiveTriggerId = currentActiveTriggerId;
            } else {
              resolvedActiveTriggerId = null;
            }
          }
        } else {
          resolvedActiveTriggerId = currentActiveTriggerId;
          if (activeTriggerElement !== store.state.activeTriggerElement) {
            stateUpdates.activeTriggerElement = activeTriggerElement;
          }
        }
      } else {
        resolvedActiveTriggerId = null;
      }

      if (
        !lostActiveTriggerId &&
        !currentActiveTriggerId &&
        !store.state.openedWithoutTrigger &&
        triggerCount === 1
      ) {
        const iteratorResult = store.context.triggerElements.entries().next();
        if (!iteratorResult.done) {
          const [implicitTriggerId, implicitTriggerElement] = iteratorResult.value;
          stateUpdates.activeTriggerId = implicitTriggerId;
          stateUpdates.activeTriggerElement = implicitTriggerElement;
          resolvedActiveTriggerId = implicitTriggerId;
        }
      }

      if (
        stateUpdates.triggerCount !== undefined ||
        stateUpdates.activeTriggerId !== undefined ||
        stateUpdates.activeTriggerElement !== undefined
      ) {
        store.update(stateUpdates);
      }

      if (lostActiveTriggerId && closeOnActiveTriggerUnmount) {
        const lostId = lostActiveTriggerId;
        queueMicrotask(() => {
          if (
            store.select('open') &&
            store.select('activeTriggerId') === lostId &&
            !store.context.triggerElements.getById(lostId)
          ) {
            const eventDetails = createChangeEventDetails(REASONS.none);
            store.setOpen(false, eventDetails);
            if (!eventDetails.isCanceled) {
              store.update({
                activeTriggerId: null,
                activeTriggerElement: null,
              } as Pick<State, 'activeTriggerId' | 'activeTriggerElement'>);
            }
          }
        });
      }
    },
  );
}

function useOpenStateTransitions<State extends PopupStoreState<unknown>>(
  open: Accessor<boolean>,
  store: ReactStore<State, PopupStoreContext<never>, typeof popupStoreSelectors> & {
    resetOnUnmount(): void;
  },
  openProp: Accessor<boolean | undefined>,
  animateInitialOpen?: boolean,
  popupRef: { current: HTMLElement | null } = store.context.popupRef,
) {
  createEffect(openProp, (value) => {
    if (value === false) {
      store.set('open', false as State['open']);
    }
  });

  const preventUnmountingOnClose = store.useState('preventUnmountingOnClose');

  const { mounted, transitionStatus, forceUnmount } = useUnmountAfterClose({
    get open() {
      return open();
    },
    ref: popupRef,
    subscribeToAttach: store.subscribe,
    get preventUnmountOnClose() {
      return preventUnmountingOnClose();
    },
    setPreventUnmountOnClose: (preventUnmountOnClose) =>
      store.set('preventUnmountingOnClose', preventUnmountOnClose as State['preventUnmountingOnClose']),
    animateInitialOpen,
    onUnmount() {
      store.resetOnUnmount();
      store.context.onOpenChangeComplete?.(false);
    },
  });

  store.set('mounted', untrack(mounted) as State['mounted']);

  store.useSyncedValues(
    () =>
      ({ mounted: mounted(), transitionStatus: transitionStatus() }) as Pick<
        State,
        'mounted' | 'transitionStatus'
      >,
  );

  return { forceUnmount, transitionStatus };
}

/**
 * Clears the stored open method when the popup closes or the root unmounts.
 */
export function usePopupRootSync<
  State extends PopupStoreState<unknown> & {
    openMethod: InteractionType | null;
  },
>(
  store: ReactStore<State, PopupStoreContext<never>, typeof popupStoreSelectors>,
  open: Accessor<boolean>,
) {
  createEffect(open, (isOpen) => {
    if (!isOpen && store.state.openMethod !== null) {
      store.set('openMethod', null as State['openMethod']);
    }
  });

  onCleanup(() => {
    if (store.state.openMethod !== null) {
      store.set('openMethod', null as State['openMethod']);
    }
  });
}
