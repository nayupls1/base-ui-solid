import { createEffect, untrack, type Accessor } from 'solid-js';
import { createSyncSignal } from 'base-ui-solidjs-utils/createSyncSignal';
import { useId } from 'base-ui-solidjs-utils/useId';

/**
 * Resolves `aria-labelledby` for a control, falling back to an associated native `<label>`.
 * All inputs are accessors.
 */
export function useAriaLabelledBy(
  explicitAriaLabelledBy: Accessor<string | undefined>,
  labelId: Accessor<string | undefined>,
  labelSource: Accessor<LabelSource | null | undefined>,
  enableFallback: Accessor<boolean> = () => true,
  labelSourceId?: Accessor<string | undefined>,
  ariaLabel?: Accessor<string | undefined>,
): Accessor<string | undefined> {
  const [fallbackAriaLabelledBy, setFallbackAriaLabelledBy] = createSyncSignal<
    string | undefined
  >(undefined);

  const generatedFallbackId = useId(undefined, 'base-ui');
  const generatedLabelId = () => {
    const sourceId = labelSourceId?.();
    return sourceId ? `${sourceId}-label` : generatedFallbackId;
  };
  const hasAriaLabel = () => Boolean(ariaLabel?.()?.trim());
  const implicitLabelId = () => (hasAriaLabel() ? undefined : labelId());

  createEffect(
    () =>
      [
        explicitAriaLabelledBy(),
        labelId(),
        hasAriaLabel(),
        enableFallback(),
        labelSource(),
        generatedLabelId(),
      ] as const,
    ([explicit, currentLabelId, hasLabel, fallbackEnabled, source, generatedId]) => {
      const nextAriaLabelledBy =
        explicit || currentLabelId || hasLabel || !fallbackEnabled
          ? undefined
          : getAriaLabelledBy(source, generatedId);

      if (untrack(fallbackAriaLabelledBy) !== nextAriaLabelledBy) {
        setFallbackAriaLabelledBy(nextAriaLabelledBy);
      }
    },
  );

  return () => explicitAriaLabelledBy() ?? implicitLabelId() ?? fallbackAriaLabelledBy();
}

function getAriaLabelledBy(labelSource?: LabelSource | null, generatedLabelId?: string) {
  const label = findAssociatedLabel(labelSource);
  if (!label) {
    return undefined;
  }

  if (!label.id && generatedLabelId) {
    label.id = generatedLabelId;
  }

  return label.id || undefined;
}

function findAssociatedLabel(labelSource?: LabelSource | null) {
  if (!labelSource) {
    return undefined;
  }

  const parent = labelSource.parentElement;
  if (parent && parent.tagName === 'LABEL') {
    return parent as HTMLLabelElement;
  }

  const controlId = labelSource.id;
  if (controlId) {
    const nextSibling = labelSource.nextElementSibling as HTMLLabelElement | null;
    if (nextSibling && nextSibling.htmlFor === controlId) {
      return nextSibling;
    }
  }

  const labels = labelSource.labels;
  return labels && labels[0];
}

type LabelSource = HTMLElement & { labels?: NodeListOf<HTMLLabelElement> | null | undefined };
