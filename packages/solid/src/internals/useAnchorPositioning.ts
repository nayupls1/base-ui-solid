import { createEffect, createMemo, untrack, type Accessor } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { getSide, getAlignment, getSideAxis } from '@floating-ui/utils';
import type { Rect } from '@floating-ui/utils';
import { autoUpdate } from '@floating-ui/dom';
import type {
  Placement,
  VirtualElement,
  Padding,
  Side as PhysicalSide,
  MiddlewareState,
  AutoUpdateOptions,
  Middleware,
} from '@floating-ui/dom';
import { ownerDocument, ownerWindow } from 'base-ui-solidjs-utils/owner';
import { createSyncSignal } from 'base-ui-solidjs-utils/createSyncSignal';
import type { RefObject } from 'base-ui-solidjs-utils/types';
import type {
  UseFloatingReturn,
  PositioningInteractionStore,
  PopupPositioningContext,
} from '../utils/popups/types';
import type { FloatingTreeStore } from '../utils/popups/tree/FloatingTreeStore';
import { useBaseUIFloating } from '../utils/popups/positioning/useFloating';
import { flip, limitShift, offset, shift as floatingShift, size } from '../utils/popups/positioning/middleware';
import { useDirection } from './direction-context/DirectionContext';
import { arrow } from '../utils/popups/positioning/arrow';
import { hide } from '../utils/popups/positioning/hideMiddleware';
import { DEFAULT_SIDES } from '../utils/popups/positioning/adaptiveOriginConstants';
import * as CommonPositionerCssVars from '../utils/popups/positioning/CommonPositionerCssVars';

export { useFloatingRootStore } from '../utils/popups/floating-root/useFloatingRootStore';
export type { UseFloatingRootStoreOptions } from '../utils/popups/floating-root/useFloatingRootStore';
export type { FloatingRootStore } from '../utils/popups/floating-root/FloatingRootStore';
export type { PositioningInteractionStore } from '../utils/popups/types';

const AVAILABLE_WIDTH_VAR = CommonPositionerCssVars.availableWidth;
const AVAILABLE_HEIGHT_VAR = CommonPositionerCssVars.availableHeight;

function getLogicalSide(sideParam: Side, renderedSide: PhysicalSide, isRtl: boolean): Side {
  const isLogicalSideParam = sideParam === 'inline-start' || sideParam === 'inline-end';
  const logicalRight = isRtl ? 'inline-start' : 'inline-end';
  const logicalLeft = isRtl ? 'inline-end' : 'inline-start';
  return (
    {
      top: 'top',
      right: isLogicalSideParam ? logicalRight : 'right',
      bottom: 'bottom',
      left: isLogicalSideParam ? logicalLeft : 'left',
    } satisfies Record<PhysicalSide, Side>
  )[renderedSide];
}

function getOffsetData(state: MiddlewareState, sideParam: Side, isRtl: boolean) {
  const { rects, placement } = state;
  const data = {
    side: getLogicalSide(sideParam, getSide(placement), isRtl),
    align: getAlignment(placement) || 'center',
    anchor: { width: rects.reference.width, height: rects.reference.height },
    positioner: { width: rects.floating.width, height: rects.floating.height },
  } as const;
  return data;
}

export type Side = 'top' | 'bottom' | 'left' | 'right' | 'inline-end' | 'inline-start';
export type Align = 'start' | 'center' | 'end';
export type Boundary = 'clipping-ancestors' | Element | Element[] | Rect;
export type OffsetFunction = (data: {
  side: Side;
  align: Align;
  anchor: { width: number; height: number };
  positioner: { width: number; height: number };
}) => number;

interface SideFlipMode {
  /**
   * How to avoid collisions on the side axis.
   * - `'flip'`: If there is not enough space, place the popup on the opposite side.
   * - `'none'`: Keep the preferred side even if it overflows.
   */
  side?: 'flip' | 'none' | undefined;
  /**
   * How to avoid collisions on the align axis.
   * - `'flip'`: If there is not enough space, swap `'start'` and `'end'` alignment.
   * - `'shift'`: Keep the alignment and shift the popup to fit within the boundary.
   * - `'none'`: Keep the preferred alignment even if it overflows.
   */
  align?: 'flip' | 'shift' | 'none' | undefined;
  /**
   * If both sides on the preferred axis do not fit, determines whether to fallback
   * to a side on the perpendicular axis and which logical side to prefer.
   * - `'start'`: Prefer the logical start side on the perpendicular axis.
   * - `'end'`: Prefer the logical end side on the perpendicular axis.
   * - `'none'`: Do not fallback to the perpendicular axis.
   */
  fallbackAxisSide?: 'start' | 'end' | 'none' | undefined;
}

