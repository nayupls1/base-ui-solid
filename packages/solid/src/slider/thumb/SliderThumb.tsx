import type { JSX } from '@solidjs/web';
import type { RefObject } from '@base-ui-solid/utils/types';
import { createEffect, createMemo, createSignal, omit, untrack } from 'solid-js';
import { visuallyHidden } from '@base-ui-solid/utils/visuallyHidden';
import { ownerWindow } from '@base-ui-solid/utils/owner';
import { clamp } from '@base-ui-solid/utils/clamp';
import { formatNumber } from '@base-ui-solid/utils/formatNumber';
import { contains } from '@base-ui-solid/utils/shadowDom';
import { createSyncSignal } from '@base-ui-solid/utils/createSyncSignal';
import type { BaseUIComponentProps } from '../../internals/types';
import { mergeProps } from '../../merge-props';
import { useBaseUiId } from '../../internals/useBaseUiId';
import { useIsHydrating } from '../../utils/useIsHydrating';
import { useFormatLocale } from '../../utils/useFormatLocale';
import { assignRefs, useRenderElement } from '../../internals/useRenderElement';
import type { RefInput } from '../../internals/useRenderElement';
import { valueToPercent } from '../../utils/valueToPercent';
import {
  ARROW_DOWN,
  ARROW_UP,
  ARROW_RIGHT,
  ARROW_LEFT,
  HOME,
  END,
  COMPOSITE_KEYS,
  PAGE_UP,
  PAGE_DOWN,
} from '../../internals/composite/composite';
import { useCompositeListItem } from '../../internals/composite/list/useCompositeListItem';
import { useDirection } from '../../internals/direction-context/DirectionContext';
import { useFieldRootContext } from '../../internals/field-root-context/FieldRootContext';
import { useSetFieldFocused } from '../../internals/field-root-context/useSetFieldFocused';
import { matchesFocusVisible } from '../../utils/popups/element';
import { useLabelableId } from '../../internals/labelable-provider/useLabelableId';
import { getMidpoint } from '../utils/getMidpoint';
import { getSliderValue } from '../utils/getSliderValue';
import { getDecimalPrecision, roundValueToStep } from '../utils/roundValueToStep';
import type { SliderRootState } from '../root/SliderRoot';
import { useSliderRootContext } from '../root/SliderRootContext';
import { sliderStateAttributesMapping } from '../root/stateAttributesMapping';
import * as SliderThumbDataAttributes from './SliderThumbDataAttributes';
import { ownedProps } from '../../internals/ownedProps';

const ALL_KEYS = new Set([...COMPOSITE_KEYS, PAGE_UP, PAGE_DOWN]);

function getDefaultAriaValueText(
  values: readonly number[],
  index: number,
  format: Intl.NumberFormatOptions | undefined,
  locale: Intl.LocalesArgument | undefined,
): string | undefined {
  if (index < 0) {
    return undefined;
  }

  if (values.length === 2) {
    return `${formatNumber(values[index], locale, format)} ${index === 0 ? 'start' : 'end'} range`;
  }

  return format ? formatNumber(values[index], locale, format) : undefined;
}

function getNewValue(
  thumbValue: number,
  increment: number,
  direction: number,
  min: number,
  max: number,
): number {
  const value = thumbValue + increment * direction;
  const roundedValue = Number(
    value.toFixed(
      Math.max(
        getDecimalPrecision(thumbValue),
        getDecimalPrecision(increment),
        getDecimalPrecision(min),
      ),
    ),
  );
  return clamp(roundedValue, min, max);
}

/**
 * The draggable part of the slider at the tip of the indicator.
 * Renders a `<div>` element and a nested `<input type="range">`.
 *
 * Documentation: [Base UI Slider](https://base-ui.com/react/components/slider)
 */
