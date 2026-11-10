import { isHTMLElement, isShadowRoot } from '@floating-ui/utils/dom';
import { ownerDocument } from 'base-ui-solidjs-utils/owner';
import { closest, getTarget } from 'base-ui-solidjs-utils/shadowDom';
import { useRegisteredLabelId } from '../../utils/useRegisteredLabelId';
import { useLabelableContext } from './LabelableContext';
import type { HTMLProps } from '../types';

type SetStateAction<T> = T | ((prev: T) => T);

/**
 * Returns props for a label element. Parameters are read lazily, so they can be getters.
 * The returned object has getters, so read it inside a reactive scope.
 */
export function useLabel(params: UseLabelParameters = {}): UseLabelReturnValue {
  const context = useLabelableContext();

  const syncLabelId = (nextLabelId: SetStateAction<string | undefined>) => {
    context.setLabelId(nextLabelId);
    params.setLabelId?.(nextLabelId);
  };

  const id = useRegisteredLabelId(() => params.id, syncLabelId);

  const resolvedControlId = () => context.controlId ?? params.fallbackControlId;

  function focusControl(event: MouseEvent) {
    const controlId = resolvedControlId();
    if (params.focusControl) {
      params.focusControl(event, controlId ?? undefined);
      return;
    }

    if (!controlId) {
      return;
    }

    const controlElement = getControlById(event.currentTarget as Element, controlId);
    if (isHTMLElement(controlElement)) {
      focusElementWithVisible(controlElement);
    }
  }

  function handleInteraction(event: MouseEvent) {
    const target = getTarget(event) as HTMLElement | null;
    if (closest(target, 'button,input,select,textarea')) {
      return;
    }

    if (!event.defaultPrevented && event.detail > 1) {
      event.preventDefault();
    }

    if (params.native) {
      return;
    }

    focusControl(event);
  }

  if (params.native) {
    return {
      get id() {
        return id();
      },
      get for() {
        return resolvedControlId() ?? undefined;
      },
      onMouseDown: handleInteraction,
    };
  }

  return {
    get id() {
      return id();
    },
    onClick: handleInteraction,
    onPointerDown(event: PointerEvent) {
      event.preventDefault();
    },
  };
}

export interface UseLabelParameters {
  id?: string | undefined;
  /**
   * Control id used when no labelable context control id exists.
   */
  fallbackControlId?: string | undefined;
  /**
   * Whether the rendered element is a native `<label>`. Read once.
   * @default false
   */
  native?: boolean | undefined;
  /**
   * Additional callback to sync the current label id with local component state/store.
   */
  setLabelId?: ((value: SetStateAction<string | undefined>) => void) | undefined;
  /**
   * Custom focus handler for non-native labels.
   * If omitted, focus behavior targets the resolved control id.
   */
  focusControl?: ((event: MouseEvent, controlId: string | undefined) => void) | undefined;
}

export type UseLabelReturnValue = HTMLProps;

export function getControlById(label: Element, id: string) {
  let root = label.getRootNode();
  while (isShadowRoot(root)) {
    const element = root.getElementById(id);
    if (element) {
      return element;
    }
    root = root.host.getRootNode();
  }
  return ownerDocument(label).getElementById(id);
}

export function focusElementWithVisible(element: HTMLElement) {
  element.focus({
    // @ts-expect-error - focusVisible is not yet in the DOM types
    focusVisible: true,
  });
}