interface SideShiftMode {
  /**
   * How to avoid collisions on the side axis.
   * - `'shift'`: Keep the preferred side and shift the popup to fit within the boundary.
   * - `'none'`: Keep the preferred side even if it overflows.
   */
  side?: 'shift' | 'none' | undefined;
  /**
   * How to avoid collisions on the align axis.
   * - `'shift'`: Keep the alignment and shift the popup to fit within the boundary.
   * - `'none'`: Keep the preferred alignment even if it overflows.
   */
  align?: 'shift' | 'none' | undefined;
  /**
   * If both sides on the preferred axis do not fit, determines whether to fallback
   * to a side on the perpendicular axis and which logical side to prefer.
   * - `'start'`: Prefer the logical start side on the perpendicular axis.
   * - `'end'`: Prefer the logical end side on the perpendicular axis.
   * - `'none'`: Do not fallback to the perpendicular axis.
   */
  fallbackAxisSide?: 'start' | 'end' | 'none' | undefined;
}

export type CollisionAvoidance = SideFlipMode | SideShiftMode;

/**
 * Provides standardized anchor positioning behavior for floating elements. Wraps Floating UI's
 * `useFloating` hook.
 */
/**
 * Provides standardized anchor positioning behavior for floating elements. Wraps Floating UI's
 * `useFloating` hook. Parameters are read lazily, so they can be getters.
 */
