import { For } from 'solid-js';
import './DemoVariantSelector.css';

export const variantTranslations: Record<string, string> = {
  Default: 'Default',
  System: 'MUI System',
  Css: 'Plain CSS',
  CssModules: 'CSS Modules',
  Tailwind: 'Tailwind v4',
};

export interface DemoVariantSelectorProps {
  onVariantChange?: () => void;
  variants: string[];
  selectedVariant: string;
  selectVariant: (value: string) => void;
}

/**
 * Upstream uses the docs' Base UI Select here. A native select keeps this independent of the
 * Select port.
 */
export function DemoVariantSelector(props: DemoVariantSelectorProps) {
  return (
    <select
      aria-label="Styling method"
      class="DemoVariantSelect"
      value={props.selectedVariant}
      onChange={(event) => {
        props.selectVariant(event.currentTarget.value);
        props.onVariantChange?.();
      }}
    >
      <For each={props.variants}>
        {(variant) => <option value={variant}>{variantTranslations[variant] ?? variant}</option>}
      </For>
    </select>
  );
}