export function SliderThumb(componentProps: SliderThumb.Props) {
  componentProps = ownedProps(componentProps);
  const elementProps = omit(
    componentProps,
    'render',
    'children',
    'class',
    'aria-describedby',
    'aria-label',
    'aria-labelledby',
    'aria-valuetext',
    'disabled',
    'getAriaLabel',
    'getAriaValueText',
    'id',
    'index',
    'inputRef',
    'onBlur',
    'onFocus',
    'onKeyDown',
    'tabindex',
    'style',
    'ref',
  );

  const id = useBaseUiId(() => componentProps.id);
  const ctx = useSliderRootContext();

  // Resolved here rather than in Root, since this part can hydrate later.
  const formatLocale = useFormatLocale(() => ctx.locale) as any;
  const getFormatLocale = () => (typeof formatLocale === 'function' ? formatLocale() : formatLocale);
  const direction = useDirection();
  const disabled = () => (componentProps.disabled ?? false) || ctx.disabled;
  const range = () => ctx.values.length > 1;
  const vertical = () => ctx.orientation === 'vertical';
  const rtl = () => direction() === 'rtl';

  const field = useFieldRootContext();

  const [thumb, setThumb] = createSyncSignal<HTMLElement | null>(null);
  const [input, setInput] = createSyncSignal<HTMLInputElement | null>(null);
  const setFocused = useSetFieldFocused(disabled, input);

  let restoringFocusVisible = false;

  const defaultInputId = useBaseUiId();
  const labelableId = useLabelableId();
  const inputId = () => (range() ? defaultInputId() : labelableId());

  const { ref: listItemRef, index: compositeIndex } = useCompositeListItem<ThumbMetadata>({
    get metadata() {
      return { inputId: inputId() };
    },
  } as any);

  const index = () => (!range() ? 0 : (componentProps.index ?? compositeIndex()));
  const last = () => index() === ctx.values.length - 1;
  const thumbValue = () => ctx.values[index()];
  const thumbValuePercent = () => valueToPercent(thumbValue(), ctx.min, ctx.max);

  const [positionPercent, setPositionPercent] = createSignal<number | undefined>(undefined, {
    ownedWrite: true,
  });

  const isHydrating = useIsHydrating() as any;
  const getIsHydrating = () => (typeof isHydrating === 'function' ? isHydrating() : isHydrating);

  const safeLastUsedThumbIndex = () =>
    ctx.lastUsedThumbIndex >= 0 && ctx.lastUsedThumbIndex < ctx.values.length
      ? ctx.lastUsedThumbIndex
      : -1;

  // The last position and indicator edge applied, including updates that haven't rendered yet.
  let appliedInset: [number | undefined, number] = [undefined, -1];

  const getInsetPosition = () => {
    const control = ctx.controlRef.current;
    const thumbElement = thumb();
    if (!control || !thumbElement) {
      return;
    }

    const isVertical = untrack(vertical);
    const thumbRect = thumbElement.getBoundingClientRect();
    const controlRect = control.getBoundingClientRect();
    const side = isVertical ? 'height' : 'width';

    // A hidden control measures 0, so keep the last position until it can be measured again.
    if (!controlRect[side]) {
      return;
    }

    // the total travel distance adjusted to account for the thumb size
    const controlSize = controlRect[side] - thumbRect[side];
    // px distance from the starting edge (inline-start or bottom) to the thumb center
    const thumbOffsetFromControlEdge =
      thumbRect[side] / 2 + (controlSize * untrack(thumbValuePercent)) / 100;

    const nextPositionPercent = (thumbOffsetFromControlEdge / controlRect[side]) * 100;
    // `min === max` has no valid position, which hides the thumb.
    const nextInsetPosition = Number.isFinite(nextPositionPercent)
      ? nextPositionPercent
      : undefined;

    // The indicator edge this thumb drives: 0 = start, 1 = end, -1 = none.
    let indicatorEdge = -1;
    if (untrack(index) === 0) {
      indicatorEdge = 0;
    } else if (untrack(last)) {
      indicatorEdge = 1;
    }

    const [appliedPosition, appliedEdge] = appliedInset;
    if (nextInsetPosition === appliedPosition && indicatorEdge === appliedEdge) {
      return;
    }

    appliedInset = [nextInsetPosition, indicatorEdge];

    setPositionPercent(nextInsetPosition);
    if (indicatorEdge === 0) {
      ctx.setIndicatorPosition((prevPosition) => [nextInsetPosition, prevPosition[1]]);
    } else if (indicatorEdge === 1) {
      ctx.setIndicatorPosition((prevPosition) => [prevPosition[0], nextInsetPosition]);
    }
  };

  createEffect(
    () => [ctx.inset, thumbValuePercent(), index(), last()] as const,
    ([inset]) => {
      if (inset) {
        getInsetPosition();
      }
    },
  );

  createEffect(
    () => [ctx.inset, thumb()] as const,
    ([inset, thumbElement]) => {
      if (!inset || !thumbElement) {
        return undefined;
      }

      let resizeObserver: ResizeObserver | undefined;
      let cancelled = false;

      // The control's ref may attach after this descendant's effect runs.
      queueMicrotask(() => {
        const control = ctx.controlRef.current;
        if (cancelled || !control) {
          return;
        }

        const ResizeObserverCtor = ownerWindow(control).ResizeObserver;
        if (typeof ResizeObserverCtor === 'function') {
          resizeObserver = new ResizeObserverCtor(() => getInsetPosition());
          resizeObserver.observe(control);
          resizeObserver.observe(thumbElement);
        }

        getInsetPosition();
      });

      return () => {
        cancelled = true;
        resizeObserver?.disconnect();
      };
    },
  );

  const thumbStyle = (): JSX.CSSProperties => {
    const isVertical = vertical();
    const inset = ctx.inset;
    const percent = thumbValuePercent();
    const startEdge = isVertical ? 'bottom' : 'inset-inline-start';
    const crossOffsetProperty = isVertical ? 'left' : 'top';

    let zIndex: number | undefined;
    if (range()) {
      if (ctx.active === index()) {
        zIndex = 2;
      } else if (safeLastUsedThumbIndex() === index()) {
        zIndex = 1;
      }
    } else if (ctx.active === index()) {
      zIndex = 1;
    }

    if (!inset && !Number.isFinite(percent)) {
      return visuallyHidden as JSX.CSSProperties;
    }

    return {
      position: 'absolute',
      [startEdge]: inset ? 'var(--position)' : `${percent}%`,
      [crossOffsetProperty]: '50%',
      translate: `${(isVertical || !rtl() ? -1 : 1) * 50}% ${(isVertical ? 1 : -1) * 50}%`,
      'z-index': zIndex === undefined ? undefined : String(zIndex),
      ...(inset && {
        '--position': `${positionPercent() ?? 0}%`,
        visibility:
          (ctx.renderBeforeHydration && getIsHydrating()) || positionPercent() === undefined
            ? 'hidden'
            : undefined,
      }),
    } as JSX.CSSProperties;
  };

  const ariaLabel = () =>
    typeof componentProps.getAriaLabel === 'function'
      ? componentProps.getAriaLabel(index())
      : componentProps['aria-label'];

  const inputProps = createMemo(() =>
    mergeProps(
      {
        'aria-label': ariaLabel(),
        'aria-labelledby':
          componentProps['aria-labelledby'] ?? (ariaLabel() == null ? ctx.labelId : undefined),
        'aria-describedby': componentProps['aria-describedby'],
        'aria-orientation': ctx.orientation,
        'aria-valuenow': thumbValue(),
        'aria-valuetext':
          typeof componentProps.getAriaValueText === 'function'
            ? componentProps.getAriaValueText(
                formatNumber(thumbValue(), getFormatLocale(), ctx.format),
                thumbValue(),
                index(),
              )
            : (componentProps['aria-valuetext'] ??
              getDefaultAriaValueText(ctx.values, index(), ctx.format, getFormatLocale())),
        disabled: disabled(),
        form: ctx.form,
        id: inputId(),
        max: ctx.max,
        min: ctx.min,
        name: ctx.name,
        onInput(event: Event) {
          ctx.handleInputChange(
            (event.currentTarget as HTMLInputElement).valueAsNumber,
            untrack(index),
            event,
          );
        },
        onFocus(event: FocusEvent) {
          const isRestoringFocusVisible = restoringFocusVisible;
          restoringFocusVisible = false;
          ctx.setActive(untrack(index));
          setFocused(true);
          if (isRestoringFocusVisible) {
            event.stopPropagation();
          }
        },
        onBlur(event: FocusEvent) {
          if (restoringFocusVisible) {
            event.stopPropagation();
            return;
          }

          ctx.setActive(-1);

          // Keep field-level blur logic from running while focus moves to another thumb
          // of the same slider, so validation doesn't commit mid-interaction.
          if (
            ctx.thumbRefs.current.some((thumbElement) =>
              contains(thumbElement, event.relatedTarget as Element | null),
            )
          ) {
            return;
          }

          field.setTouched(true);
          setFocused(false);

          if (field.validationMode === 'onBlur') {
            ctx.validation.commit(
              getSliderValue(
                untrack(thumbValue),
                untrack(index),
                ctx.min,
                ctx.max,
                ctx.isArrayValue,
                ctx.values,
              ),
            );
          }
        },
        onKeyDown(event: KeyboardEvent) {
          if (event.defaultPrevented) {
            return;
          }

          if (!ALL_KEYS.has(event.key)) {
            return;
          }

          if (COMPOSITE_KEYS.has(event.key)) {
            event.stopPropagation();
          }

          const currentIndex = untrack(index);
          const values = ctx.values;
          const { min, max, step, largeStep, minStepsBetweenValues } = ctx;
          const isRtl = untrack(rtl);
          const isRange = untrack(range);
          const currentValue = untrack(thumbValue);

          let newValue = null;
          let keyDirection = 0;
          let increment = event.shiftKey ? largeStep : step;
          const roundedValue = roundValueToStep(currentValue, step, min);

          switch (event.key) {
            case ARROW_UP:
              keyDirection = 1;
              break;
            case ARROW_RIGHT:
              keyDirection = isRtl ? -1 : 1;
              break;
            case ARROW_DOWN:
              keyDirection = -1;
              break;
            case ARROW_LEFT:
              keyDirection = isRtl ? 1 : -1;
              break;
            case PAGE_UP:
              increment = largeStep;
              keyDirection = 1;
              break;
            case PAGE_DOWN:
              increment = largeStep;
              keyDirection = -1;
              break;
            case END:
              newValue =
                isRange && Number.isFinite(values[currentIndex + 1])
                  ? values[currentIndex + 1] - step * minStepsBetweenValues
                  : max;
              break;
            case HOME:
              newValue =
                isRange && Number.isFinite(values[currentIndex - 1])
                  ? values[currentIndex - 1] + step * minStepsBetweenValues
                  : min;
              break;
            default:
              break;
          }

          if (keyDirection !== 0) {
            newValue = getNewValue(roundedValue, increment, keyDirection, min, max);
          }

          if (newValue !== null) {
            const inputElement = event.currentTarget as HTMLInputElement;
            if (!matchesFocusVisible(inputElement)) {
              restoringFocusVisible = true;
              inputElement.blur();
              inputElement.focus({
                preventScroll: true,
                // Show `:focus-visible` after keyboard interaction, even if the
                // thumb was previously focused by a pointer.
                focusVisible: true,
              } as FocusOptions);
            }
            ctx.handleInputChange(newValue, currentIndex, event);
            event.preventDefault();
          }
        },
        step: ctx.step,
        style: {
          ...(visuallyHidden as object),
          // So that VoiceOver's focus indicator matches the thumb's dimensions
          width: '100%',
          height: '100%',
          'writing-mode': vertical() ? (rtl() ? 'vertical-rl' : 'vertical-lr') : undefined,
        },
        tabindex: (componentProps as any).tabindex,
        type: 'range',
        value: thumbValue() ?? '',
      },
      (props: any) => ctx.validation.getValidationProps(disabled(), props),
      {
        onFocus(event: FocusEvent) {
          if (restoringFocusVisible) {
            return;
          }
          (componentProps.onFocus as any)?.(event);
        },
        onBlur(event: FocusEvent) {
          if (restoringFocusVisible) {
            return;
          }
          (componentProps.onBlur as any)?.(event);
        },
        onKeyDown: componentProps.onKeyDown as any,
      },
    ),
  );

  const state = createMemo<SliderThumbState>(() => ({ ...ctx.state, disabled: disabled() }));

  return useRenderElement('div', componentProps, {
    state,
    ref: [
      listItemRef,
      (el: HTMLElement | null) => {
        setThumb(el);
      },
    ],
    props: [
      {
        get [SliderThumbDataAttributes.index]() {
          return index();
        },
        get id() {
          return id();
        },
        onPointerDown(event: PointerEvent) {
          // Keep disabled thumbs from writing transient pointer state.
          if (untrack(disabled)) {
            return;
          }

          ctx.pressedThumbIndexRef.current = untrack(index);

          const isVertical = untrack(vertical);
          const midpoint = getMidpoint(event.currentTarget as HTMLElement, isVertical);
          ctx.pressedThumbCenterOffsetRef.current =
            (isVertical ? event.clientY : event.clientX) - midpoint;
        },
        get style() {
          return thumbStyle();
        },
      },
      elementProps,
    ],
    children: () => (
      <>
        {componentProps.children}
        <input
          ref={(el: HTMLInputElement) => {
            setInput(el);
            assignRefs(ctx.validation.inputRef as any, el);
            assignRefs(componentProps.inputRef as RefInput<HTMLInputElement>, el);
          }}
          {...(inputProps() as any)}
        />
      </>
    ),
    stateAttributesMapping: sliderStateAttributesMapping as any,
  });
}