export function useAnchorPositioning(
  params: UseAnchorPositioningParameters,
): UseAnchorPositioningReturnValue {
  const positionMethod = () => params.positionMethod ?? 'absolute';
  const sideParam = () => params.side ?? 'bottom';
  const sideOffset = () => params.sideOffset ?? 0;
  const align = () => params.align ?? 'center';
  const alignOffset = () => params.alignOffset ?? 0;
  const collisionBoundary = () => params.collisionBoundary ?? 'clipping-ancestors';
  const collisionPaddingParam = () => params.collisionPadding ?? 5;
  const sticky = () => params.sticky ?? false;
  const arrowPadding = () => params.arrowPadding ?? 5;
  const disableAnchorTracking = () => params.disableAnchorTracking ?? false;
  const keepMounted = untrack(() => params.keepMounted ?? false);
  const lazyFlip = () => params.lazyFlip ?? false;
  const mounted = () => params.mounted;
  const interactionStore = params.interactionStore;

  const direction = useDirection();
  const isRtl = () => direction() === 'rtl';

  // Locks the placement to the side or placement it resolved to on mount, so later updates
  // don't flip it while open.
  const [mountPlacement, setMountPlacement] = createSyncSignal<Placement | null>(null);

  createEffect(mounted, (isMounted) => {
    if (!isMounted && untrack(mountPlacement) !== null) {
      setMountPlacement(null);
    }
  });

  const lockAlign = () => lazyFlip() === 'placement';
  const computed = createMemo(() => {
    const mount = mounted() ? mountPlacement() : null;
    const mountSide = mount ? getSide(mount) : null;
    const mountAlign = mount && lockAlign() ? getAlignment(mount) || 'center' : null;
    const side =
      mountSide ||
      (
        {
          top: 'top',
          right: 'right',
          bottom: 'bottom',
          left: 'left',
          'inline-end': isRtl() ? 'left' : 'right',
          'inline-start': isRtl() ? 'right' : 'left',
        } satisfies Record<Side, PhysicalSide>
      )[sideParam()];

    const placementAlign = mountAlign || align();
    const placement =
      placementAlign === 'center' ? side : (`${side}-${placementAlign}` as Placement);

    return { side: side as PhysicalSide, placementAlign, placement: placement as Placement };
  });

  const collisionPadding = createMemo(() => {
    const value = collisionPaddingParam() as any;
    if (typeof value === 'number') {
      return { top: value, right: value, bottom: value, left: value };
    }
    return {
      top: value?.top || 0,
      right: value?.right || 0,
      bottom: value?.bottom || 0,
      left: value?.left || 0,
    };
  });

  let arrowElement: Element | null = null;
  let isPositionedValue = false;

  const middleware = createMemo<Array<Middleware | null | undefined | false>>(() => {
    const collisionAvoidance = params.collisionAvoidance;
    const collisionAvoidanceSide = collisionAvoidance.side || 'flip';
    const collisionAvoidanceAlign = collisionAvoidance.align || 'flip';
    const collisionAvoidanceFallbackAxisSide = collisionAvoidance.fallbackAxisSide || 'end';
    const shiftCrossAxis = params.shift?.crossAxis ?? false;
    const shiftRootBoundary = params.shift?.rootBoundary;
    const currentSideParam = sideParam();
    const rtl = isRtl();
    const padding = collisionPadding();
    const currentSticky = sticky();
    const currentSideOffset = sideOffset();
    const currentAlignOffset = alignOffset();
    const { placementAlign } = computed();
    const boundary = collisionBoundary();
    const currentArrowPadding = arrowPadding();

    // Using a small bias helps the flip check be inclusive of the collision padding.
    const bias = 1;
    const biasTop = currentSideParam === 'bottom' ? bias : 0;
    const biasBottom = currentSideParam === 'top' ? bias : 0;
    const biasLeft = currentSideParam === 'right' ? bias : 0;
    const biasRight = currentSideParam === 'left' ? bias : 0;

    const commonCollisionProps = {
      boundary: boundary === 'clipping-ancestors' ? 'clippingAncestors' : boundary,
      padding,
    } as const;

    const sideOffsetDep = typeof currentSideOffset !== 'function' ? currentSideOffset : 0;
    const alignOffsetDep = typeof currentAlignOffset !== 'function' ? currentAlignOffset : 0;

    const list: Array<Middleware | null | undefined | false> = [];

    if (params.inline) {
      list.push(params.inline);
    }

    list.push(
      offset(
        (state) => {
          const data = getOffsetData(state, currentSideParam, rtl);

          const sideAxis =
            typeof currentSideOffset === 'function' ? currentSideOffset(data) : currentSideOffset;
          const alignAxis =
            typeof currentAlignOffset === 'function'
              ? currentAlignOffset(data)
              : currentAlignOffset;

          return {
            mainAxis: sideAxis,
            crossAxis: alignAxis,
            alignmentAxis: alignAxis,
          };
        },
        [sideOffsetDep, alignOffsetDep, rtl, currentSideParam, currentSideOffset, currentAlignOffset],
      ),
    );

    const shiftDisabled = collisionAvoidanceAlign === 'none' && collisionAvoidanceSide !== 'shift';
    const crossAxisShiftEnabled =
      !shiftDisabled && (currentSticky || shiftCrossAxis || collisionAvoidanceSide === 'shift');

    const flipOptions = {
      ...commonCollisionProps,
      padding: {
        top: padding.top + bias + biasTop,
        right: padding.right + bias + biasRight,
        bottom: padding.bottom + bias + biasBottom,
        left: padding.left + bias + biasLeft,
      },
      mainAxis: !shiftCrossAxis && collisionAvoidanceSide === 'flip',
      crossAxis: collisionAvoidanceAlign === 'flip' ? ('alignment' as const) : false,
      fallbackAxisSideDirection: collisionAvoidanceFallbackAxisSide,
    };
    const flipMiddleware =
      collisionAvoidanceSide === 'none'
        ? null
        : flip(
            ({ middlewareData }) =>
              (middlewareData.size ? { ...flipOptions, padding } : flipOptions) as any,
            [flipOptions],
          );
    const shiftMiddleware = shiftDisabled
      ? null
      : floatingShift(
          {
            ...(commonCollisionProps as any),
            rootBoundary: shiftRootBoundary,
            mainAxis: collisionAvoidanceAlign !== 'none',
            crossAxis: crossAxisShiftEnabled,
            limiter:
              currentSticky || shiftCrossAxis
                ? undefined
                : limitShift((limitData) => {
                    if (!arrowElement) {
                      return {};
                    }
                    const { width, height } = arrowElement.getBoundingClientRect();
                    const sideAxis = getSideAxis(getSide(limitData.placement));
                    const arrowSize = sideAxis === 'y' ? width : height;
                    const offsetAmount =
                      sideAxis === 'y'
                        ? padding.left + padding.right
                        : padding.top + padding.bottom;
                    return {
                      offset: arrowSize / 2 + offsetAmount / 2,
                    };
                  }),
          },
          [
            commonCollisionProps,
            currentSticky,
            shiftCrossAxis,
            shiftRootBoundary,
            padding,
            collisionAvoidanceAlign,
          ],
        );

    // https://floating-ui.com/docs/flip#combining-with-shift
    if (
      collisionAvoidanceSide === 'shift' ||
      collisionAvoidanceAlign === 'shift' ||
      placementAlign === 'center'
    ) {
      list.push(shiftMiddleware, flipMiddleware);
    } else {
      list.push(flipMiddleware, shiftMiddleware);
    }

    list.push(
      size({
        ...(commonCollisionProps as any),
        apply({ elements: { floating }, availableWidth, availableHeight, rects }) {
          if (!untrack(mounted)) {
            return;
          }

          const floatingStyle = floating.style;
          floatingStyle.setProperty(AVAILABLE_WIDTH_VAR, `${availableWidth}px`);
          floatingStyle.setProperty(AVAILABLE_HEIGHT_VAR, `${availableHeight}px`);

          const dpr = ownerWindow(floating).devicePixelRatio || 1;
          const { x, y, width, height } = rects.reference;
          const anchorWidth = (Math.round((x + width) * dpr) - Math.round(x * dpr)) / dpr;
          const anchorHeight = (Math.round((y + height) * dpr) - Math.round(y * dpr)) / dpr;

          floatingStyle.setProperty(CommonPositionerCssVars.anchorWidth, `${anchorWidth}px`);
          floatingStyle.setProperty(CommonPositionerCssVars.anchorHeight, `${anchorHeight}px`);
        },
      }),
      arrow(
        (state) => ({
          // `transformOrigin` calculations rely on an element existing. If the arrow hasn't been set,
          // we'll create a fake element.
          element: arrowElement || ownerDocument(state.elements.floating).createElement('div'),
          padding: arrowElement ? currentArrowPadding : 0,
        }),
        [currentArrowPadding],
      ),
      {
        name: 'transformOrigin',
        options: [currentSideOffset, rtl, currentSideParam, crossAxisShiftEnabled],
        fn(state) {
          const {
            elements: { floating },
            middlewareData,
            placement: renderedPlacement,
            platform,
            rects,
            y,
          } = state;

          const renderedSide = getSide(renderedPlacement);
          const renderedAlign = getAlignment(renderedPlacement);
          const isVertical = getSideAxis(renderedSide) === 'y';
          const arrowEl = arrowElement;

          const sideOffsetValue =
            typeof currentSideOffset === 'function'
              ? currentSideOffset(getOffsetData(state, currentSideParam, rtl))
              : currentSideOffset;

          let crossOrigin: string;
          if (
            !arrowEl &&
            renderedAlign &&
            Math.abs(isVertical ? middlewareData.shift?.x || 0 : middlewareData.shift?.y || 0) <= 1
          ) {
            crossOrigin =
              (renderedAlign === 'start') === (isVertical && platform.isRTL?.(floating) === true)
                ? '100%'
                : '0%';
          } else {
            const arrowOffset = isVertical
              ? middlewareData.arrow?.x || 0
              : middlewareData.arrow?.y || 0;
            const arrowSize = isVertical ? arrowEl?.clientWidth || 0 : arrowEl?.clientHeight || 0;
            crossOrigin = `${arrowOffset + arrowSize / 2}px`;
          }

          let sideOrigin =
            renderedSide === 'top' || renderedSide === 'left'
              ? `calc(100% + ${sideOffsetValue}px)`
              : `${-sideOffsetValue}px`;
          if (
            crossAxisShiftEnabled &&
            isVertical &&
            Math.abs(middlewareData.shift?.y || 0) > sideOffsetValue
          ) {
            sideOrigin = `${rects.reference.y + rects.reference.height / 2 - y}px`;
          }

          floating.style.setProperty(
            CommonPositionerCssVars.transformOrigin,
            isVertical ? `${crossOrigin} ${sideOrigin}` : `${sideOrigin} ${crossOrigin}`,
          );

          return {};
        },
      } as Middleware,
      hide,
      params.adaptiveOrigin,
    );

    return list;
  });

  // Ensure positioning doesn't run initially for `keepMounted` elements that
  // aren't initially open.
  createEffect(mounted, (isMounted) => {
    if (!isMounted) {
      interactionStore.clearPositioning();
    }
  });

  const autoUpdateOptions = createMemo<AutoUpdateOptions>(() => ({
    ancestorScroll: !disableAnchorTracking(),
    elementResize: !disableAnchorTracking() && typeof ResizeObserver !== 'undefined',
    layoutShift: !disableAnchorTracking() && typeof IntersectionObserver !== 'undefined',
  }));

  const floating = useBaseUIFloating({
    rootStore: interactionStore,
    get open() {
      return keepMounted ? mounted() : undefined;
    },
    get placement() {
      return computed().placement;
    },
    get middleware() {
      return middleware();
    },
    get strategy() {
      return positionMethod();
    },
    whileElementsMounted: keepMounted
      ? undefined
      : (reference, floatingEl, update) =>
          autoUpdate(reference, floatingEl, update, untrack(autoUpdateOptions)),
    get nodeId() {
      return params.nodeId;
    },
    get externalTree() {
      return params.externalTree;
    },
  });

  const { refs, context, update } = floating;

  const arrowRef = (element: Element | null) => {
    arrowElement = element;
    if (isPositionedValue) {
      queueMicrotask(update);
    }
  };

  createEffect(
    () => floating.isPositioned,
    (value) => {
      isPositionedValue = value;
    },
  );

  const sides = () => floating.middlewareData.adaptiveOrigin || DEFAULT_SIDES;

  const positionerStyles = createMemo<JSX.CSSProperties>(() => {
    const isPositioned = floating.isPositioned;
    const resolvedPosition: 'absolute' | 'fixed' = isPositioned ? positionMethod() : 'fixed';
    let base: Record<string, unknown>;
    if (!isPositioned) {
      base = { position: resolvedPosition, top: '0', left: '0' };
    } else if (params.adaptiveOrigin) {
      const { sideX, sideY } = sides();
      base = {
        position: resolvedPosition,
        [sideX]: `${floating.x}px`,
        [sideY]: `${floating.y}px`,
      };
    } else {
      base = { ...floating.floatingStyles, position: resolvedPosition };
    }

    // Prevent CSS vars from being inherited from parent popups.
    base[AVAILABLE_WIDTH_VAR] = '100vw';
    base[AVAILABLE_HEIGHT_VAR] = '100vh';

    if (!isPositioned) {
      base.opacity = '0';
    }
    return base as JSX.CSSProperties;
  });

  let registeredPositionReference: Element | VirtualElement | null = null;

  createEffect(
    () => {
      if (!mounted()) {
        return undefined;
      }
      const anchorValue = params.anchor;
      const resolvedAnchor = typeof anchorValue === 'function' ? anchorValue() : anchorValue;
      return { value: (isRef(resolvedAnchor) ? resolvedAnchor.current : resolvedAnchor) || null };
    },
    (result) => {
      if (!result) {
        return;
      }
      const finalAnchor = result.value;
      if (finalAnchor !== registeredPositionReference) {
        refs.setPositionReference(finalAnchor);
        registeredPositionReference = finalAnchor;
      }
    },
  );

  createEffect(
    () =>
      [
        mounted(),
        floating.elements.reference,
        floating.elements.floating,
        autoUpdateOptions(),
      ] as const,
    ([isMounted, reference, floatingEl, options]) => {
      if (keepMounted && isMounted && reference && floatingEl) {
        return autoUpdate(reference, floatingEl, update, options);
      }
      return undefined;
    },
  );

  const renderedPlacement = () => floating.placement;
  const renderedSide = () => getSide(renderedPlacement());
  const logicalRenderedSide = () => getLogicalSide(sideParam(), renderedSide(), isRtl());
  const renderedAlign = () => getAlignment(renderedPlacement()) || 'center';
  const anchorHidden = () => Boolean(floating.middlewareData.hide?.referenceHidden);

  createEffect(
    () =>
      [
        lazyFlip(),
        lockAlign(),
        mounted(),
        floating.isPositioned,
        renderedPlacement(),
        renderedSide(),
        renderedAlign(),
        computed().side,
        computed().placementAlign,
      ] as const,
    ([lazy, locked, isMounted, isPositioned, placement, side, alignValue, mountSide, placementAlign]) => {
      if (
        lazy &&
        isMounted &&
        isPositioned &&
        (side !== mountSide || (locked && alignValue !== placementAlign))
      ) {
        setMountPlacement(placement);
      }
    },
  );

  const arrowStyles = createMemo<JSX.CSSProperties>(() => {
    const arrowData = floating.middlewareData.arrow;
    return {
      position: 'absolute',
      top: arrowData?.y != null ? `${arrowData.y}px` : undefined,
      left: arrowData?.x != null ? `${arrowData.x}px` : undefined,
    };
  });

  return {
    get positionerStyles() {
      return positionerStyles();
    },
    get arrowStyles() {
      return arrowStyles();
    },
    arrowRef,
    get arrowUncentered() {
      return floating.middlewareData.arrow?.centerOffset !== 0;
    },
    get side() {
      return logicalRenderedSide();
    },
    get align() {
      return renderedAlign();
    },
    get physicalSide() {
      return renderedSide();
    },
    get anchorHidden() {
      return anchorHidden();
    },
    refs,
    context,
    get isPositioned() {
      return floating.isPositioned;
    },
    update,
  };
}

