import { createMemo, omit, untrack } from 'solid-js';
import { visuallyHidden } from '@base-ui-solid/utils/visuallyHidden';
import { clamp } from '@base-ui-solid/utils/clamp';
import { createSyncSignal } from '@base-ui-solid/utils/createSyncSignal';
import { formatRangeValue } from '../../utils/formatRangeValue';
import { valueToPercent } from '../../utils/valueToPercent';
import { useRenderElement } from '../../internals/useRenderElement';
import { useFormatLocale } from '../../utils/useFormatLocale';
import { MeterRootContext } from './MeterRootContext';
import type { BaseUIComponentProps, HTMLProps } from '../../internals/types';

/**
 * Groups all parts of the meter and provides the value for screen readers.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Meter](https://base-ui.com/react/components/meter)
 */
export function MeterRoot(componentProps: MeterRoot.Props) {
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

  const computed = createMemo(() => {
    const valueProp = componentProps.value;
    // `clamp` handles infinity, but NaN needs an explicit fallback before normalizing range outputs.
    const rawPercentage = valueToPercent(valueProp, min(), max());
    const percentageValue = clamp(Number.isNaN(rawPercentage) ? 0 : rawPercentage, 0, 100);
    const clampedValue = clamp(Number.isNaN(valueProp) ? min() : valueProp, min(), max());

    const formattedValue = formatRangeValue(
      clampedValue,
      percentageValue,
      useFormatLocale(componentProps.locale),
      componentProps.format,
    );

    let ariaValuetext = formattedValue;
    if (componentProps.getAriaValueText) {
      ariaValuetext = componentProps.getAriaValueText(formattedValue, valueProp);
    }

    return { percentageValue, clampedValue, ariaValuetext };
  });

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
      return computed().clampedValue;
    },
    get 'aria-valuetext'() {
      return computed().ariaValuetext;
    },
    role: 'meter',
  };

  const contextValue: MeterRootContext = {
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
    get value() {
      return componentProps.value;
    },
  };

  return (
    <MeterRootContext value={contextValue}>
      {untrack(() =>
        useRenderElement('div', componentProps, {
          props: [defaultProps, elementProps],
          children: () => (
            <>
              {componentProps.children}
              <span role="presentation" style={visuallyHidden}>
                {/* force NVDA to read the label https://github.com/mui/base-ui/issues/4184 */}x
              </span>
            </>
          ),
        }),
      )}
    </MeterRootContext>
  );
}

type MeterRootContext = import('./MeterRootContext').MeterRootContext;

export interface MeterRootState {}

export interface MeterRootProps extends BaseUIComponentProps<'div', MeterRootState> {
  /**
   * A string value that provides a user-friendly name for `aria-valuenow`, the current value of the meter.
   */
  'aria-valuetext'?: string | undefined;
  /**
   * Options to format the value.
   */
  format?: Intl.NumberFormatOptions | undefined;
  /**
   * A function that returns a string value that provides a human-readable text alternative for `aria-valuenow`, the current value of the meter.
   */
  getAriaValueText?: ((formattedValue: string, value: number) => string) | undefined;
  /**
   * The locale used by `Intl.NumberFormat` when formatting the value.
   * Defaults to the user's runtime locale.
   * When server rendering, `en-US` is used until hydration.
   */
  locale?: Intl.LocalesArgument | undefined;
  /**
   * The maximum value
   * @default 100
   */
  max?: number | undefined;
  /**
   * The minimum value
   * @default 0
   */
  min?: number | undefined;
  /**
   * The current value.
   */
  value: number;
}

export namespace MeterRoot {
  export type State = MeterRootState;
  export type Props = MeterRootProps;
}
