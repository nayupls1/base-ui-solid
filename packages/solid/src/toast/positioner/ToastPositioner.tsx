import { createMemo, createSignal, omit, untrack } from 'solid-js';
import { isElement } from '@floating-ui/utils/dom';
import { EMPTY_OBJECT } from 'base-ui-solidjs-utils/empty';
import { useAnchorPositioning } from '../../internals/useAnchorPositioning';
import type {
  Side,
  Align,
  UseAnchorPositioningSharedParameters,
} from '../../internals/useAnchorPositioning';
import type { BaseUIComponentProps } from '../../internals/types';
import { POPUP_COLLISION_AVOIDANCE } from '../../internals/constants';
import { ToastPositionerContext } from './ToastPositionerContext';
import { useFloatingRootStore } from '../../utils/popups/floating-root/useFloatingRootStore';
import { NOOP } from '../../internals/noop';
import type { ToastObject } from '../useToastManager';
import { useToastProviderContext } from '../provider/ToastProviderContext';
import { usePositioner } from '../../utils/popups/positioning/usePositioner';
import * as ToastRootCssVars from '../root/ToastRootCssVars';
import { ownedProps } from '../../internals/ownedProps';

/**
 * Positions the toast against the anchor.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Toast](https://base-ui.com/react/components/toast)
 */
export function ToastPositioner(componentProps: ToastPositioner.Props) {
  componentProps = ownedProps(componentProps);
  const elementProps = omit(
    componentProps,
    'toast',
    'render',
    'class',
    'style',
    'anchor',
    'positionMethod',
    'side',
    'align',
    'sideOffset',
    'alignOffset',
    'collisionBoundary',
    'collisionPadding',
    'arrowPadding',
    'sticky',
    'disableAnchorTracking',
    'collisionAvoidance',
    'children',
    'ref',
  );

  const store = useToastProviderContext();

  const toast = () => componentProps.toast;
  const positionerProps = () =>
    (toast().positionerProps ?? EMPTY_OBJECT) as NonNullable<ToastObject<any>['positionerProps']>;

  const resolved = {
    get anchor() {
      return componentProps.anchor ?? positionerProps().anchor;
    },
    get positionMethod() {
      return componentProps.positionMethod ?? positionerProps().positionMethod;
    },
    get side() {
      return componentProps.side ?? positionerProps().side ?? 'top';
    },
    get align() {
      return componentProps.align ?? positionerProps().align ?? 'center';
    },
    get sideOffset() {
      return componentProps.sideOffset ?? positionerProps().sideOffset;
    },
    get alignOffset() {
      return componentProps.alignOffset ?? positionerProps().alignOffset;
    },
    get collisionBoundary() {
      return componentProps.collisionBoundary ?? positionerProps().collisionBoundary;
    },
    get collisionPadding() {
      return componentProps.collisionPadding ?? positionerProps().collisionPadding;
    },
    get arrowPadding() {
      return componentProps.arrowPadding ?? positionerProps().arrowPadding;
    },
    get sticky() {
      return componentProps.sticky ?? positionerProps().sticky;
    },
    get disableAnchorTracking() {
      return componentProps.disableAnchorTracking ?? positionerProps().disableAnchorTracking;
    },
    get collisionAvoidance() {
      return (
        componentProps.collisionAvoidance ??
        positionerProps().collisionAvoidance ??
        POPUP_COLLISION_AVOIDANCE
      );
    },
  };

  const [positionerElement, setPositionerElement] = createSignal<HTMLDivElement | null>(null, {
    ownedWrite: true,
  });

  const domIndex = store.useState('toastIndex', () => toast().id);
  const visibleIndex = store.useState('toastVisibleIndex', () => toast().id);

  const anchor = createMemo(() => {
    const anchorProp = resolved.anchor;
    return isElement(anchorProp) ? (anchorProp as Element) : null;
  });

  const floatingRootStore = useFloatingRootStore({
    open: true,
    onOpenChange: NOOP,
    elements: {
      get positionerElement() {
        return positionerElement();
      },
      get anchor() {
        return anchor();
      },
    },
  });

  const positioning = useAnchorPositioning({
    get anchor() {
      return anchor();
    },
    get positionMethod() {
      return resolved.positionMethod;
    },
    interactionStore: floatingRootStore,
    mounted: true,
    get side() {
      return resolved.side;
    },
    get sideOffset() {
      return resolved.sideOffset;
    },
    get align() {
      return resolved.align;
    },
    get alignOffset() {
      return resolved.alignOffset;
    },
    get collisionBoundary() {
      return resolved.collisionBoundary;
    },
    get collisionPadding() {
      return resolved.collisionPadding;
    },
    get sticky() {
      return resolved.sticky;
    },
    get arrowPadding() {
      return resolved.arrowPadding;
    },
    get disableAnchorTracking() {
      return resolved.disableAnchorTracking;
    },
    keepMounted: true,
    get collisionAvoidance() {
      return resolved.collisionAvoidance as any;
    },
  } as any);

  const state = createMemo<ToastPositionerState>(() => ({
    side: positioning.side,
    align: positioning.align,
    anchorHidden: positioning.anchorHidden,
  }));

  const positionerContext: ToastPositionerContext = {
    get side() {
      return positioning.side;
    },
    get align() {
      return positioning.align;
    },
    arrowRef: positioning.arrowRef,
    get arrowUncentered() {
      return positioning.arrowUncentered;
    },
    get arrowStyles() {
      return positioning.arrowStyles;
    },
  };

  return (
    <ToastPositionerContext value={positionerContext}>
      {untrack(() =>
        usePositioner(componentProps as any, state, {
          get styles() {
            return {
              ...positioning.positionerStyles,
              [ToastRootCssVars.index as string]:
                toast().transitionStatus === 'ending' ? domIndex() : visibleIndex(),
            };
          },
          get transitionStatus() {
            return toast().transitionStatus;
          },
          props: elementProps,
          refs: [(el: HTMLDivElement | null) => setPositionerElement(el)],
        } as any),
      )}
    </ToastPositionerContext>
  );
}

export interface ToastPositionerState {
  /**
   * The side of the anchor the component is placed on.
   */
  side: Side;
  /**
   * The alignment of the component relative to the anchor.
   */
  align: Align;
  /**
   * Whether the anchor element is hidden.
   */
  anchorHidden: boolean;
}

export interface ToastPositionerProps
  extends
    BaseUIComponentProps<'div', ToastPositionerState>,
    Omit<UseAnchorPositioningSharedParameters, 'side' | 'anchor'> {
  /**
   * An element to position the toast against.
   */
  anchor?: Element | null | undefined;
  /**
   * Which side of the anchor element to align the toast against.
   * May automatically change to avoid collisions.
   * @default 'top'
   */
  side?: Side | undefined;
  /**
   * The toast object associated with the positioner.
   */
  toast: ToastObject<any>;
}

export namespace ToastPositioner {
  export type State = ToastPositionerState;
  export type Props = ToastPositionerProps;
}