function isRef(param: unknown): param is RefObject<any> {
  return param != null && typeof param === 'object' && 'current' in (param as object);
}

export interface UseAnchorPositioningSharedParameters {
  /**
   * An element to position the popup against.
   * By default, the popup will be positioned against the trigger.
   */
  anchor?:
    | Element
    | null
    | VirtualElement
    | RefObject<Element | null>
    | (() => Element | VirtualElement | null)
    | undefined;
  /**
   * Determines which CSS `position` property to use.
   * @default 'absolute'
   */
  positionMethod?: 'absolute' | 'fixed' | undefined;
  /**
   * Which side of the anchor element to align the popup against.
   * May automatically change to avoid collisions.
   * @default 'bottom'
   */
  side?: Side | undefined;
  /**
   * Distance between the anchor and the popup in pixels.
   * Also accepts a function that returns the distance to read the dimensions of the anchor
   * and positioner elements, along with its side and alignment.
   *
   * The function takes a `data` object parameter with the following properties:
   * - `data.anchor`: the dimensions of the anchor element with properties `width` and `height`.
   * - `data.positioner`: the dimensions of the positioner element with properties `width` and `height`.
   * - `data.side`: which side of the anchor element the positioner is aligned against.
   * - `data.align`: how the positioner is aligned relative to the specified side.
   *
   * @example
   * ```jsx
   * <Positioner
   *   sideOffset={({ side, align, anchor, positioner }) => {
   *     return side === 'top' || side === 'bottom'
   *       ? anchor.height
   *       : anchor.width;
   *   }}
   * />
   * ```
   *
   * @default 0
   */
  sideOffset?: number | OffsetFunction | undefined;
  /**
   * How to align the popup relative to the specified side.
   * @default 'center'
   */
  align?: Align | undefined;
  /**
   * Additional offset along the alignment axis in pixels.
   * Also accepts a function that returns the offset to read the dimensions of the anchor
   * and positioner elements, along with its side and alignment.
   *
   * The function takes a `data` object parameter with the following properties:
   * - `data.anchor`: the dimensions of the anchor element with properties `width` and `height`.
   * - `data.positioner`: the dimensions of the positioner element with properties `width` and `height`.
   * - `data.side`: which side of the anchor element the positioner is aligned against.
   * - `data.align`: how the positioner is aligned relative to the specified side.
   *
   * @example
   * ```jsx
   * <Positioner
   *   alignOffset={({ side, align, anchor, positioner }) => {
   *     return side === 'top' || side === 'bottom'
   *       ? anchor.width
   *       : anchor.height;
   *   }}
   * />
   * ```
   *
   * @default 0
   */
  alignOffset?: number | OffsetFunction | undefined;
  /**
   * An element or a rectangle that delimits the area that the popup is confined to.
   * @default 'clipping-ancestors'
   */
  collisionBoundary?: Boundary | undefined;
  /**
   * Additional space to maintain from the edge of the collision boundary.
   * @default 5
   */
  collisionPadding?: Padding | undefined;
  /**
   * Whether to maintain the popup in the viewport after
   * the anchor element was scrolled out of view.
   * @default false
   */
  sticky?: boolean | undefined;
  /**
   * Minimum distance to maintain between the arrow and the edges of the popup.
   *
   * Use it to prevent the arrow element from hanging out of the rounded corners of a popup.
   * @default 5
   */
  arrowPadding?: number | undefined;
  /**
   * Whether to disable the popup from tracking any layout shift of its positioning anchor.
   * @default false
   */
  disableAnchorTracking?: boolean | undefined;
  /**
   * Determines how to handle collisions when positioning the popup.
   *
   * `side` controls overflow on the preferred placement axis (`top`/`bottom` or `left`/`right`):
   * - `'flip'`: keep the requested side when it fits; otherwise try the opposite side
   *   (`top` and `bottom`, or `left` and `right`).
   * - `'shift'`: never change side; keep the requested side and move the popup within
   *   the clipping boundary so it stays visible.
   * - `'none'`: do not correct side-axis overflow.
   *
   * `align` controls overflow on the alignment axis (`start`/`center`/`end`):
   * - `'flip'`: keep side, but swap `start` and `end` when the requested alignment overflows.
   * - `'shift'`: keep side and requested alignment, then nudge the popup along the
   *   alignment axis to fit.
   * - `'none'`: do not correct alignment-axis overflow.
   *
   * `fallbackAxisSide` controls fallback behavior on the perpendicular axis when the
   * preferred axis cannot fit:
   * - `'start'`: allow perpendicular fallback and try the logical start side first
   *   (`top` before `bottom`, or `left` before `right` in LTR).
   * - `'end'`: allow perpendicular fallback and try the logical end side first
   *   (`bottom` before `top`, or `right` before `left` in LTR).
   * - `'none'`: do not fallback to the perpendicular axis.
   *
   * When `side` is `'shift'`, explicitly setting `align` only supports `'shift'` or `'none'`.
   * If `align` is omitted, it defaults to `'flip'`.
   *
   * @example
   * ```jsx
   * <Positioner
   *   collisionAvoidance={{
   *     side: 'shift',
   *     align: 'shift',
   *     fallbackAxisSide: 'none',
   *   }}
   * />
   * ```
   *
   */
  collisionAvoidance?: CollisionAvoidance | undefined;
}

