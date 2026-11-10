import { createEffect, onCleanup, type Accessor } from 'solid-js';
import { NOOP } from '../noop';
import { useBaseUiId } from '../useBaseUiId';
import { useLabelableContext } from './LabelableContext';

/**
 * Registers a control id in the surrounding labelable scope.
 * Parameters are read lazily, so they can be getters.
 * @returns an accessor of the resolved control id
 */
export function useLabelableId(params: UseLabelableIdParameters = {}): Accessor<string> {
  const context = useLabelableContext();
  const registerControlId = context.registerControlId;

  const defaultId = useBaseUiId();

  const controlSource = Symbol();
  let hasRegistered = false;
  let hadExplicitId = false;

  const unregisterControlId = () => {
    if (!hasRegistered || registerControlId === NOOP) {
      return;
    }

    hasRegistered = false;
    registerControlId(controlSource, undefined);
  };

  createEffect(
    () => [params.id, params.enabled ?? true] as const,
    ([id, enabled]) => {
      if (!enabled || registerControlId === NOOP) {
        unregisterControlId();
        return undefined;
      }

      let nextId: string | null | undefined;

      if (id !== undefined) {
        hadExplicitId = true;
        nextId = id;
      } else if (hadExplicitId) {
        nextId = defaultId();
      } else {
        context.resetControlId();
        return undefined;
      }

      if (nextId === undefined) {
        unregisterControlId();
        return undefined;
      }

      hasRegistered = true;
      registerControlId(controlSource, nextId);

      return undefined;
    },
  );

  onCleanup(unregisterControlId);

  return () =>
    ((params.enabled ?? true) ? context.controlId : undefined) ?? params.id ?? defaultId();
}

export interface UseLabelableIdParameters {
  /**
   * The control's `id`. Pass `null` for a control that takes its name from `aria-labelledby`
   * instead, so that the label omits `for`.
   */
  id?: string | null | undefined;
  /**
   * Whether the control owns the label association of its labelable scope.
   * @default true
   */
  enabled?: boolean | undefined;
}

export type UseLabelableIdReturnValue = Accessor<string>;

export interface UseLabelableIdState {}
