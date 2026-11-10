import { createMemo, omit, untrack } from 'solid-js';
import { createSyncSignal } from '@base-ui-solid/utils/createSyncSignal';
import type { JSX } from '@solidjs/web';
import { usePreviewCardRootContext } from '../root/PreviewCardContext';
import type { BaseUIComponentProps } from '../../internals/types';
import type { RefInput } from '../../internals/useRenderElement';
import { useRenderElement } from '../../internals/useRenderElement';
import { triggerOpenStateMapping } from '../../utils/popups/popupStateMapping';
import { useBaseUiId } from '../../internals/useBaseUiId';
import { usePopupHandleStore } from '../../utils/popups/usePopupHandleStore';
import { useTriggerDataForwarding } from '../../utils/popups/popupStoreUtils';
import { safePolygon } from '../../utils/popups/interactions/safePolygon';
import { useFocus } from '../../utils/popups/interactions/useFocus';
import { useHoverTriggerInteraction } from '../../utils/popups/interactions/useHoverTriggerInteraction';
import { getInlineRectTriggerProps } from '../../utils/popups/inlineRect';
import { mergeProps } from '../../merge-props';
import type { PreviewCardHandle } from '../store/PreviewCardHandle';
import { CLOSE_DELAY, OPEN_DELAY } from '../utils/constants';
import { ownedProps } from '../../internals/ownedProps';

/**
 * A link that opens the preview card.
 * Renders an `<a>` element.
 *
 * Documentation: [Base UI Preview Card](https://base-ui.com/react/components/preview-card)
 */
export function PreviewCardTrigger<Payload = unknown>(
  componentProps: PreviewCardTrigger.Props<Payload>,
) {
  componentProps = ownedProps(componentProps);
  const elementProps = omit(
    componentProps,
    'render',
    'class',
    'style',
    'delay',
    'closeDelay',
    'id',
    'payload',
    'handle',
    'children',
    'ref',
  );

  const rootStore = usePreviewCardRootContext(true);
  const handleStore = usePopupHandleStore(untrack(() => componentProps.handle) as any);
  const store = (handleStore ?? rootStore) as NonNullable<typeof rootStore>;
  if (!store) {
    throw new Error(
      'Base UI: <PreviewCard.Trigger> must be either used within a <PreviewCard.Root> component or provided with a handle.',
    );
  }

  const thisTriggerId = useBaseUiId(() => componentProps.id);
  const isTriggerActive = store.useState('isTriggerActive', thisTriggerId);
  const isOpenedByThisTrigger = store.useState('isOpenedByTrigger', thisTriggerId);
  const inlineRectCoordsRef = store.context.inlineRectCoordsRef;

  const [triggerElement, setTriggerElement] = createSyncSignal<Element | null>(null);

  const delayWithDefault = () => componentProps.delay ?? OPEN_DELAY;
  const closeDelayWithDefault = () => componentProps.closeDelay ?? CLOSE_DELAY;

  const { registerTrigger, isMountedByThisTrigger } = useTriggerDataForwarding(
    thisTriggerId,
    triggerElement as any,
    store,
    () => ({
      payload: componentProps.payload,
      closeDelay: closeDelayWithDefault(),
    }),
  );

  const hoverProps = useHoverTriggerInteraction(store, {
    mouseOnly: true,
    move: false,
    handleClose: safePolygon(),
    delay: () => untrack(() => ({ open: delayWithDefault(), close: closeDelayWithDefault() })),
    triggerElement,
    get isActiveTrigger() {
      return isTriggerActive();
    },
  } as any);

  const focusProps = useFocus(store, {
    get delay() {
      return delayWithDefault();
    },
  });

  const state = createMemo<PreviewCardTriggerState>(() => ({ open: isOpenedByThisTrigger() }));

  const rootTriggerProps = store.useState('triggerProps', isMountedByThisTrigger);
  const inlineRectTriggerProps = getInlineRectTriggerProps(inlineRectCoordsRef, () =>
    untrack(isOpenedByThisTrigger),
  );

  return useRenderElement('a', componentProps, {
    state,
    ref: [
      registerTrigger,
      (el: Element | null) => {
        setTriggerElement(el);
      },
    ],
    props: [
      hoverProps,
      (merged: Record<string, any>) => mergeProps(merged, focusProps.reference),
      (merged: Record<string, any>) => mergeProps(merged, rootTriggerProps()),
      inlineRectTriggerProps,
      {
        get id() {
          return thisTriggerId();
        },
      },
      elementProps,
    ],
    stateAttributesMapping: triggerOpenStateMapping,
  });
}

export interface PreviewCardTriggerState {
  /**
   * Whether the preview card is currently open and was opened by this trigger.
   */
  open: boolean;
}

export interface PreviewCardTriggerProps<Payload = unknown> extends BaseUIComponentProps<
  'a',
  PreviewCardTriggerState,
  JSX.IntrinsicElements['a']
> {
  /**
   * A handle to associate the trigger with a preview card.
   */
  handle?: PreviewCardHandle<Payload> | undefined;
  /**
   * A payload to pass to the preview card when it is opened.
   */
  payload?: Payload | undefined;
  /**
   * How long to wait before the preview card opens. Specified in milliseconds.
   * @default 600
   */
  delay?: number | undefined;
  /**
   * How long to wait before closing the preview card. Specified in milliseconds.
   * @default 300
   */
  closeDelay?: number | undefined;
}

export namespace PreviewCardTrigger {
  export type State = PreviewCardTriggerState;
  export type Props<Payload = unknown> = PreviewCardTriggerProps<Payload>;
}
