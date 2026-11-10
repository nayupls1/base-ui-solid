import { createMemo, omit, type Accessor } from 'solid-js';
import type { JSX } from '@solidjs/web';
import type { ReactStore } from '@base-ui-solid/utils/store';
import { useAnchorPositioning } from '../../internals/useAnchorPositioning';
import { POPUP_COLLISION_AVOIDANCE } from '../../internals/constants';
import type {
  Align,
  Side,
  UseAnchorPositioningParameters,
  UseAnchorPositioningReturnValue,
  UseAnchorPositioningSharedParameters,
} from '../../internals/useAnchorPositioning';
import type { BaseUIComponentProps } from '../../internals/types';
import type { RefInput } from '../../internals/useRenderElement';
import type { AdaptiveOriginMiddleware } from './positioning/adaptiveOriginConstants';
import { usePositioner } from './positioning/usePositioner';
import type { PositioningInteractionStore } from './types';
import type { PopupStoreContext, PopupStoreSelectors, PopupStoreState } from './store';

/**
 * The state every popup Positioner shares.
 */
export interface PopupPositionerState {
  /**
   * Whether the popup is currently open.
   */
  open: boolean;
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
  /**
   * Whether CSS transitions should be disabled.
   */
  instant: string | undefined;
}

type PopupPositionerStoreState = PopupStoreState<unknown> & {
  instantType: string | undefined;
  adaptiveOrigin: AdaptiveOriginMiddleware | undefined;
};

type PopupPositionerStore = ReactStore<
  PopupPositionerStoreState,
  PopupStoreContext<never>,
  PopupStoreSelectors & {
    instantType: (state: PopupPositionerStoreState) => string | undefined;
    adaptiveOrigin: (state: PopupPositionerStoreState) => AdaptiveOriginMiddleware | undefined;
  }
> &
  PositioningInteractionStore;

export interface UsePopupPositionerOptions<State extends PopupPositionerState> {
  /**
   * Whether the popup stays mounted while closed.
   */
  keepMounted: boolean;
  /**
   * Positioning parameters that replace the props, such as values derived from the popup's parent.
   */
  positioning?:
    | Partial<
        Omit<
          UseAnchorPositioningParameters,
          'interactionStore' | 'mounted' | 'keepMounted' | 'adaptiveOrigin'
        >
      >
    | undefined;
  /**
   * State that the part adds to or changes in the shared state.
   */
  state?: (Omit<State, keyof PopupPositionerState> & Partial<PopupPositionerState>) | undefined;
  /**
   * Whether the positioner ignores pointer events.
   * @default !open
   */
  inert?: boolean | undefined;
}

export interface UsePopupPositionerReturnValue<State> {
  /**
   * Creates the positioner element. Call it inside the part's context providers.
   */
  element: () => JSX.Element;
  positioning: UseAnchorPositioningReturnValue;
  open: Accessor<boolean>;
  mounted: Accessor<boolean>;
  state: Accessor<State>;
}

const POSITIONER_KEYS = [
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
] as const;

/**
 * Runs what every popup Positioner does: it positions the popup against its anchor, registers the
 * positioner element, and renders it with the shared state.
 * The part adds what is specific to its popup, such as a backdrop or a scroll lock.
 * Options are read lazily, so they can be getters.
 */
export function usePopupPositioner<State extends PopupPositionerState>(
  store: PopupPositionerStore,
  componentProps: BaseUIComponentProps<'div', State> &
    UseAnchorPositioningSharedParameters & { ref?: RefInput<HTMLDivElement> },
  options: UsePopupPositionerOptions<State>,
  omitKeys: readonly string[] = [],
): UsePopupPositionerReturnValue<State> {
  const elementProps = omit(componentProps as any, ...POSITIONER_KEYS, ...omitKeys);

  const open = store.useState('open');
  const mounted = store.useState('mounted');
  const transitionStatus = store.useState('transitionStatus');
  const instantType = store.useState('instantType');
  const adaptiveOrigin = store.useState('adaptiveOrigin');

  const override = <K extends keyof UseAnchorPositioningParameters>(
    key: K,
    fallback: () => UseAnchorPositioningParameters[K],
  ) =>
    options.positioning && key in options.positioning
      ? (options.positioning[key] as UseAnchorPositioningParameters[K])
      : fallback();

  const positioning = useAnchorPositioning({
    get anchor() {
      return override('anchor', () => componentProps.anchor);
    },
    interactionStore: store,
    get positionMethod() {
      return override('positionMethod', () => componentProps.positionMethod);
    },
    get mounted() {
      return mounted();
    },
    get side() {
      return override('side', () => componentProps.side);
    },
    get sideOffset() {
      return override('sideOffset', () => componentProps.sideOffset);
    },
    get align() {
      return override('align', () => componentProps.align);
    },
    get alignOffset() {
      return override('alignOffset', () => componentProps.alignOffset);
    },
    get arrowPadding() {
      return override('arrowPadding', () => componentProps.arrowPadding);
    },
    get collisionBoundary() {
      return override('collisionBoundary', () => componentProps.collisionBoundary);
    },
    get collisionPadding() {
      return override('collisionPadding', () => componentProps.collisionPadding);
    },
    get sticky() {
      return override('sticky', () => componentProps.sticky);
    },
    get disableAnchorTracking() {
      return override('disableAnchorTracking', () => componentProps.disableAnchorTracking);
    },
    get keepMounted() {
      return options.keepMounted;
    },
    get collisionAvoidance() {
      return override(
        'collisionAvoidance',
        () => componentProps.collisionAvoidance ?? POPUP_COLLISION_AVOIDANCE,
      ) as NonNullable<UseAnchorPositioningParameters['collisionAvoidance']>;
    },
    get adaptiveOrigin() {
      return adaptiveOrigin();
    },
    get nodeId() {
      return options.positioning?.nodeId;
    },
    get shift() {
      return options.positioning?.shift;
    },
    get lazyFlip() {
      return options.positioning?.lazyFlip;
    },
    get externalTree() {
      return options.positioning?.externalTree;
    },
    get inline() {
      return options.positioning?.inline;
    },
  });

  const state = createMemo(
    () =>
      ({
        open: open(),
        side: positioning.side,
        align: positioning.align,
        anchorHidden: positioning.anchorHidden,
        instant: instantType(),
        ...options.state,
      }) as State,
  );

  const positionerElementSetter = store.useStateSetter('positionerElement');

  const element = () =>
    usePositioner(componentProps, state, {
      get styles() {
        return positioning.positionerStyles;
      },
      get transitionStatus() {
        return transitionStatus();
      },
      props: elementProps,
      refs: [
        (el: HTMLDivElement | null) => {
          positionerElementSetter(el as any);
        },
      ],
      get hidden() {
        return !mounted();
      },
      get inert() {
        return options.inert ?? !open();
      },
    });

  return { element, positioning, open, mounted, state };
}