export interface UseAnchorPositioningParameters extends UseAnchorPositioningSharedParameters {
  keepMounted?: boolean | undefined;
  /**
   * The interaction store the popup is positioned with. Components without a popup store create
   * one with `useFloatingRootStore`.
   */
  interactionStore: PositioningInteractionStore;
  mounted: boolean;
  nodeId?: string | undefined;
  adaptiveOrigin?: Middleware | undefined;
  collisionAvoidance: CollisionAvoidance;
  shift?:
    | {
        crossAxis?: boolean | undefined;
        rootBoundary?: 'layoutViewport' | undefined;
      }
    | undefined;
  /**
   * Locks a flipped placement so it doesn't flip back eagerly while filtering resizes the
   * popup. `true` locks the side only; `'placement'` also locks the alignment.
   */
  lazyFlip?: boolean | 'placement' | undefined;
  externalTree?: FloatingTreeStore | undefined;
  /**
   * Optional middleware that can replace the measured reference rect before offsets and collision
   * middleware run. Used by Preview Card to position against a specific inline line box.
   */
  inline?: Middleware | undefined;
}

export interface UseAnchorPositioningReturnValue {
  positionerStyles: JSX.CSSProperties;
  arrowStyles: JSX.CSSProperties;
  arrowRef: (element: Element | null) => void;
  arrowUncentered: boolean;
  side: Side;
  align: Align;
  physicalSide: PhysicalSide;
  anchorHidden: boolean;
  refs: UseFloatingReturn['refs'];
  context: PopupPositioningContext;
  isPositioned: boolean;
  update: () => void;
}
