import { createEffect, type Accessor } from 'solid-js';
import { isElementDisabled } from '@base-ui-solid/utils/isElementDisabled';
import { createSyncSignal } from '@base-ui-solid/utils/createSyncSignal';
import { EMPTY_ARRAY } from '@base-ui-solid/utils/empty';
import { getTarget } from '@base-ui-solid/utils/shadowDom';
import type { RefObject } from '@base-ui-solid/utils/types';
import type { TextDirection } from '../../direction-context/DirectionContext';
import {
  COMPOSITE_KEYS,
  ARROW_DOWN,
  ARROW_LEFT,
  ARROW_RIGHT,
  ARROW_UP,
  END,
  HOME,
  MODIFIER_KEYS,
  findNonDisabledListIndex,
  getMaxListIndex,
  getMinListIndex,
  isListIndexDisabled,
  isIndexOutOfListBounds,
  isNativeInput,
  scrollIntoViewIfNeeded,
} from '../composite';
import type { ModifierKey } from '../composite';
import { ACTIVE_COMPOSITE_ITEM } from '../constants';
import type { CompositeMetadata } from '../list/CompositeList';
import type { HTMLProps } from '../../types';
import type { CompositeGridNavigator } from './gridNavigation';
import { assignRefs, type RefInput } from '../../useRenderElement';

export interface UseCompositeRootParameters {
  orientation?: 'horizontal' | 'vertical' | 'both' | undefined;
  grid?: CompositeGridNavigator | undefined;
  loopFocus?: boolean | undefined;
  onLoop?:
    | ((
        event: KeyboardEvent,
        prevIndex: number,
        nextIndex: number,
        elementsRef: RefObject<Array<HTMLElement | null>>,
      ) => number)
    | undefined;
  highlightedIndex?: number | undefined;
  onHighlightedIndexChange?: ((index: number) => void) | undefined;
  direction: TextDirection;
  rootRef?: RefInput<Element> | undefined;
  /**
   * When `true`, pressing the Home key moves focus to the first item,
   * and pressing the End key moves focus to the last item.
   * @default false
   */
  enableHomeAndEndKeys?: boolean | undefined;
  /**
   * When `true`, keypress events on Composite's navigation keys
   * be stopped with event.stopPropagation().
   * @default false
   */
  stopEventPropagation?: boolean | undefined;
  /**
   * Array of item indices to be considered disabled.
   * Used for composite items that are focusable when disabled.
   */
  disabledIndices?: number[] | undefined;
  /**
   * Array of modifier key values that should allow normal keyboard actions
   * when pressed. By default, all modifier keys prevent normal actions.
   * @default []
   */
  modifierKeys?: ModifierKey[] | undefined;
}

export interface UseCompositeRootReturnValue {
  props: HTMLProps;
  highlightedIndex: Accessor<number>;
  onHighlightedIndexChange: (index: number, shouldScrollIntoView?: boolean) => void;
  elementsRef: RefObject<Array<HTMLElement | null>>;
  onMapChange: (map: Map<Element, CompositeMetadata<any>>) => void;
  relayKeyboardEvent: (event: KeyboardEvent) => void;
  rootRef: (element: HTMLElement | null) => void;
}

/**
 * Parameters are read lazily, so they can be getters.
 */
