import { createEffect, type Accessor } from 'solid-js';
import { useAnimationsFinished } from './useAnimationsFinished';

interface TriggerSwitchStore {
  readonly state: { readonly instantType: string | undefined };
  set(key: 'instantType', value: 'trigger-change' | undefined): void;
  select(key: 'open'): boolean;
}

export interface UseTriggerSwitchTransitionParameters {
  store: TriggerSwitchStore;
  domReference: Accessor<Element | null>;
  positionerElement: Accessor<HTMLElement | null>;
  open: Accessor<boolean>;
}

/**
 * Marks a switch between triggers while the popup stays open, so CSS can skip the open
 * animation when the popup jumps to another trigger.
 */
export function useTriggerSwitchTransition(parameters: UseTriggerSwitchTransitionParameters): void {
  const { store } = parameters;

  let previousTrigger: Element | null = null;
  let pendingSwitch: AbortController | null = null;
  const runOnceAnimationsFinish = useAnimationsFinished(() => parameters.positionerElement());

  createEffect(parameters.open, (open) => {
    if (open) {
      return;
    }

    pendingSwitch?.abort();
    pendingSwitch = null;

    if (store.state.instantType === 'trigger-change') {
      store.set('instantType', undefined);
    }
  });

  createEffect(parameters.domReference, (currentTrigger) => {
    const previous = previousTrigger;

    if (currentTrigger) {
      previousTrigger = currentTrigger;
    }

    if (!previous || !currentTrigger || currentTrigger === previous) {
      return undefined;
    }

    if (!store.select('open')) {
      return undefined;
    }

    store.set('instantType', undefined);

    const abortController = new AbortController();
    pendingSwitch = abortController;

    runOnceAnimationsFinish(() => {
      if (store.select('open')) {
        store.set('instantType', 'trigger-change');
      }
    }, abortController.signal);

    return () => {
      abortController.abort();
    };
  });
}