export interface ThumbMetadata {
  inputId: string | undefined;
}

export interface SliderThumbState extends SliderRootState {}

export interface SliderThumbProps extends Omit<
  BaseUIComponentProps<'div', SliderThumbState>,
  'onBlur' | 'onFocus' | 'onKeyDown'
> {
  /**
   * Whether the thumb should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * A string value forwarded to the [`aria-valuetext`](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-valuetext) attribute of the `input`.
   * Ignored when `getAriaValueText` is provided.
   */
  'aria-valuetext'?: string | undefined;
  /**
   * A function which returns a string value for the [`aria-label`](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-label) attribute of the `input`.
   */
  getAriaLabel?: ((index: number) => string) | null | undefined;
  /**
   * A function which returns a string value for the [`aria-valuetext`](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-valuetext) attribute of the `input`.
   * This is important for screen reader users.
   */
  getAriaValueText?:
    ((formattedValue: string, value: number, index: number) => string) | null | undefined;
  /**
   * The index of the thumb which corresponds to the index of its value in the
   * `value` or `defaultValue` array.
   * This prop is required to support server-side rendering for range sliders
   * with multiple thumbs.
   * @example
   * ```tsx
   * <Slider.Root value={[10, 20]}>
   *   <Slider.Thumb index={0} />
   *   <Slider.Thumb index={1} />
   * </Slider.Root>
   * ```
   */
  index?: number | undefined;
  /**
   * A ref to access the nested input element.
   */
  inputRef?: RefInput<HTMLInputElement> | undefined;
  /**
   * A blur handler forwarded to the `input`.
   */
  onBlur?: FocusEventHandler<HTMLInputElement> | undefined;
  /**
   * A focus handler forwarded to the `input`.
   */
  onFocus?: FocusEventHandler<HTMLInputElement> | undefined;
  /**
   * A keydown handler forwarded to the `input`.
   */
  onKeyDown?: KeyboardEventHandler<HTMLInputElement> | undefined;
  /**
   * Optional tab index attribute forwarded to the `input`.
   */
  tabindex?: number | undefined;
}

export namespace SliderThumb {
  export type State = SliderThumbState;
  export type Props = SliderThumbProps;
}