export function useCompositeRoot(params: UseCompositeRootParameters): UseCompositeRootReturnValue {
  const loopFocus = () => params.loopFocus ?? true;
  const orientation = () => params.orientation ?? 'both';
  const enableHomeAndEndKeys = () => params.enableHomeAndEndKeys ?? false;
  const modifierKeys = () => params.modifierKeys ?? (EMPTY_ARRAY as ModifierKey[]);

  const [internalHighlightedIndex, internalSetHighlightedIndex] = createSyncSignal(0);

  let rootElement: HTMLElement | null = null;
  const rootRef = (element: HTMLElement | null) => {
    rootElement = element;
    assignRefs(params.rootRef as RefInput<HTMLElement | null>, element);
  };

  const elementsRef: RefObject<Array<HTMLElement | null>> = { current: [] };
  let hasSetDefaultIndex = false;
  let highlightedElement: HTMLElement | null = null;

  const highlightedIndex = () => params.highlightedIndex ?? internalHighlightedIndex();

  const onHighlightedIndexChange = (index: number, shouldScrollIntoView = false) => {
    highlightedElement = elementsRef.current[index] ?? null;
    (params.onHighlightedIndexChange ?? internalSetHighlightedIndex)(index);
    if (shouldScrollIntoView) {
      const newActiveItem = elementsRef.current[index];
      scrollIntoViewIfNeeded(rootElement, newActiveItem, params.direction, orientation());
    }
  };

  const onMapChange = (map: Map<Element, CompositeMetadata<any>>) => {
    if (map.size === 0) {
      return;
    }

    const disabledIndices = params.disabledIndices;
    const currentIndex = highlightedIndex();

    if (hasSetDefaultIndex) {
      const elements = elementsRef.current;
      const nextIndex = elements.indexOf(highlightedElement);

      if (nextIndex === -1) {
        const replacement = elements[currentIndex];
        if (!replacement || isListIndexDisabled(elements, currentIndex, disabledIndices)) {
          onHighlightedIndexChange(getFallbackIndex(elements, disabledIndices));
        } else {
          highlightedElement = replacement;
        }
      } else if (nextIndex !== currentIndex) {
        onHighlightedIndexChange(nextIndex);
      }
      return;
    }

    hasSetDefaultIndex = true;

    const sortedElements = Array.from(map.keys()) as Array<HTMLElement | null>;
    const activeItem =
      sortedElements.find((compositeElement) =>
        compositeElement?.hasAttribute(ACTIVE_COMPOSITE_ITEM),
      ) ?? null;
    const activeIndex = activeItem ? (map.get(activeItem)?.index ?? -1) : -1;

    if (activeIndex !== -1) {
      onHighlightedIndexChange(activeIndex);
    } else if (isListIndexDisabled(sortedElements, currentIndex, disabledIndices)) {
      const firstEnabledIndex = findNonDisabledListIndex(sortedElements, { disabledIndices });
      if (!isIndexOutOfListBounds(sortedElements, firstEnabledIndex)) {
        onHighlightedIndexChange(firstEnabledIndex);
      }
    }

    scrollIntoViewIfNeeded(rootElement, activeItem, params.direction, orientation());
  };

  createEffect(
    () => [params.disabledIndices, params.highlightedIndex, highlightedIndex()] as const,
    ([disabledIndices, externalHighlightedIndex, currentIndex]) => {
      if (disabledIndices == null || externalHighlightedIndex != null || !hasSetDefaultIndex) {
        return;
      }
      const elements = elementsRef.current;
      if (isListIndexDisabled(elements, currentIndex, disabledIndices)) {
        const firstEnabledIndex = findNonDisabledListIndex(elements, { disabledIndices });
        if (!isIndexOutOfListBounds(elements, firstEnabledIndex)) {
          onHighlightedIndexChange(firstEnabledIndex);
        }
      }
    },
  );

  const wrappedOnLoop = (event: KeyboardEvent, prevIndex: number, nextIndex: number) => {
    if (!params.onLoop) {
      return nextIndex;
    }
    return params.onLoop(event, prevIndex, nextIndex, elementsRef);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    const isHomeOrEnd = event.key === HOME || event.key === END;
    if (!COMPOSITE_KEYS.has(event.key) || (!enableHomeAndEndKeys() && isHomeOrEnd)) {
      return;
    }

    if (isModifierKeySet(event, modifierKeys())) {
      return;
    }

    const element = rootElement;
    if (!element) {
      return;
    }

    const direction = params.direction;
    const currentOrientation = orientation();
    const disabledIndices = params.disabledIndices;
    const currentIndex = highlightedIndex();
    const grid = params.grid;
    const onLoop = params.onLoop;
    const isGrid = grid != null;

    const isRtl = direction === 'rtl';

    const horizontalForwardKey = isRtl ? ARROW_LEFT : ARROW_RIGHT;
    const horizontalBackwardKey = isRtl ? ARROW_RIGHT : ARROW_LEFT;
    const forwardKey = currentOrientation === 'vertical' ? ARROW_DOWN : horizontalForwardKey;
    const backwardKey = currentOrientation === 'vertical' ? ARROW_UP : horizontalBackwardKey;

    const target = getTarget(event);
    if (target != null && isNativeInput(target) && !isElementDisabled(target)) {
      const selectionStart = target.selectionStart;
      const selectionEnd = target.selectionEnd;
      const textContent = target.value;
      if (selectionStart == null || event.shiftKey || selectionStart !== selectionEnd) {
        return;
      }
      if (event.key !== backwardKey && selectionStart < textContent.length) {
        return;
      }
      if (event.key !== forwardKey && selectionStart > 0) {
        return;
      }
    }

    let nextIndex = currentIndex;
    const minIndex = getMinListIndex(elementsRef, disabledIndices);
    const maxIndex = getMaxListIndex(elementsRef, disabledIndices);

    if (grid != null) {
      nextIndex = grid({
        disabledIndices,
        elementsRef,
        event,
        highlightedIndex: currentIndex,
        loopFocus: loopFocus(),
        maxIndex,
        minIndex,
        onLoop: wrappedOnLoop,
        orientation: currentOrientation,
        rtl: isRtl,
      });
    }

    const isForwardKey =
      (currentOrientation !== 'vertical' && event.key === horizontalForwardKey) ||
      (currentOrientation !== 'horizontal' && event.key === ARROW_DOWN);
    const isBackwardKey =
      (currentOrientation !== 'vertical' && event.key === horizontalBackwardKey) ||
      (currentOrientation !== 'horizontal' && event.key === ARROW_UP);

    if (enableHomeAndEndKeys()) {
      if (event.key === HOME) {
        nextIndex = minIndex;
      } else if (event.key === END) {
        nextIndex = maxIndex;
      }
    }

    if (nextIndex === currentIndex && (isForwardKey || isBackwardKey)) {
      if (loopFocus() && nextIndex === maxIndex && isForwardKey) {
        nextIndex = minIndex;
        if (onLoop) {
          nextIndex = onLoop(event, currentIndex, nextIndex, elementsRef);
        }
      } else if (loopFocus() && nextIndex === minIndex && isBackwardKey) {
        nextIndex = maxIndex;
        if (onLoop) {
          nextIndex = onLoop(event, currentIndex, nextIndex, elementsRef);
        }
      } else {
        nextIndex = findNonDisabledListIndex(elementsRef.current, {
          startingIndex: nextIndex,
          decrement: isBackwardKey,
          disabledIndices,
        });
      }
    }

    if (nextIndex !== currentIndex && !isIndexOutOfListBounds(elementsRef.current, nextIndex)) {
      if (params.stopEventPropagation) {
        event.stopPropagation();
      }

      if (isGrid || isHomeOrEnd || isForwardKey || isBackwardKey) {
        event.preventDefault();
      }
      onHighlightedIndexChange(nextIndex, true);

      queueMicrotask(() => {
        elementsRef.current[nextIndex]?.focus();
      });
    }
  };

  const props: HTMLProps = {
    onFocusIn(event: FocusEvent) {
      const element = rootElement;
      const target = getTarget(event);
      if (!element || target == null || !isNativeInput(target)) {
        return;
      }
      target.setSelectionRange(0, target.value.length);
    },
    onKeyDown,
  };

  return {
    props,
    highlightedIndex,
    onHighlightedIndexChange,
    elementsRef,
    onMapChange,
    relayKeyboardEvent: onKeyDown,
    rootRef,
  };
}

function getFallbackIndex(elements: Array<HTMLElement | null>, disabledIndices?: number[]) {
  let fallbackIndex = -1;

  for (let index = 0; index < elements.length; index += 1) {
    const element = elements[index];

    if (!element || isListIndexDisabled(elements, index, disabledIndices)) {
      continue;
    }

    if (element.hasAttribute(ACTIVE_COMPOSITE_ITEM)) {
      return index;
    }

    if (fallbackIndex === -1) {
      fallbackIndex = index;
    }
  }

  return Math.max(fallbackIndex, 0);
}

function isModifierKeySet(event: KeyboardEvent, ignoredModifierKeys: ModifierKey[]) {
  for (const key of MODIFIER_KEYS) {
    if (ignoredModifierKeys.includes(key)) {
      continue;
    }
    if (event.getModifierState(key)) {
      return true;
    }
  }
  return false;
}
