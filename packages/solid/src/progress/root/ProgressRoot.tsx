import { createMemo, omit, untrack } from 'solid-js';
import { visuallyHidden } from '@base-ui-solid/utils/visuallyHidden';
import { clamp } from '@base-ui-solid/utils/clamp';
import { createSyncSignal } from '@base-ui-solid/utils/createSyncSignal';
import { formatRangeValue } from '../../utils/formatRangeValue';
import { valueToPercent } from '../../utils/valueToPercent';
import { useRenderElement } from '../../internals/useRenderElement';
import { useFormatLocale } from '../../utils/useFormatLocale';
import { ProgressRootContext } from './ProgressRootContext';
import { progressStateAttributesMapping } from './stateAttributesMapping';
import type { BaseUIComponentProps, HTMLProps } from '../../internals/types';
import { ownedProps } from '../../internals/ownedProps';

/**
 * Groups all parts of the progress bar and provides the task completion status to screen readers.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Progress](https://base-ui.com/react/components/progress)
 */
export function ProgressRoot(componentProps: ProgressRoot.Props) {
  componentProps = ownedProps(componentProps);
  const elementProps = omit(
    componentProps,
    'format',
    'getAriaValueText',
    'locale',
    'max',
    'min',
    'value',
    'render',
    'class',
    'children',
    'style',
    'ref',
  );

  const [labelId, setLabelId] = createSyncSignal<string | undefined>(undefined);
  const max = () => componentProps.max ?? 100;
  const min = () => componentProps.min ?? 0;

  // `value === null` (or any non-finite value) keeps Progress indeterminate.
  const computed = createMemo(() => {
    const value = componentProps.value;
    const formatLocale = useFormatLocale(componentProps.locale);
    let status: ProgressStatus = 'indeterminate';
    let percentageValue: number | null = null;
    let clampedValue: number | null = null;
    let formattedValue = '';
    let defaultAriaValueText = 'indeterminate progress';

    if (value != null && Number.isFinite(value)) {
      const rawPercentage = valueToPercent(value, min(), max());
      percentageValue = clamp(Number.isNaN(rawPercentage) ? 0 : rawPercentage, 0, 100);
      clampedValue = clamp(value, min(), max());
      status = clampedValue === max() ? 'complete' : 'progressing';
      formattedValue = formatRangeValue(
        clampedValue,
        percentageValue,
        formatLocale,
        componentProps.format,
      );
      defaultAriaValueText = formattedValue;
    }

    return { status, percentageValue, clampedValue, formattedValue, defaultAriaValueText };
  });

  const status = createMemo(() => computed().status);
  const state = createMemo<ProgressRootState>(() => ({ status: status() }));

  const defaultProps: HTMLProps = {
    get 'aria-labelledby'() {
      return labelId();
    },
    get 'aria-valuemax'() {
      return max();
    },
    get 'aria-valuemin'() {
      return min();
    },
    get 'aria-valuenow'() {
      return computed().clampedValue ?? undefined;
    },
    get 'aria-valuetext'() {
      const { formattedValue, defaultAriaValueText } = computed();
      return componentProps.getAriaValueText
        ? componentProps.getAriaValueText(formattedValue, componentProps.value ?? null)
        : defaultAriaValueText;
    },
    role: 'progressbar',
  };

  const contextValue: ProgressRootContext = {
    get clampedValue() {
      return computed().clampedValue;
    },
    get format() {
      return componentProps.format;
    },
    get locale() {
      return componentProps.locale;
    },
    get percentageValue() {
      return computed().percentageValue;
    },
    setLabelId: (value) => {
      setLabelId(value);
    },
    get state() {
      return state();
    },
    get value() {
      return componentProps.value ?? null;
    },
  };

  return (
    <ProgressRootContext value={contextValue}>
      {untrack(() =>
        useRenderElement('div', componentProps, {
          state,
          props: [defaultProps, elementProps],
          children: () => (
            <>
              {componentProps.children}
              <span role="presentation" style={visuallyHidden}>
                {/* force NVDA to read the label https://github.com/mui/base-ui/issues/4184 */}x
              </span>
            </>
          ),
          stateAttributesMapping: progressStateAttributesMapping,
        }),
      )}
    </ProgressRootContext>
  );
}


export type ProgressStatus = 'indeterminate' | 'progressing' | 'complete';

export interface ProgressRootState {
  /**
   * The current status.
   */
  status: ProgressStatus;
}

export interface ProgressRootProps extends BaseUIComponentProps<'div', ProgressRootState> {
  /**
   * A string value that provides a user-friendly name for `aria-valuenow`, the current value of the progress bar.
   */
  'aria-valuetext'?: string | undefined;
  /**
   * Options to format the value.
   */
  format?: Intl.NumberFormatOptions | undefined;
  /**
   * Accepts a function which returns a string value that provides a human-readable text alternative for the current value of the progress bar.
   */
  getAriaValueText?: ((formattedValue: string, value: number | null) => string) | undefined;
  /**
   * The locale used by `Intl.NumberFormat` when formatting the value.
   * Defaults to the user's runtime locale.
   * When server rendering, `en-US` is used until hydration.
   */
  locale?: Intl.LocalesArgument | undefined;
  /**
   * The maximum value.
   * @default 100
   */
  max?: number | undefined;
  /**
   * The minimum value.
   * @default 0
   */
  min?: number | undefined;
  /**
   * The current value. The component is indeterminate when value is `null`.
   */
  value: number | null;
}

export namespace ProgressRoot {
  export type State = ProgressRootState;
  export type Props = ProgressRootProps;
}
